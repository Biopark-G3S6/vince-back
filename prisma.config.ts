import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'prisma/config';

/**
 * O arquivo de schema de cada módulo reside DENTRO do módulo (ADR-0010 §3):
 *
 *   src/modules/<modulo>/<modulo>.prisma
 *
 * O Prisma descobre os arquivos recursivamente a partir da pasta configurada.
 * A configuração de gerador e fonte de dados fica em `src/modules/_datasource.prisma`.
 *
 * O diretório de migrações geradas é único para a aplicação (ADR-0010 §10 e
 * ADR-0006 §9): a propriedade da migração pelo módulo é expressa pela residência
 * do arquivo de schema, e preservada por revisão de código (ADR-0010 §13).
 */

// Com prisma.config.ts, o Prisma não carrega .env automaticamente.
if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: path.join('src', 'modules'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
});
