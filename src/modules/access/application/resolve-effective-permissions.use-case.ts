import { Injectable } from '@nestjs/common';

import { PERMISSION_SOURCE, uniteSources } from '../domain/effective-permissions';
import { CatalogRepository } from '../domain/ports/catalog-repository';
import { PermissionCache } from '../domain/ports/permission-cache';
import { UserRepository } from '../domain/ports/user-repository';

/**
 * A apuração das permissões efetivas de uma conta (RF-ACS-001 RN2, `ADR-0014` §5, §9).
 *
 * É o caminho crítico de toda requisição autenticada da vertical seguinte: a sessão
 * carrega o identificador do usuário, e nunca as suas permissões (`ADR-0014` §9).
 *
 * **União de origens** (decisão D6). Uma origem implementada — os papéis;
 * `PermissionGrant` entra depois, sem alterar a assinatura desta consulta.
 *
 * **Conjunto vazio, e não falha**, para conta inexistente e para conta inativa: quem
 * pergunta é a borda de autorização, e um conjunto vazio já nega tudo que houver a negar.
 *
 * **Contagem de consultas constante** em relação à quantidade de papéis (`ADR-0011` §9):
 * uma apuração de conta com três papéis emite as mesmas consultas que a de conta com um.
 * Não há consulta por papel nem por permissão.
 */
@Injectable()
export class ResolveEffectivePermissionsUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly catalog: CatalogRepository,
    private readonly cache: PermissionCache,
  ) {}

  async execute(userId: string): Promise<readonly string[]> {
    // O cache vem primeiro, e a sua indisponibilidade sobe como erro: `ADR-0013` §16 e a
    // implicação 3 de `ADR-0014` equiparam a queda do cache à do sistema, e não existe
    // modo degradado que conceda permissão sem base íntegra.
    const cached = await this.cache.read(userId);

    if (cached !== null) {
      return cached;
    }

    const found = await this.users.findWithRoles(userId);

    // Conta inexistente não vai para o cache: não há escrita que invalide a sua chave, e
    // guardá-la deixaria resíduo que a criação de uma conta de mesmo identificador
    // herdaria. Conta inativa vai, porque desativação e reativação invalidam.
    if (found === null) {
      return [];
    }

    const permissions = found.account.active
      ? uniteSources([
          {
            source: PERMISSION_SOURCE.ROLE,
            permissions: await this.catalog.findPermissionsOfRoles(found.roleCodes),
          },
        ])
      : [];

    await this.cache.write(userId, permissions);

    return permissions;
  }
}
