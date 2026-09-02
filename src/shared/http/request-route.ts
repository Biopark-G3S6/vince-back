import type { Request } from 'express';

/**
 * O padrão da rota que atendeu a requisição — `/profile`, e não `/profile?x=1`.
 *
 * O padrão, e não o caminho concreto, é o que serve ao log e à métrica: `/users/:id`
 * agrega, e `/users/8f3a...` produziria uma série por usuário — e levaria identificador
 * para dentro do registro, que é o que `ADR-0022` §4 quer evitar.
 *
 * A leitura passa por aqui porque `Request.route` é `any` na tipagem do Express, e
 * `any` atravessando o código é exatamente o que a análise estática deste repositório
 * recusa.
 */
export function routeOf(request: Request): string {
  const route: unknown = (request as { route?: unknown }).route;

  if (typeof route === 'object' && route !== null) {
    const path: unknown = (route as { path?: unknown }).path;

    if (typeof path === 'string') {
      return path;
    }
  }

  return request.path;
}
