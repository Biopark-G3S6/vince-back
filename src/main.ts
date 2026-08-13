import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { resolveModules, resolveRole } from './app/bootstrap/role';

/**
 * Ponto de entrada único para todos os papéis (ADR-0008 §1).
 *
 *   ROLE=api    registra os controllers HTTP, sem processadores de fila (§4)
 *   ROLE=worker registra os processadores de fila, sem HTTP salvo saúde (§5)
 *   ROLE=relay  publica os eventos do outbox, sem HTTP salvo saúde (§13)
 */
async function bootstrap(): Promise<void> {
  const role = resolveRole();
  const modules = resolveModules();

  const app = await NestFactory.create(AppModule.forRole(role, modules), {
    // O log estruturado em saída padrão é o canal primário (ADR-0022 §1, §2).
    bufferLogs: true,
  });

  if (role === 'api') {
    app.enableCors({
      // Lista explícita de origens; curinga é proibido (ADR-0017 §10).
      origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
      // A credencial de sessão trafega em cookie (ADR-0013 §8).
      credentials: true,
    });

    // Versionamento por prefixo de caminho (ADR-0017 §7).
    app.setGlobalPrefix('api/v1');
  }

  const port =
    role === 'api' ? Number(process.env.PORT ?? 3000) : Number(process.env.HEALTH_PORT ?? 3001);

  await app.listen(port);
}

void bootstrap();
