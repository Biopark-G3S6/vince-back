/**
 * A verificação da credencial, como **port abstrato** (decisão D1).
 *
 * `ADR-0013` §17 põe a autenticação em `shared/`; `ADR-0009` §6 proíbe `shared/` de
 * importar de `modules/`; e verificar uma senha exige ler a credencial, que é dado do
 * módulo `access` (`ADR-0027` §5). As três regras só se satisfazem ao mesmo tempo se
 * `shared/` declarar o que precisa e o composition root ligar à implementação — que é
 * exatamente o que este arquivo é.
 *
 * **A indistinguibilidade de tempo é obrigação de quem implementa** (decisão D6): conta
 * inexistente, senha errada e conta sem senha definida têm de custar o mesmo, o que
 * significa derivar contra um hash de referência mesmo quando não há conta. Responder
 * `null` depressa entrega, pelo relógio, a informação que o texto da resposta esconde.
 */
export abstract class CredentialVerifier {
  /**
   * Devolve o identificador da conta quando a credencial confere, e `null` em todos os
   * casos de falha — sem distinguir qual deles ocorreu (RF-ACS-001 E1, E2).
   */
  abstract verify(email: string, password: string): Promise<string | null>;
}
