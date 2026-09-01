import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AccessModule } from '@modules/access/access.module';

import { AppModule } from '../app.module';

/**
 * Carga inicial reproduzível (ADR-0023 §5), acionada por `pnpm run db:seed`.
 *
 * Sobe um contexto Nest autônomo — sem HTTP, sem fila — e invoca o método estático do
 * módulo. A carga não é operação da fachada: expô-la ali faria do catálogo algo
 * alterável por outro módulo, contra a imutabilidade exigida em ADR-0027 §13.
 *
 * `pnpm run db:seed` executa este arquivo **compilado**, e não por um executor de
 * TypeScript em memória. O contêiner de injeção do Nest resolve o construtor pela
 * metadata que `emitDecoratorMetadata` grava; executores baseados em esbuild — `tsx`
 * entre eles — não a emitem, e o provider chega ao caso de uso como `undefined`. A
 * falha aparece só em execução, o que a torna especialmente cara.
 */
async function seed(): Promise<void> {
  const context = await NestFactory.createApplicationContext(AppModule.forRole('api', ['access']), {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const report = await AccessModule.seed(context);

    process.stdout.write(
      `catálogo de acesso carregado: ` +
        `${report.catalog.permissionsCreated} permissões criadas, ` +
        `${report.catalog.rolesCreated} papéis criados, ` +
        `${report.catalog.grantsCreated} vínculos criados, ` +
        `${report.catalog.grantsRemoved} vínculos removidos\n`,
    );

    process.stdout.write(
      `conta inicial de administrador de sistema: ` +
        `${report.systemAdmin.created ? 'criada' : 'já existente'}, ` +
        `identificador ${report.systemAdmin.id}\n`,
    );
  } finally {
    await context.close();
  }
}

seed().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
