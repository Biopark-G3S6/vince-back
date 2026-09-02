import { PATH_METADATA } from '@nestjs/common/constants';
import type { INestApplicationContext } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { ROUTE_ACCESS_KEYS } from './route-access';

/**
 * A verificação, **na inicialização**, de que toda rota declara o seu acesso (decisão D4).
 *
 * É o mecanismo inteiro da decisão. Sem ela, `@RequiresPermission` seria só mais um
 * decorador que se esquece de escrever — e o esquecimento produziria uma rota aberta, sem
 * erro, sem aviso e sem teste que a apanhasse, porque nada nela está errado: falta.
 *
 * Aqui a falta para o processo antes de ele escutar em porta alguma, e a mensagem nomeia
 * o controlador e o método. É deliberadamente impossível subir a aplicação com uma rota
 * indeclarada.
 */
export class UndeclaredRouteAccessError extends Error {
  constructor(readonly routes: readonly string[]) {
    super(
      'Rotas sem declaração de acesso. Cada uma DEVE usar `@PublicRoute()`, ' +
        '`@AuthenticatedRoute()` ou `@RequiresPermission(...)` (ADR-0014 §11):\n  ' +
        routes.join('\n  '),
    );
    this.name = 'UndeclaredRouteAccessError';
  }
}

export function assertEveryRouteDeclaresAccess(app: INestApplicationContext): void {
  const discovery = app.get(DiscoveryService);
  const reflector = app.get(Reflector);
  const scanner = new MetadataScanner();

  const undeclared: string[] = [];

  for (const wrapper of discovery.getControllers()) {
    const instance: unknown = wrapper.instance;
    const metatype = wrapper.metatype;

    if (
      instance === undefined ||
      instance === null ||
      metatype === undefined ||
      metatype === null
    ) {
      continue;
    }

    const prototype = Object.getPrototypeOf(instance) as object;

    for (const method of scanner.getAllMethodNames(prototype)) {
      const handler: unknown = (prototype as Record<string, unknown>)[method];

      // Sem metadado de caminho, o método é auxiliar do controlador, e não uma rota.
      if (
        typeof handler !== 'function' ||
        Reflect.getMetadata(PATH_METADATA, handler) === undefined
      ) {
        continue;
      }

      const declared = ROUTE_ACCESS_KEYS.some(
        (key) => reflector.getAllAndOverride<unknown>(key, [handler, metatype]) !== undefined,
      );

      if (!declared) {
        undeclared.push(`${metatype.name}.${method}`);
      }
    }
  }

  if (undeclared.length > 0) {
    throw new UndeclaredRouteAccessError(undeclared);
  }
}
