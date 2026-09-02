import { SetMetadata, type CustomDecorator } from '@nestjs/common';

/**
 * A declaração de acesso da rota (decisão D4, `ADR-0014` §11).
 *
 * **A declaração é obrigatória, e o esquecimento falha na inicialização.** É a razão de
 * ser deste arquivo: a falha típica da guarda por rota não é a regra errada, é a rota
 * nova que não declara nada — e essa falha é aberta e silenciosa. Aqui ela é fechada e
 * barulhenta, antes de a aplicação escutar em porta alguma.
 *
 * São três declarações, e não duas, porque a URS tem três casos:
 *
 *   `@PublicRoute()`          RF-ACS-001 e RF-ACS-003 — "Permissões geradas: — (acesso
 *                             público)". Não exige sessão.
 *   `@AuthenticatedRoute()`   RF-ACS-002, RF-ACS-004 e RF-ACS-005 — "— (própria sessão)",
 *                             "— (própria conta)", "— (próprio perfil)". Exige sessão e
 *                             **nenhuma permissão**: a titularidade é verificada dentro do
 *                             caso de uso (`ADR-0014` §12), e transformá-la em permissão é
 *                             proibido por §13 e produziria permissão sem RF de origem (§7).
 *   `@RequiresPermission(P)`  o caso comum: exige sessão e a permissão `P`.
 *
 * Sem `@AuthenticatedRoute()`, a rota do perfil próprio exigiria inventar `USER:READ_SELF`
 * — exatamente o que `ADR-0014` §7 e §13 vedam.
 */

export const ROUTE_PUBLIC_KEY = 'vince:route:public';
export const ROUTE_AUTHENTICATED_KEY = 'vince:route:authenticated';
export const ROUTE_PERMISSION_KEY = 'vince:route:permission';

/** Acesso sem sessão. Também é o que marca saúde e métricas (`ADR-0025` §2). */
export const PublicRoute = (): CustomDecorator => SetMetadata(ROUTE_PUBLIC_KEY, true);

/** Exige sessão e nenhuma permissão nomeada. */
export const AuthenticatedRoute = (): CustomDecorator => SetMetadata(ROUTE_AUTHENTICATED_KEY, true);

/** Exige sessão e a permissão informada, do catálogo do módulo que a declara. */
export const RequiresPermission = (permission: string): CustomDecorator =>
  SetMetadata(ROUTE_PERMISSION_KEY, permission);

/** As três chaves, para quem precise perguntar se **alguma** declaração existe. */
export const ROUTE_ACCESS_KEYS = [
  ROUTE_PUBLIC_KEY,
  ROUTE_AUTHENTICATED_KEY,
  ROUTE_PERMISSION_KEY,
] as const;
