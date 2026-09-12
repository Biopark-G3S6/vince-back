import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import type { Institution } from '../domain/institution';
import { InstitutionRepository } from '../domain/ports/institution-repository';

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
 */
@Injectable()
export class ListInstitutionsUseCase {
  constructor(private readonly institutions: InstitutionRepository) {}

  async execute(request: PageRequest): Promise<Page<Institution>> {
    const { rows, totalItems } = await this.institutions.list(request);

    return toPage(request, rows, totalItems);
  }
}
