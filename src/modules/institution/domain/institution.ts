import { VIOLATION, type FieldViolation } from './failure';

/**
 * A instituição: a fronteira de isolamento do sistema (`ADR-0028` §1, RF-INS-001 RN1).
 *
 * Regras puras, sem framework e sem tipo do Prisma (`ADR-0003` §4, `ADR-0010` §9), o que
 * as torna testáveis sem banco de dados (`ADR-0024` §6).
 */

export interface Institution {
  readonly id: string;
  readonly name: string;
  /** A sigla, já normalizada: é a forma comparável e a forma gravada. */
  readonly code: string;
  /** Só dígitos quando presente; `null` quando não informado — nunca texto vazio. */
  readonly cnpj: string | null;
  readonly website: string | null;
  readonly contactEmail: string | null;
  readonly active: boolean;
}

/**
 * Limites de tamanho. A URS não os declara, então são decisão desta camada: largos o
 * bastante para não recusar dado legítimo, estreitos o bastante para que o campo não vire
 * depósito de texto.
 */
export const NAME_MAX_LENGTH = 200;
export const CODE_MAX_LENGTH = 32;
export const WEBSITE_MAX_LENGTH = 2048;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

/** O CNPJ tem catorze dígitos. A máscara é apresentação, e não é gravada. */
const CNPJ_DIGITS = 14;

/**
 * Normalização da sigla: espaços nas extremidades removidos e caixa alta.
 *
 * Acontece antes de comparar **e** antes de gravar, e é por isso que a unicidade do banco
 * basta como regra: não há duas grafias da mesma sigla no índice.
 *
 * `toUpperCase` sem localidade é deliberado: `toLocaleUpperCase` faria o resultado
 * depender da localidade do processo, e a mesma sigla produziria chaves distintas em
 * máquinas distintas.
 */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Texto opcional: vazio e só-espaços são a mesma coisa que ausente. */
export function normalizeOptionalText(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const trimmed = raw.trim();

  return trimmed.length === 0 ? null : trimmed;
}

/**
 * O CNPJ, reduzido aos seus dígitos. Ponto, barra e hífen são máscara de apresentação:
 * gravá-los faria de `12.345.678/0001-90` e `12345678000190` dois valores distintos no
 * índice único, que é exatamente o que a unicidade existe para impedir.
 */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  const text = normalizeOptionalText(raw);

  if (text === null) {
    return null;
  }

  const digits = text.replace(/\D/g, '');

  return digits.length === 0 ? null : digits;
}

/**
 * Forma do endereço de correio eletrônico.
 *
 * Verificação deliberadamente estrutural — parte local, `@`, domínio com ao menos um
 * ponto e sem espaço —, e não a gramática do RFC 5322, pelo mesmo motivo que no módulo
 * `access`: o que separa endereço existente de inexistente é a confirmação por mensagem,
 * não a expressão regular.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** Sítio: apenas o esquema é exigido. Se o endereço responde, quem diz é a rede. */
const WEBSITE_SHAPE = /^https?:\/\/[^\s]+$/i;

/** O que um cadastro ou uma alteração informa, antes de qualquer validação. */
export interface InstitutionDraft {
  readonly name?: string;
  readonly code?: string;
  readonly cnpj?: string | null;
  readonly website?: string | null;
  readonly contactEmail?: string | null;
}

function violateName(name: string | undefined, into: FieldViolation[]): void {
  const trimmed = name?.trim() ?? '';

  if (trimmed.length === 0) {
    into.push({ field: 'name', code: VIOLATION.REQUIRED });
  } else if (trimmed.length > NAME_MAX_LENGTH) {
    into.push({ field: 'name', code: VIOLATION.TOO_LONG });
  }
}

function violateCode(code: string | undefined, into: FieldViolation[]): void {
  const normalized = normalizeCode(code ?? '');

  if (normalized.length === 0) {
    into.push({ field: 'code', code: VIOLATION.REQUIRED });
  } else if (normalized.length > CODE_MAX_LENGTH) {
    into.push({ field: 'code', code: VIOLATION.TOO_LONG });
  }
}

