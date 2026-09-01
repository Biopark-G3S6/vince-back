import { VIOLATION, type FieldViolation } from './failure';
import { isSupportedLanguage } from './language';
import { ROLE, type RoleCode } from './role-catalog';

/**
 * A conta de usuário: a identidade sobre a qual a autorização e a autenticação operam
 * (`ADR-0027` §1, URS §1.4.1).
 *
 * Regras puras, sem framework e sem tipo do Prisma (`ADR-0003` §4, `ADR-0010` §9), o que
 * as torna testáveis sem banco de dados (`ADR-0024` §6).
 */

export interface UserAccount {
  readonly id: string;
  /** Já normalizado: é a forma comparável e a forma gravada. */
  readonly email: string;
  readonly name: string;
  /** Ausente é estado válido, e é `null` — nunca texto vazio. */
  readonly expertiseArea: string | null;
  readonly preferredLanguage: string | null;
  readonly active: boolean;
  /** Identificador de registro de outro módulo; ausente só para `SYSTEM_ADMIN`. */
  readonly institutionId: string | null;
}

/**
 * Limites de tamanho. A URS não os declara, então são decisão desta camada: largos o
 * bastante para não recusar dado legítimo, estreitos o bastante para que o campo não
 * vire depósito de texto.
 */
export const NAME_MAX_LENGTH = 200;
export const EXPERTISE_AREA_MAX_LENGTH = 200;
export const EMAIL_MAX_LENGTH = 254;

