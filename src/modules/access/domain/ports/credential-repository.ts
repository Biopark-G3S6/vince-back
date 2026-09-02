/**
 * Port da credencial de senha (`ADR-0027` §5).
 *
 * Guarda **a derivação**, nunca a senha: não há nesta superfície operação que aceite ou
 * devolva texto puro persistível, e é o que faz de "senha em texto puro no banco" um
 * estado que o código não sabe representar.
 */
export abstract class CredentialRepository {
  /**
   * A derivação gravada, ou `null` quando a conta **não tem senha definida** — estado
   * válido de conta criada por fluxo interno (RF-TUR-003 RN3, RF-ACS-001 E4).
   */
  abstract findHash(userId: string): Promise<string | null>;

  /** Grava a derivação, criando ou substituindo a credencial da conta. */
  abstract save(userId: string, hash: string): Promise<void>;
}
