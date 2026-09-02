import {
  Injectable,
  SetMetadata,
  type CallHandler,
  type CustomDecorator,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { EnvelopeResult, successEnvelope, type ResponseEnvelope } from './response-envelope';

/**
 * Marca a rota que **não** usa o envelope (`ADR-0025` §2): verificação de saúde, métricas
 * e transferência de arquivo.
 *
 * É marcação explícita, e não lista de caminhos em algum lugar do interceptador, pelo
 * mesmo motivo da declaração de acesso: a exceção fica ao lado da rota que a pede, e
 * quem lê a rota vê que ela é exceção.
 */
export const RAW_RESPONSE_KEY = 'vince:route:raw-response';

export const RawResponse = (): CustomDecorator => SetMetadata(RAW_RESPONSE_KEY, true);

/**
 * Aplica o envelope a toda resposta de sucesso com corpo (`ADR-0025` §1, §3, §4).
 *
 * **Não** monta envelope para resposta sem corpo: o controlador que conclui sem conteúdo
 * devolve `undefined` e declara `@HttpCode(204)`, e o corpo vazio sai vazio (§28). O
 * status vem do decorador, e não daqui — o adaptador HTTP do NestJS resolve o código de
 * status a partir do metadado da rota e sobrescreveria o que este interceptador
 * escrevesse na resposta.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (raw === true) {
      return next.handle();
    }

    return next.handle().pipe(map(toEnvelope));
  }
}

function toEnvelope(value: unknown): ResponseEnvelope<unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value instanceof EnvelopeResult
    ? successEnvelope(value.data, value.code)
    : successEnvelope(value);
}
