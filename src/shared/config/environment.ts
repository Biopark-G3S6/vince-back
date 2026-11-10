/**
 * A leitura da configuração de ambiente, em ponto único (`ADR-0009` §4).
 *
 * Toda variável declarada aqui é **obrigatória**: a aplicação recusa subir sem ela, e a
 * mensagem nomeia a variável que falta. É deliberado — configuração ausente que assume
 * valor padrão silencioso é o modo de falha que só aparece em produção, e o segredo do
 * token anti-CSRF é exatamente o caso em que um padrão embutido seria pior que a parada.
 *
 * Os valores de `ADR-0013` §6 — 8 horas de inatividade, 7 dias de prazo absoluto — são
 * fixados pelo ADR, não por esta leitura: o ambiente os declara, e divergir deles é
 * defeito de configuração, não escolha de operação.
 */

/** Configuração ausente ou inválida. Carrega o nome da variável, não o seu valor. */
export class InvalidConfigError extends Error {
  constructor(
    readonly variable: string,
    reason: string,
  ) {
    super(`Configuração inválida: \`${variable}\` ${reason}. Ver \`.env.example\`.`);
    this.name = 'InvalidConfigError';
  }
}

/** Parâmetros da derivação de senha (decisão D2). Calibrados contra a máquina real. */
export interface PasswordHashingConfig {
  readonly memoryCostKib: number;
  readonly timeCost: number;
  readonly parallelism: number;
}

/** A sessão opaca de `ADR-0013`. */
export interface SessionConfig {
  readonly cookieName: string;
  readonly idleTtlSeconds: number;
  readonly absoluteTtlSeconds: number;
}

/** Configuração opcional do provedor externo de resumo e da declaração institucional. */
export interface AssistanceConfig {
  readonly providerName: string | null;
  readonly processingPurpose: string | null;
  readonly legalBasis: string | null;
  readonly consentVersion: string | null;
  readonly consentText: string | null;
  readonly analysisEndpoint: string | null;
  readonly analysisToken: string | null;
}

/** Integração de correio; ausente, as mensagens ficam persistidas para envio posterior. */
export interface NotificationEmailConfig {
  readonly endpoint: string | null;
  readonly token: string | null;
}

/** Limiares operacionais configuráveis para os sinais de risco. */
export interface ProgressRiskConfig {
  readonly inactivityDays: number;
  readonly deadlineHours: number;
  readonly pendingRemarks: number;
}

/**
 * `abstract class` e não interface porque também é o token de injeção — a mesma convenção
 * dos ports do domínio (`ADR-0004` §2, §3): interface some em execução e não serve para
 * o contêiner encontrar o provider.
 */
export abstract class AuthConfig {
  abstract readonly session: SessionConfig;
  /** Chave de assinatura do token anti-CSRF (`ADR-0013` §14). Nunca versionada. */
  abstract readonly csrfSecret: string;
  abstract readonly csrfCookieName: string;
  abstract readonly passwordHashing: PasswordHashingConfig;
  /** Prazo do meio de redefinição de senha (RF-ACS-003 RN1). */
  abstract readonly passwordResetTtlSeconds: number;
}

/** O caminho ao qual o cookie de sessão fica restrito (`ADR-0013` §8). */
export const API_PATH_PREFIX = '/api/v1';

function requiredText(env: NodeJS.ProcessEnv, variable: string, minLength = 1): string {
  const raw = (env[variable] ?? '').trim();

  if (raw.length === 0) {
    throw new InvalidConfigError(variable, 'não está definida');
  }

  if (raw.length < minLength) {
    throw new InvalidConfigError(variable, `tem menos de ${minLength} caracteres`);
  }

  return raw;
}

function requiredPositiveInteger(env: NodeJS.ProcessEnv, variable: string): number {
  const raw = requiredText(env, variable);
  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new InvalidConfigError(variable, 'não é um inteiro positivo');
  }

  return value;
}

function optionalText(env: NodeJS.ProcessEnv, variable: string): string | null {
  const raw = env[variable]?.trim();
  return raw ? raw : null;
}

function optionalEndpoint(env: NodeJS.ProcessEnv, variable: string): string | null {
  const value = optionalText(env, variable);
  if (value === null) return null;
  try {
    const url = new URL(value);
    const localHttp =
      url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) throw new Error('invalid endpoint');
    return url.toString();
  } catch {
    throw new InvalidConfigError(variable, 'não é um endpoint HTTPS válido');
  }
}

function optionalPositiveInteger(
  env: NodeJS.ProcessEnv,
  variable: string,
  fallback: number,
): number {
  const raw = optionalText(env, variable);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0)
    throw new InvalidConfigError(variable, 'não é um inteiro positivo');
  return value;
}

export function loadAssistanceConfig(env: NodeJS.ProcessEnv = process.env): AssistanceConfig {
  return {
    providerName: optionalText(env, 'AI_PROVIDER_NAME'),
    processingPurpose: optionalText(env, 'AI_PROCESSING_PURPOSE'),
    legalBasis: optionalText(env, 'AI_LEGAL_BASIS'),
    consentVersion: optionalText(env, 'AI_CONSENT_VERSION'),
    consentText: optionalText(env, 'AI_CONSENT_TEXT'),
    analysisEndpoint: optionalEndpoint(env, 'AI_ANALYSIS_ENDPOINT'),
    analysisToken: optionalText(env, 'AI_ANALYSIS_TOKEN'),
  };
}

export function loadNotificationEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): NotificationEmailConfig {
  return {
    endpoint: optionalEndpoint(env, 'NOTIFICATION_EMAIL_ENDPOINT'),
    token: optionalText(env, 'NOTIFICATION_EMAIL_TOKEN'),
  };
}

export function loadProgressRiskConfig(env: NodeJS.ProcessEnv = process.env): ProgressRiskConfig {
  return {
    inactivityDays: optionalPositiveInteger(env, 'RISK_INACTIVITY_DAYS', 14),
    deadlineHours: optionalPositiveInteger(env, 'RISK_DEADLINE_HOURS', 72),
    pendingRemarks: optionalPositiveInteger(env, 'RISK_PENDING_REMARKS', 3),
  };
}

/**
 * Lê a configuração de autenticação, ou falha nomeando a variável.
 *
 * O comprimento mínimo do segredo anti-CSRF é o de uma chave de 256 bits em texto: um
 * segredo curto assina tão previsivelmente quanto nenhum.
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    session: {
      cookieName: requiredText(env, 'SESSION_COOKIE_NAME'),
      idleTtlSeconds: requiredPositiveInteger(env, 'SESSION_IDLE_TTL_SECONDS'),
      absoluteTtlSeconds: requiredPositiveInteger(env, 'SESSION_ABSOLUTE_TTL_SECONDS'),
    },
    csrfSecret: requiredText(env, 'CSRF_TOKEN_SECRET', 32),
    csrfCookieName: requiredText(env, 'CSRF_COOKIE_NAME'),
    passwordHashing: {
      memoryCostKib: requiredPositiveInteger(env, 'PASSWORD_HASH_MEMORY_KIB'),
      timeCost: requiredPositiveInteger(env, 'PASSWORD_HASH_TIME_COST'),
      parallelism: requiredPositiveInteger(env, 'PASSWORD_HASH_PARALLELISM'),
    },
    passwordResetTtlSeconds: requiredPositiveInteger(env, 'PASSWORD_RESET_TTL_SECONDS'),
  };
}