/** Os opcionais só são apurados quando informados: ausente é estado válido nos três. */
function violateOptionals(draft: InstitutionDraft, into: FieldViolation[]): void {
  if (draft.cnpj !== undefined) {
    const cnpj = normalizeCnpj(draft.cnpj);

    if (cnpj !== null && cnpj.length !== CNPJ_DIGITS) {
      into.push({ field: 'cnpj', code: VIOLATION.MALFORMED });
    }
  }

  if (draft.website !== undefined) {
    const website = normalizeOptionalText(draft.website);

    if (website !== null && website.length > WEBSITE_MAX_LENGTH) {
      into.push({ field: 'website', code: VIOLATION.TOO_LONG });
    } else if (website !== null && !WEBSITE_SHAPE.test(website)) {
      into.push({ field: 'website', code: VIOLATION.MALFORMED });
    }
  }

  if (draft.contactEmail !== undefined) {
    const email = normalizeOptionalText(draft.contactEmail);

    if (email !== null && email.length > CONTACT_EMAIL_MAX_LENGTH) {
      into.push({ field: 'contactEmail', code: VIOLATION.TOO_LONG });
    } else if (email !== null && !EMAIL_SHAPE.test(email)) {
      into.push({ field: 'contactEmail', code: VIOLATION.MALFORMED });
    }
  }
}

/**
 * As violações do cadastro, todas de uma vez.
 *
 * Todas, e não a primeira: `ADR-0025` §16 exige um item por campo inválido, e apurar uma
 * por vez faria o cliente descobrir os seus erros em tantas idas quantas fossem.
 */
export function violationsOfDraft(draft: InstitutionDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  violateName(draft.name, violations);
  violateCode(draft.code, violations);
  violateOptionals(draft, violations);

  return violations;
}

/** As violações de uma alteração, apuradas só sobre o que ela informa. */
export function violationsOfUpdate(draft: InstitutionDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  if (draft.name !== undefined) {
    violateName(draft.name, violations);
  }

  if (draft.code !== undefined) {
    violateCode(draft.code, violations);
  }

  violateOptionals(draft, violations);

  return violations;
}

/** Monta a entidade a partir do rascunho já validado. Não valida: quem chama já validou. */
export function institutionOf(id: string, draft: InstitutionDraft): Institution {
  return {
    id,
    name: (draft.name ?? '').trim(),
    code: normalizeCode(draft.code ?? ''),
    cnpj: normalizeCnpj(draft.cnpj),
    website: normalizeOptionalText(draft.website),
    contactEmail: normalizeOptionalText(draft.contactEmail),
    active: true,
  };
}

/**
 * Aplica a alteração à instituição. Campo ausente permanece como está; `null` remove o
 * que é opcional.
 *
 * **`active` não aparece aqui, e a ausência é a regra** (`ADR-0028` §11, RF-INS-001): a
 * alteração não muda o estado. Ativar e desativar são operações próprias, com permissão
 * própria — `INSTITUTION:DEACTIVATE`, e não `INSTITUTION:UPDATE`. Aceitar o campo aqui
 * daria a quem só pode alterar o poder de desativar.
 */
export function withChanges(institution: Institution, draft: InstitutionDraft): Institution {
  return {
    ...institution,
    name: draft.name === undefined ? institution.name : draft.name.trim(),
    code: draft.code === undefined ? institution.code : normalizeCode(draft.code),
    cnpj: draft.cnpj === undefined ? institution.cnpj : normalizeCnpj(draft.cnpj),
    website:
      draft.website === undefined ? institution.website : normalizeOptionalText(draft.website),
    contactEmail:
      draft.contactEmail === undefined
        ? institution.contactEmail
        : normalizeOptionalText(draft.contactEmail),
  };
}

/**
 * Transição de estado, idempotente (`ADR-0028` §11): desativar instituição já inativa a
 * deixa inativa.
 *
 * Não é exclusão lógica (`ADR-0018` §18, `ADR-0028` §9): `active` tem significado de
 * negócio — RF-INS-001 RN2, usuário de instituição inativa não autentica — e por isso
 * nenhuma consulta o filtra implicitamente. A listagem devolve ativas e inativas, e é o
 * cliente que as distingue pelo estado.
 */
export function deactivated(institution: Institution): Institution {
  return { ...institution, active: false };
}

export function activated(institution: Institution): Institution {
  return { ...institution, active: true };
}

/**
 * O papel que a designação atribui (RF-INS-002).
 *
 * Texto opaco, e não tipo importado do módulo `access` (`ADR-0027` §14): o código do
 * papel atravessa a fronteira como texto, e um tipo compartilhado faria da composição do
 * catálogo alheio uma dependência de compilação deste módulo.
 */
export const INSTITUTION_ADMIN_ROLE = 'INSTITUTION_ADMIN';
