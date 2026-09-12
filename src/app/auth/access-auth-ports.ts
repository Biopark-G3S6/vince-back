import { Injectable, Optional } from '@nestjs/common';

import { CredentialVerifier } from '@shared/auth/credential-verifier';
import { IdentityResolver, type AuthenticatedIdentity } from '@shared/auth/identity';
import { InstitutionAccess } from '@shared/auth/institution-access';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

/**
 * A ligação entre os ports de `shared/` e os módulos (decisão D1, `ADR-0028` §13).
 *
 * Vive **aqui**, no composition root, e não podia viver em outro lugar: `shared/` não
 * importa de `modules/` (`ADR-0009` §7), o módulo não conhece a borda, e `access` não
 * pode chamar `institution` (`ADR-0027` §9); `app` é o único que pode conhecer os três, e
 * é o que a configuração do ESLint já permitia
 * (`from: 'app', allow: ['app', 'shared', 'module-root', 'contracts']`).
 *
 * O acoplamento é **ao contrato**, não à implementação: o que estes adaptadores conhecem
 * dos módulos são as suas fachadas, que são as suas únicas superfícies públicas.
 *
 * _Tensão registrada:_ `ADR-0003` §10 diz que o composition root conhece "apenas a lista
 * de módulos", e um adaptador de composição é mais do que uma lista. A alternativa seria
 * um módulo de plataforma só para esta costura, que `ADR-0003` §15 desautoriza por ele não
 * ter dados próprios. `ADR-0028`, implicação 2, aceita a tensão enquanto forem duas
 * composições, e manda reescrever o ADR na terceira.
 */

/**
 * O estado da instituição de uma conta, composto a partir das duas fachadas.
 *
 * Concentrado numa classe só porque duas coisas o consultam — a autenticação, para recusar
 * com `INSTITUTION_INACTIVE`, e a resolução de permissões, para zerá-las — e a regra tem
 * de ser a mesma nas duas. Duplicá-la seria admitir que um dia divirjam.
 *
 * **O vínculo vem junto das permissões**, numa única ida ao módulo `access`, que responde
 * do seu cache (`ADR-0028` §13). O estado da instituição vem do cache do módulo
 * `institution` (§14). O caminho crítico, portanto, não toca o banco relacional.
 */
@Injectable()
export class InstitutionStateGate {
  /**
   * O parâmetro é **opcional**, e não de tipo `InstitutionFacade | null`, e a diferença
   * não é de estilo: `emitDecoratorMetadata` reduz um tipo de união a `Object`, e o Nest
   * perde o token por onde resolveria a fachada. Com `@Optional()` sobre um parâmetro
   * opcional, o metadado continua sendo a classe, a injeção acontece quando o módulo está
   * presente, e `undefined` chega apenas quando ele não está.
   */
  constructor(@Optional() private readonly institutions?: InstitutionFacade) {}

  /**
   * O vínculo autoriza a conta a agir?
   *
   * Sem vínculo, sim: é o `SYSTEM_ADMIN` (URS §1.4.1 item 3). Sem o módulo `institution`
   * no processo, também sim — é o que preserva `ADR-0003` §11.
   *
   * Instituição inexistente **nega**. É estado inconsistente — conta apontando para o que
   * não existe —, e diante do que não se pode confirmar, negar é o lado seguro.
   */
  async allows(institutionId: string | null): Promise<boolean> {
    if (institutionId === null || this.institutions === undefined) {
      return true;
    }

    const state = await this.institutions.stateOf(institutionId);

    return state.exists && state.active;
  }
}

@Injectable()
export class AccessCredentialVerifier extends CredentialVerifier {
  constructor(private readonly access: AccessFacade) {
    super();
  }

  async verify(email: string, password: string): Promise<string | null> {
    return this.access.verifyCredential({ email, password });
  }
}

/**
 * A verificação que a autenticação faz **depois** de a credencial ser provada
 * (`ADR-0028` §15, decisão D4).
 */
@Injectable()
export class ComposedInstitutionAccess extends InstitutionAccess {
  constructor(
    private readonly access: AccessFacade,
    private readonly gate: InstitutionStateGate,
  ) {
    super();
  }

  async allows(userId: string): Promise<boolean> {
    const { institutionId } = await this.access.effectivePermissions({ userId });

    return this.gate.allows(institutionId);
  }
}

@Injectable()
export class AccessIdentityResolver extends IdentityResolver {
  constructor(
    private readonly access: AccessFacade,
    private readonly gate: InstitutionStateGate,
  ) {
    super();
  }

  /**
   * O caminho crítico de toda requisição autenticada (`ADR-0014` §9).
   *
   * A fachada resolve com cache invalidado a cada alteração de papel ou de estado (§10), e
   * não por expiração: uma janela de validade seria exatamente o intervalo em que uma
   * permissão revogada continuaria valendo.
   *
   * **Instituição inativa zera o conjunto** (`ADR-0028` §12, decisão D3). Não derruba a
   * sessão: `ADR-0013` §18 proíbe módulo de invalidar sessão, e §15 proíbe consultar o
   * banco relacional na resolução dela. Zerar as permissões usa o mecanismo que
   * `ADR-0014` §9 e §10 já obrigam a existir, e produz o efeito prático — toda rota
   * protegida passa a responder `403`.
   *
   * _Consequência declarada:_ a sessão continua tecnicamente válida, e `ADR-0017` §17
   * determina que `403` não a encerre no cliente. O usuário de instituição desativada fica
   * numa aplicação em que nada funciona, em vez de ser levado à autenticação. É o preço de
   * não violar `ADR-0013` §18, e o fecho correto depende do relay de `ADR-0021`.
   */
  async permissionsOf(userId: string): Promise<readonly string[]> {
    const { permissions, institutionId } = await this.access.effectivePermissions({ userId });

    return (await this.gate.allows(institutionId)) ? permissions : [];
  }

  /**
   * `findOwnProfile` recebe o mesmo identificador como ator e como alvo, o que é
   * literalmente verdade: quem consulta a própria identidade é o titular dela. A
   * verificação de titularidade do caso de uso passa, e continua existindo para quando o
   * chamador não for este.
   */
  async identityOf(userId: string): Promise<AuthenticatedIdentity | null> {
    const profile = await this.access.findOwnProfile({ actorId: userId, userId });

    if (!profile.ok) {
      return null;
    }

    return {
      userId: profile.value.id,
      email: profile.value.email,
      name: profile.value.name,
      preferredLanguage: profile.value.preferredLanguage,
      roles: profile.value.roleCodes,
      permissions: await this.permissionsOf(userId),
    };
  }
}
