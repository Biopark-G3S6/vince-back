import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import type { Institution } from '../domain/institution';
import { InstitutionRepository } from '../domain/ports/institution-repository';
import { readerInstitution } from './reader-scope';

/**
 * A listagem paginada (RF-INS-001, `ADR-0025` §21 a §25).
 *
 * É a **primeira listagem do sistema**, e a forma que ela estabelece é a que as próximas
 * copiam: página buscada com um registro a mais, `hasNext` respondido pelo excedente, e
 * total apurado apenas sob pedido.
 *
 * **Inclui ativas e inativas.** Nenhum filtro implícito de estado: `active` tem
 * significado de negócio, e esconder as inativas tiraria do administrador de sistema a
 * única lista em que ele veria o que desativou.
 *
 * **Contagem de consultas invariante** (`ADR-0011` §9, §10): uma consulta com um registro
 * e uma com dez. Não há consulta por item devolvido.
 *
 * **O leitor vinculado vê só a própria instituição** (RN4): a página contém apenas ela.
 */
@Injectable()
export class ListInstitutionsUseCase {
  constructor(
    private readonly institutions: InstitutionRepository,
    private readonly access: AccessFacade,
  ) {}

  async execute(request: PageRequest, actorId?: string): Promise<Page<Institution>> {
    const reader = await readerInstitution(this.access, actorId);

    if (reader.scoped) {
      const own =
        request.page === 1 && reader.institutionId !== null
          ? await this.institutions.findById(reader.institutionId)
          : null;
      const rows = own === null ? [] : [own];

      return toPage(request, rows, request.withTotal ? rows.length : undefined);
    }

    const { rows, totalItems } = await this.institutions.list(request);

    return toPage(request, rows, totalItems);
  }
}
