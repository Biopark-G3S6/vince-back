import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import type { AccessResult } from '@modules/access/contracts/result.dto';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { INSTITUTION_ADMIN_ROLE } from '../domain/institution';
import { InstitutionAdminRepository } from '../domain/ports/institution-admin-repository';
import { InstitutionRepository } from '../domain/ports/institution-repository';

/**
 * A designação e a revogação de administrador institucional (RF-INS-002).
 *
 * **É aqui que a regra de fronteira do sistema se exerce pela primeira vez.** O papel é
 * atribuído pela **fachada** do módulo `access` (`ADR-0028` §17); este módulo não escreve
 * em tabela alheia, e o cliente Prisma escopado o impediria se tentasse.
 *
 * **Duas transações, e não uma** (`ADR-0005` §7, `ADR-0028` §18): um módulo não participa
 * da transação de outro. A ordem é papel primeiro, vínculo depois, e ambos idempotentes —
 * é a idempotência, e não a atomicidade, que fecha a operação.
 *
 * _Por que esta ordem:_ das duas falhas parciais possíveis, esta é a inócua. Papel sem
 * vínculo não autoriza nada, porque `ADR-0014` §12 obriga a verificação de titularidade
 * dentro do caso de uso — o usuário teria a permissão e nenhum registro sobre o qual
 * exercê-la. A ordem inversa produziria vínculo sem papel, que aparenta designação
 * concluída e não funciona.
 */
@Injectable()
export class AssignInstitutionAdminUseCase {
  constructor(
    private readonly institutions: InstitutionRepository,
    private readonly admins: InstitutionAdminRepository,
    private readonly access: AccessFacade,
  ) {}

  /**
   * Designa (RF-INS-002 E1, E2, E3).
   *
   * Repetir a designação conclui a que ficou pela metade: `assignRole` não cria segundo
   * vínculo de papel, `link` não cria segundo vínculo de instituição, e o estado final é
   * idêntico ao de uma designação bem-sucedida de primeira.
   */
  async assign(
    institutionId: string,
    userId: string,
    actorId: string | null | undefined,
  ): Promise<Result<void>> {
    const institution = await this.institutions.findById(institutionId);

    if (institution === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (!institution.active) {
      return fail(FAILURE.INSTITUTION_INACTIVE);
    }

    // O papel primeiro. `access` recusa com `RESOURCE_NOT_FOUND` o usuário inexistente e
    // o desativado (E3) — é ele quem conhece a conta, e perguntar antes seria duplicar a
    // verificação num módulo que não é dono dela.
    const assigned = await this.access.assignRole({
      actorId,
      userId,
      roleCode: INSTITUTION_ADMIN_ROLE,
    });

    if (!assigned.ok) {
      return propagate(assigned);
    }

    await this.admins.link(institutionId, userId);

    return ok(undefined);
  }

  /**
   * Revoga (RF-INS-002 RN3).
   *
   * **Não verifica a existência da instituição**, e a ausência da verificação é a regra:
   * vínculo inexistente conclui com sucesso e nada altera, e um vínculo com instituição
   * que não existe é, por definição, inexistente. Verificar antes trocaria um sucesso
   * idempotente por um `RESOURCE_NOT_FOUND` que a spec não pede.
   *
   * **Também não exige instituição ativa**: RF-INS-002 E2 condiciona a designação, não a
   * revogação. Impedir a limpeza de vínculos de uma instituição desativada prenderia o
   * papel a quem já não administra nada.
   *
   * O papel só cai quando não resta vínculo que o justifique (RN3) — a contagem é uma
   * consulta, e não uma por instituição.
   */
  async revoke(
    institutionId: string,
    userId: string,
    actorId: string | null | undefined,
  ): Promise<Result<void>> {
    const { changed } = await this.admins.unlink(institutionId, userId);

    // Nada foi removido: não havia vínculo, e mexer no papel aqui o revogaria por conta
    // de uma operação que nada alterou.
    if (!changed) {
      return ok(undefined);
    }

    if ((await this.admins.countByUser(userId)) > 0) {
      return ok(undefined);
    }

    const revoked = await this.access.revokeRole({
      actorId,
      userId,
      roleCode: INSTITUTION_ADMIN_ROLE,
    });

    return revoked.ok ? ok(undefined) : propagate(revoked);
  }
}

/**
 * Traduz a falha do módulo `access` para o vocabulário deste.
 *
 * O código chega como texto opaco (`ADR-0027` §14). `RESOURCE_NOT_FOUND` é o único que
 * esta operação pode produzir legitimamente; qualquer outro é defeito — a fachada devolveu
 * algo que o contrato desta chamada não prevê —, e defeito sobe como erro, para virar
 * `500` e não uma falha de negócio inventada.
 */
function propagate<T>(result: AccessResult<unknown> & { ok: false }): Result<T> {
  if (result.failure.code === FAILURE.RESOURCE_NOT_FOUND) {
    return fail(FAILURE.RESOURCE_NOT_FOUND);
  }

  throw new Error(
    `A fachada de \`access\` recusou a operação de papel com \`${result.failure.code}\`, ` +
      'código que a designação de administrador institucional não prevê.',
  );
}
