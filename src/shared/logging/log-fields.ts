/**
 * A lista de permissão dos campos de contexto do log, declarada em ponto único
 * (`ADR-0022` §4).
 *
 * **Lista de permissão, e não de bloqueio** (§5). A diferença não é de estilo: a lista de
 * bloqueio protege contra os campos que alguém lembrou de enumerar, e o campo sensível
 * que aparecer amanhã — porque um objeto ganhou uma propriedade — passa por ela sem que
 * ninguém perceba. Aqui, o campo que não estiver abaixo simplesmente não é registrado.
 *
 * Acrescentar um campo é acrescentar uma linha aqui, deliberadamente, e é o momento em
 * que se pergunta se ele é dado pessoal.
 */
export const LOG_CONTEXT_FIELDS = [
  /** A rota requisitada, sem parâmetros de consulta. */
  'route',
  'method',
  'statusCode',
  /** O identificador da conta. Não é dado pessoal: é opaco fora do banco. */
  'userId',
  /** A permissão exigida pela rota, na negativa de autorização (`ADR-0014` §14). */
  'requiredPermission',
  /** O código do catálogo da URS §2.4 devolvido ao cliente. */
  'responseCode',
  /** A classificação de `ADR-0022` §12: `expected` ou `unexpected`. */
  'failureClass',
  /** O nome da exceção. */
  'errorName',
  /**
   * A mensagem da exceção **inesperada**. Declarada deliberadamente: sem ela, uma falha
   * de `500` em produção é indiagnosticável, e o canal de saída padrão é o único que
   * `ADR-0022` §2 garante disponível quando banco e fila caíram.
   *
   * **Dívida declarada:** `ADR-0022` §22 exige normalizar identificador, número e
   * endereço de correio antes de usar a mensagem, e a normalização nasce com o registro
   * agregado de erros (§16 a §25), fora desta mudança. Até lá, a mensagem entra crua, e
   * é o único campo desta lista que pode carregar dado submetido.
   */
  'errorMessage',
  'durationMs',
  /** O identificador da sessão encerrada ou recusada. Opaco por construção. */
  'sessionId',
  /** Quantas sessões uma revogação alcançou. */
  'revokedSessions',
] as const;

export type LogContextField = (typeof LOG_CONTEXT_FIELDS)[number];

const ALLOWED = new Set<string>(LOG_CONTEXT_FIELDS);

/**
 * Filtra o contexto pela lista de permissão. Campo não declarado é descartado em
 * silêncio — registrar um aviso com o nome dele o traria de volta ao log.
 *
 * `undefined` também é descartado: campo declarado e ausente não vira chave nula.
 */
export function allowedContext(
  context: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(context)) {
    if (ALLOWED.has(field) && value !== undefined) {
      filtered[field] = value;
    }
  }

  return filtered;
}
