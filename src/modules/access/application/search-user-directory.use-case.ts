import { Injectable } from '@nestjs/common';

import type { DirectoryPage, SearchDirectoryQuery } from '../contracts/user-directory.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { PERMISSION } from '../domain/permission-catalog';
import { ROLE } from '../domain/role-catalog';
import { UserRepository } from '../domain/ports/user-repository';
import { ResolveEffectivePermissionsUseCase } from './resolve-effective-permissions.use-case';

/**
 * As permissões cujos requisitos precisam **escolher uma pessoa** pelo identificador.
 *
 * O diretório não tem permissão própria: nenhum requisito a gera (`PAD-REQ-*`), e criá-la
 * seria permissão sem origem. Ele herda a dos requisitos a que serve — quem pode designar
 * alguém pode procurar a quem designar.
 */
const DESIGNATION_PERMISSIONS: readonly string[] = [
  PERMISSION.INSTITUTION_ASSIGN_ADMIN,
  PERMISSION.COURSE_ASSIGN_COORDINATOR,
  PERMISSION.COHORT_ASSIGN_PROFESSOR,
  PERMISSION.ENROLLMENT_READ,
  PERMISSION.EVENT_ASSIGN_ADVISOR,
  PERMISSION.TEAM_ASSIGN_MEMBER,
  PERMISSION.TEAM_INVITE_MEMBER,
  PERMISSION.TEAM_ASSIGN_ADVISOR,
  PERMISSION.PERMISSION_GRANT_CREATE,
  PERMISSION.PERMISSION_GRANT_READ,
];

/**
 * O diretório de usuários (`user-directory`).
 *
 * Dois modos. **Resolução de nomes** (`ids`): aberta a qualquer conta ativa da instituição,
 * devolve só identificador e nome — é o que as listagens dos outros módulos, que trazem
 * apenas `userId`, precisam para serem exibidas. **Busca**: restrita a quem designa, com
 * e-mail e papéis. O e-mail é dado pessoal, e a conformidade legal ainda é decisão
 * pendente (`PAD-SEG-015`): expõe-se o mínimo.
 */
@Injectable()
export class SearchUserDirectoryUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly permissions: ResolveEffectivePermissionsUseCase,
  ) {}

  async execute(query: SearchDirectoryQuery): Promise<Result<DirectoryPage>> {
    const actor = await this.permissions.execute(query.actorId);
    const designates = actor.permissions.some((code) => DESIGNATION_PERMISSIONS.includes(code));

    let institutionId: string | undefined = actor.institutionId ?? undefined;

    // O administrador de sistema não tem instituição; designa o administrador de uma
    // instituição (RF-INS-002) e, para isso, diz qual. Sem dizer, lê só os administradores
    // institucionais de todas — o que a lista de instituições mostra, numa consulta só.
    if (institutionId === undefined) {
      if (!actor.permissions.includes(PERMISSION.INSTITUTION_ASSIGN_ADMIN)) {
        return fail(FAILURE.PERMISSION_DENIED);
      }

      if (query.institutionId === undefined && query.role !== ROLE.INSTITUTION_ADMIN) {
        return failValidation([{ field: 'institutionId', code: 'REQUIRED' }]);
      }

      institutionId = query.institutionId;
    }

    if (query.ids === undefined && !designates) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const page = await this.users.searchDirectory(
      {
        ...(institutionId === undefined ? {} : { institutionId }),
        ...(query.search === undefined ? {} : { search: query.search }),
        ...(query.role === undefined ? {} : { roleCode: query.role }),
        ...(query.active === undefined ? {} : { active: query.active }),
        ...(query.ids === undefined ? {} : { ids: query.ids }),
      },
      query.request,
    );

    return ok({
      items: page.items.map((entry) =>
        designates
          ? {
              id: entry.id,
              name: entry.name,
              email: entry.email,
              active: entry.active,
              roleCodes: entry.roleCodes,
              institutionId: entry.institutionId,
            }
          : { id: entry.id, name: entry.name },
      ),
      pagination: page.pagination,
    });
  }
}
