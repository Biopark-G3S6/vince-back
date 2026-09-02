import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { API_PATH_PREFIX } from '@shared/config/environment';
import { correlationMiddleware } from '@shared/correlation/correlation.middleware';
import { assertEveryRouteDeclaresAccess } from '@shared/http/route-access-check';

/**
 * A configuração da borda HTTP, em um lugar só.
 *
 * Está aqui, e não dentro de `main.ts`, para que o teste de contrato de API
 * (`ADR-0024` §1) exercite **a mesma** configuração que a aplicação usa. Montar a borda
 * duas vezes — uma para produção, outra para o teste — é como o teste passa a aprovar um
 * sistema que não existe.
 */
export function configureApi(app: INestApplication): void {
  // A correlação vem antes de tudo, inclusive do roteador: `ADR-0025` §30 quer
  // `X-Correlation-Id` em TODA resposta, e o `404` de rota inexistente é uma delas.
  app.use(correlationMiddleware);

  // A credencial de sessão trafega em cookie (`ADR-0013` §8), e alguém precisa lê-lo.
  app.use(cookieParser());

  app.enableCors({
    // Lista explícita de origens; curinga é proibido (`ADR-0017` §10).
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  // Versionamento por prefixo de caminho (`ADR-0017` §7).
  app.setGlobalPrefix(API_PATH_PREFIX.replace(/^\//, ''));

  publishOpenApi(app);

  // A última coisa antes de servir: rota que não declara o seu acesso não é servida
  // (decisão D4). A recusa é aqui, e não em produção.
  assertEveryRouteDeclaresAccess(app);
}

/**
 * A especificação gerada **do próprio código** (`ADR-0017` §1).
 *
 * É dela que o cliente deriva os seus tipos (§2), e é por isso que ela não é escrita à
 * mão: endpoint novo passa a constar sem que ninguém edite documento algum, e endpoint
 * que mude de forma muda a especificação no mesmo commit.
 */
function publishOpenApi(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('VinceArt — API')
      .setDescription(
        'Toda resposta de negócio usa o envelope de `ADR-0025`: `data` e `status`, com ' +
          '`status.code` do catálogo da URS §2.4. A tradução para exibição é do cliente ' +
          '(`ADR-0026` §14) — o servidor não devolve texto redigido para o usuário.',
      )
      .setVersion('v1')
      .build(),
  );

  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/openapi.json' });
}
