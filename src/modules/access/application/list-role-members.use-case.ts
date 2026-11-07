import { Injectable } from '@nestjs/common';

import { toPage, type Page } from '@shared/http/pagination';

import type { RoleMembershipQuery } from '../contracts/user.dto';
import { UserRepository } from '../domain/ports/user-repository';

/**
 * As contas ativas de um papel na instituição, paginadas (`RF-EQP-006`).
 *
 * Devolve **identificadores**, e não perfis: quem pergunta precisa saber quem existe no
 * escopo, não quem são as pessoas. Devolver o perfil publicaria nome e e-mail para um
 * consumidor que não os pediu.
 */
@Injectable()
export class ListRoleMembersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(query: RoleMembershipQuery): Promise<Page<string>> {
    const rows = await this.users.listByRole(query.institutionId, query.roleCode, query.request);

    return toPage(query.request, rows.rows, rows.totalItems);
  }
}
