/**
 * A política de senha, republicada para a camada de apresentação.
 *
 * `presentation/` não importa `domain/` (`ADR-0003` §7) e precisa do limite para descrevê-lo
 * na especificação OpenAPI, de que o cliente deriva os seus tipos (`ADR-0017` §2).
 * Reescrever o número lá seria a segunda cópia de uma regra que a spec exige em ponto
 * único; reexportá-lo daqui mantém a declaração única e respeita a fronteira.
 */
export { PASSWORD_POLICY } from '../domain/password';
