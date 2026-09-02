import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { routeOf } from '../http/request-route';
import { httpStatusOf, type ResponseCode } from '../http/response-code';
import { failureEnvelope } from '../http/response-envelope';
import { StructuredLogger } from '../logging/logger';
import { ApiFailure } from './api-failure';

/**
 * O tratador global de exceções, único e residente em `shared/` (`ADR-0022` §11).
 *
 * Classifica em **esperada** e **inesperada** (§12), e a diferença é o que vaza:
 *
 *   esperada    o código do catálogo, o status HTTP correspondente e, na validação, um
 *               item por campo (§13, `ADR-0025` §16).
 *   inesperada  `500`, `data` nulo, nenhum `errors` e nenhum detalhe interno (§14, §15,
 *               `ADR-0025` §19). Nem mensagem de exceção, nem rastro de pilha, nem nome
 *               de componente — o que se sabe do erro fica no log, do lado de cá.
 *
 * O identificador de correlação já está no objeto de resposta quando este tratador
 * assume: o middleware o escreve antes de o controlador executar, justamente para que a
 * falha inesperada não dependa de o caminho feliz ter chegado a algum lugar.
 *
 * `ADR-0022` §16 a §25 — o registro agregado por assinatura — **não** entra aqui: exige
 * fila dedicada, consumidor próprio e o módulo de observabilidade, e é mudança própria.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger('shared');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const route = routeOf(request);
    const method = request.method;

    if (exception instanceof ApiFailure) {
      this.logger.info('REQUEST_FAILED', {
        route,
        method,
        statusCode: httpStatusOf(exception.code),
        responseCode: exception.code,
        failureClass: 'expected',
      });

      response
        .status(httpStatusOf(exception.code))
        .json(failureEnvelope(exception.code, exception.fields));

      return;
    }

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const code = codeForHttpStatus(exception.getStatus());

      this.logger.info('REQUEST_FAILED', {
        route,
        method,
        statusCode: httpStatusOf(code),
        responseCode: code,
        failureClass: 'expected',
      });

      response.status(httpStatusOf(code)).json(failureEnvelope(code));

      return;
    }

    this.logger.error('REQUEST_FAILED', {
      route,
      method,
      statusCode: 500,
      responseCode: 'INTERNAL_ERROR',
      failureClass: 'unexpected',
      errorName: exception instanceof Error ? exception.name : typeof exception,
      errorMessage: exception instanceof Error ? exception.message : String(exception),
    });

    response.status(500).json(failureEnvelope('INTERNAL_ERROR'));
  }
}

/**
 * O status que o framework escolheu, traduzido para o catálogo.
 *
 * Alcança as falhas que o NestJS produz antes de o código do projeto executar — rota
 * inexistente, método não permitido, corpo ilegível. Elas são esperadas: o cliente errou
 * a requisição, e a resposta precisa dizer isso com um código que ele traduza.
 */
function codeForHttpStatus(status: number): ResponseCode {
  switch (status) {
    case 401:
      return 'AUTHENTICATION_FAILED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    default:
      return 'VALIDATION_FAILED';
  }
}
