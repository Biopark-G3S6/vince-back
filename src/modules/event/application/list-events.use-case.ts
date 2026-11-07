import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import type { Event } from '../domain/event';
import { ok, type Result } from '../domain/failure';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A listagem de eventos por escopo (RF-EVT-004).
 *
 * Alcance vazio devolve página vazia, e não falha: o usuário sem vínculo algum não é um
 * erro — é alguém que ainda não participa de nada.
 */
@Injectable()
export class ListEventsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(actorId: string, request: PageRequest): Promise<Result<Page<Event>>> {
    const reach = await this.scope.reachOf(actorId);
    const rows = await this.events.listReachable(reach, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
