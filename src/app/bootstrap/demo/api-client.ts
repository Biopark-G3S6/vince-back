/**
 * Cliente mínimo da API pública, usado só pela carga de demonstração.
 *
 * A carga passa pelos mesmos endpoints que a interface usa, e não escreve no banco por
 * fora: assim os dados de demonstração respeitam toda regra de negócio, a propriedade de
 * dados de cada módulo (ADR-0006) e os fatos que um módulo publica para o outro.
 */

type Envelope<T> = { data: T; status?: { code?: string } };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

export class ApiSession {
  private readonly cookies = new Map<string, string>();

  private constructor(private readonly baseUrl: string) {}

  static anonymous(baseUrl: string): ApiSession {
    return new ApiSession(baseUrl);
  }

  static async login(baseUrl: string, email: string, password: string): Promise<ApiSession> {
    const session = new ApiSession(baseUrl);
    await session.post('/sessions', { email, password });
    return session;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.cookies.size > 0) {
      headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }

    const csrf = this.cookies.get('vince_csrf');

    if (method !== 'GET' && csrf !== undefined) {
      headers['X-CSRF-Token'] = csrf;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const index = pair?.indexOf('=') ?? -1;

      if (pair !== undefined && index > 0) {
        this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const envelope = (await response.json()) as Envelope<T>;

    if (!response.ok) {
      const code = envelope.status?.code;
      throw new ApiError(`${method} ${path} → ${response.status} ${code}`, response.status, code);
    }

    return envelope.data;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
}

/**
 * Espera uma condição que depende de um fato entregue entre módulos — o artigo nasce e
 * acompanha a equipe por consumo de evento, e não na mesma requisição.
 */
export async function eventually<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  what: string,
): Promise<T> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const value = await read();

    if (done(value)) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`tempo esgotado esperando: ${what}`);
}
