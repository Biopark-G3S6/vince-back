import { currentCorrelationId } from '../correlation/correlation';
import { allowedContext } from './log-fields';

/**
 * O log estruturado em saída padrão (`ADR-0022` §1, §2).
 *
 * A saída padrão é o canal primário e síncrono, e **não depende de banco, fila ou
 * serviço externo** (§2): é o único canal que continua funcionando exatamente quando
 * mais importa, que é quando alguma dessas três caiu.
 *
 * Todo registro carrega instante, nível, correlação, papel do processo e módulo de
 * origem (§3); o resto do contexto passa pela lista de permissão de `log-fields.ts`.
 */

/**
 * `silent` existe para o teste, e só para ele: a suíte exercita centenas de requisições, e
 * o registro de cada uma sepultaria a saída do próprio teste. Nenhum ambiente de execução
 * o usa — `ADR-0022` §1 quer log em toda instalação.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: Number.POSITIVE_INFINITY,
};

export interface LogRecord {
  readonly time: string;
  readonly level: LogLevel;
  /** Nulo fora de uma requisição — na carga inicial e no worker. */
  readonly correlationId: string | null;
  readonly role: string;
  readonly module: string;
  /** Identificador estável do acontecimento, em maiúsculas (`ADR-0026` §5). */
  readonly event: string;
  readonly context: Readonly<Record<string, unknown>>;
}

/** Para onde o registro vai. Substituível no teste; em produção, a saída padrão. */
export type LogSink = (record: LogRecord) => void;

function writeToStandardOutput(record: LogRecord): void {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

function configuredLevel(env: NodeJS.ProcessEnv): LogLevel {
  const raw = (env.LOG_LEVEL ?? 'info').trim().toLowerCase();

  return raw in LEVEL_ORDER ? (raw as LogLevel) : 'info';
}

export class StructuredLogger {
  private readonly threshold: number;

  constructor(
    private readonly module: string,
    private readonly sink: LogSink = writeToStandardOutput,
    private readonly role: string = (process.env.ROLE ?? 'api').trim(),
    level: LogLevel = configuredLevel(process.env),
  ) {
    this.threshold = LEVEL_ORDER[level];
  }

  debug(event: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit('debug', event, context);
  }

  info(event: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit('info', event, context);
  }

  warn(event: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit('warn', event, context);
  }

  error(event: string, context: Readonly<Record<string, unknown>> = {}): void {
    this.emit('error', event, context);
  }

  private emit(level: LogLevel, event: string, context: Readonly<Record<string, unknown>>): void {
    if (LEVEL_ORDER[level] < this.threshold) {
      return;
    }

    this.sink({
      time: new Date().toISOString(),
      level,
      correlationId: currentCorrelationId(),
      role: this.role,
      module: this.module,
      event,
      context: allowedContext(context),
    });
  }
}
