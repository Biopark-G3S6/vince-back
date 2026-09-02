/**
 * Port da derivação de senha (decisão D2).
 *
 * O algoritmo não é escolha do domínio, mas o **contrato de tempo** é: as três operações
 * abaixo custam o mesmo, de propósito, e é isso que torna indistinguíveis os caminhos que
 * a spec manda tornar indistinguíveis (decisão D6).
 */
export abstract class PasswordHasher {
  /** Deriva a senha. A cadeia devolvida embute algoritmo, parâmetros e sal. */
  abstract hash(password: string): Promise<string>;

  /** Confere a senha contra a derivação gravada. */
  abstract verify(hash: string, password: string): Promise<boolean>;

  /**
   * Confere contra uma derivação de referência. **Devolve sempre `false`** — não há o que
   * conferir; o que ela entrega é o custo.
   *
   * Existe porque responder depressa é responder. Conta inexistente e conta sem senha
   * definida não têm derivação alguma contra que conferir, e sair do caminho antes de
   * gastar o tempo revelaria, pelo relógio, o que o texto da resposta esconde
   * (decisão D6).
   */
  abstract verifyAgainstReference(password: string): Promise<boolean>;
}
