import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * O token anti-CSRF por sessão (`ADR-0013` §13, §14).
 *
 * É a **assinatura do identificador de sessão**, e não um segundo segredo guardado ao
 * lado dele. A consequência é a que interessa: o token de uma sessão não vale em outra,
 * porque a assinatura não confere; e a verificação não custa leitura alguma, porque não
 * há nada a buscar.
 *
 * O token é entregue em cookie legível por script — deliberadamente, e sem contrariar
 * `ADR-0013` §9, que proíbe o **identificador de sessão** em armazenamento acessível a
 * script. O token não é a credencial: sozinho não autentica ninguém, e a sua função é
 * justamente ser algo que o sítio atacante não consegue ler nem adivinhar.
 *
 * **Questão em aberto** (`design.md`): a origem e a rotação da chave de assinatura.
 * Rotacionar o segredo hoje invalida o token de toda sessão viva, e o cliente precisa
 * reobtê-lo pelo endpoint de identidade.
 */
export const CSRF_HEADER = 'x-csrf-token';

export function csrfTokenFor(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

/**
 * Comparação em tempo constante. `timingSafeEqual` exige buffers do mesmo tamanho, então
 * o tamanho diferente é recusado antes — o que não vaza nada: o comprimento do token é
 * público, é sempre o mesmo, e não depende do segredo.
 */
export function isValidCsrfToken(token: string, sessionId: string, secret: string): boolean {
  const expected = Buffer.from(csrfTokenFor(sessionId, secret));
  const received = Buffer.from(token);

  return expected.length === received.length && timingSafeEqual(expected, received);
}