/**
 * Normalização do e-mail (RF-ACS-001 RN1): espaços nas extremidades removidos e caixa
 * desconsiderada.
 *
 * A normalização acontece antes de comparar **e** antes de gravar, e é por isso que a
 * unicidade do banco basta como regra: não há duas grafias do mesmo endereço no índice.
 *
 * `toLowerCase` sem localidade é deliberado: `toLocaleLowerCase` faria o resultado
 * depender da localidade do processo, e o mesmo endereço produziria chaves distintas em
 * máquinas distintas.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Forma do endereço de correio eletrônico.
 *
 * Verificação deliberadamente estrutural — parte local, `@`, domínio com ao menos um
 * ponto e sem espaço —, e não a gramática do RFC 5322. O que separa endereço existente
 * de inexistente é a confirmação por mensagem, não a expressão regular; validar mais que
 * isto recusa endereço legítimo e não aceita menos endereço inválido.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function isWellFormedEmail(value: string): boolean {
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_SHAPE.test(value);
}

/** Texto opcional: vazio e só-espaços são a mesma coisa que ausente. */
export function normalizeOptionalText(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const trimmed = raw.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function violateName(name: string | undefined, into: FieldViolation[]): void {
  const trimmed = name?.trim() ?? '';

  if (trimmed.length === 0) {
    into.push({ field: 'name', code: VIOLATION.REQUIRED });
  } else if (trimmed.length > NAME_MAX_LENGTH) {
    into.push({ field: 'name', code: VIOLATION.TOO_LONG });
  }
}

function violateExpertiseArea(area: string | null | undefined, into: FieldViolation[]): void {
  const normalized = normalizeOptionalText(area);

  if (normalized !== null && normalized.length > EXPERTISE_AREA_MAX_LENGTH) {
    into.push({ field: 'expertiseArea', code: VIOLATION.TOO_LONG });
  }
}

/** O que uma criação de conta informa, antes de qualquer validação. */
export interface UserAccountDraft {
  readonly email?: string;
  readonly name?: string;
  readonly expertiseArea?: string | null;
  readonly preferredLanguage?: string | null;
  readonly institutionId?: string | null;
  readonly role?: string;
}

/**
 * As violações da criação de conta, todas de uma vez.
 *
 * Todas, e não a primeira: `ADR-0025` §16 exige um item por campo inválido, e apurar
 * uma por vez faria o cliente descobrir os seus erros em tantas idas quantas fossem.
 */
export function violationsOfDraft(draft: UserAccountDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  const email = normalizeEmail(draft.email ?? '');

  if (email.length === 0) {
    violations.push({ field: 'email', code: VIOLATION.REQUIRED });
  } else if (!isWellFormedEmail(email)) {
    violations.push({ field: 'email', code: VIOLATION.MALFORMED });
  }

  violateName(draft.name, violations);
  violateExpertiseArea(draft.expertiseArea, violations);

  if (draft.role === undefined || draft.role.trim().length === 0) {
    violations.push({ field: 'role', code: VIOLATION.REQUIRED });
  }

  // A preferência de idioma NÃO entra aqui: idioma não suportado tem código próprio no
  // catálogo — `LANGUAGE_NOT_SUPPORTED` (RF-INT-001 E1) —, e não é `VALIDATION_FAILED`.

  if (!allowsAbsentInstitution(draft.role) && normalizeOptionalText(draft.institutionId) === null) {
    violations.push({ field: 'institutionId', code: VIOLATION.REQUIRED });
  }

  return violations;
}

/**
 * O vínculo institucional é obrigatório, exceto para `SYSTEM_ADMIN`.
 *
 * URS §1.4 e §1.4.1 item 3: o administrador de sistema atua sobre todas as instituições,
 * e prendê-lo a uma o tornaria incapaz de criar a primeira.
 */
export function allowsAbsentInstitution(role: string | undefined): boolean {
  return role === ROLE.SYSTEM_ADMIN;
}

/** O que uma atualização de perfil pode alterar (RF-ACS-005 RN1). */
export const EDITABLE_PROFILE_FIELDS = ['name', 'expertiseArea', 'preferredLanguage'] as const;

/**
 * O que o titular NÃO pode alterar em si mesmo. Tentar altera nada e recusa com
 * `PERMISSION_DENIED` (RF-ACS-005 E2), e não com `VALIDATION_FAILED`: o campo existe e o
 * valor pode até ser válido — o que falta é autoridade.
 */
export const PROTECTED_PROFILE_FIELDS = [
  'email',
  'role',
  'roles',
  'institutionId',
  'active',
] as const;

export interface ProfileUpdate {
  readonly name?: string;
  readonly expertiseArea?: string | null;
  readonly preferredLanguage?: string | null;
}

/** As violações de uma atualização de perfil, apuradas só sobre o que ela informa. */
export function violationsOfProfileUpdate(update: ProfileUpdate): FieldViolation[] {
  const violations: FieldViolation[] = [];

  if (update.name !== undefined) {
    violateName(update.name, violations);
  }

  if (update.expertiseArea !== undefined) {
    violateExpertiseArea(update.expertiseArea, violations);
  }

  return violations;
}

/**
 * A preferência informada é aceitável? `null` remove a preferência, e remover é sempre
 * aceitável (o perfil volta a não ter preferência registrada).
 */
export function acceptsLanguage(tag: string | null | undefined): boolean {
  const normalized = normalizeOptionalText(tag);

  return normalized === null || isSupportedLanguage(normalized);
}

/** Aplica a alteração ao perfil, já normalizada. Não valida: quem chama já validou. */
export function withProfile(account: UserAccount, update: ProfileUpdate): UserAccount {
  return {
    ...account,
    name: update.name === undefined ? account.name : update.name.trim(),
    expertiseArea:
      update.expertiseArea === undefined
        ? account.expertiseArea
        : normalizeOptionalText(update.expertiseArea),
    preferredLanguage:
      update.preferredLanguage === undefined
        ? account.preferredLanguage
        : normalizeOptionalText(update.preferredLanguage),
  };
}

/**
 * Transição de estado. Uma conta está em exatamente um de dois estados, e a transição é
 * idempotente: desativar conta já inativa a deixa inativa.
 *
 * Não é exclusão lógica (`ADR-0018` §18): `active` tem significado de negócio —
 * RF-ACS-001 E2, conta desativada não autentica — e por isso nenhuma consulta o filtra
 * implicitamente. Cada consulta decide, explicitamente, se ele importa.
 */
export function deactivated(account: UserAccount): UserAccount {
  return { ...account, active: false };
}

export function activated(account: UserAccount): UserAccount {
  return { ...account, active: true };
}

/** Um papel reconhecido? Papel fora dos cinco não existe (`ADR-0027` §15, §16). */
export function isKnownRole(code: string): code is RoleCode {
  return (Object.values(ROLE) as string[]).includes(code);
}
