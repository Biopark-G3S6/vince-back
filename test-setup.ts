/**
 * Preparação do ambiente de teste (ADR-0024 §11 a §15).
 *
 * Cada processo paralelo opera em base própria, identificada por VITEST_POOL_ID (§11).
 * As tabelas são truncadas entre testes (§12).
 *
 * Por que base própria e não schema próprio: o recurso de múltiplos schemas do Prisma
 * grava o nome do schema no cliente gerado (`@@schema("access")`), de modo que ele não
 * pode variar por processo. A base por processo entrega a garantia que §11 persegue —
 * nenhum processo trunca a tabela de outro — preservando os nomes de schema que a
 * migração cria. Dentro da base, os schemas são os mesmos de produção, criados pelas
 * migrações versionadas e removidos ao final (ADR-0018 §8).
 *
 * Transação revertida NÃO é usada como isolamento (§13): o caso de uso abre a própria
 * transação (ADR-0019 §1), o que produziria aninhamento e commit efetivo.
 *
 * Repositórios são exercitados contra PostgreSQL e Redis reais (§9); substituto em
 * memória é proibido (§10) porque não reproduz transação, índice nem dialeto.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach } from 'vitest';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const poolId = process.env.VITEST_POOL_ID ?? '1';

/** Os schemas que as migrações criam. Truncados entre testes e removidos ao final. */
const MODULE_SCHEMAS = ['access'];

const MIGRATIONS_DIR = join('prisma', 'migrations');

/**
 * A URL configurada, capturada UMA vez, antes de `DATABASE_URL` ser reapontada para a
 * base do processo. Lê-la de novo depois devolveria a base de teste, e o cliente
 * administrativo tentaria criar a base conectando-se a ela mesma.
 */
const CONFIGURED_URL = ((): URL => {
  const raw = (process.env.DATABASE_URL ?? '').trim();

  if (raw.length === 0) {
    throw new Error('DATABASE_URL não está definida. Copie `.env.example` para `.env`.');
  }

  return new URL(raw);
})();

/** A base à qual se conectar para criar outra: nenhuma base se cria de dentro de si. */
const ADMIN_DATABASE = CONFIGURED_URL.pathname.slice(1);

function urlForDatabase(database: string): string {
  const url = new URL(CONFIGURED_URL.toString());
  url.pathname = `/${database}`;

  return url.toString();
}

/**
 * As migrações versionadas, na ordem lexicográfica dos seus diretórios — a mesma que
 * `prisma migrate deploy` usa.
 */
function migrationStatements(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((name) => {
      const file = join(MIGRATIONS_DIR, name, 'migration.sql');

      return existsSync(file) ? splitStatements(readFileSync(file, 'utf8')) : [];
    });
}

/**
 * O SQL das migrações geradas pelo Prisma não contém `;` dentro de literal, então a
 * separação por `;` no fim da linha é suficiente e evita depender do CLI por processo.
 *
 * O Prisma antecede cada comando de uma linha `-- CreateTable` e afins. Elas precisam
 * ser removidas de dentro do comando, e não usadas para descartá-lo: descartar o trecho
 * inteiro por ele começar com `--` deixaria a base sem tabela alguma.
 */
export function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

const testDatabase = `vince_test_${poolId}`;

process.env.DATABASE_URL = urlForDatabase(testDatabase);

let prisma: PrismaClient | undefined;

beforeAll(async () => {
  const admin = new PrismaClient({ datasourceUrl: urlForDatabase(ADMIN_DATABASE) });

  try {
    const existing = await admin.$queryRawUnsafe<{ datname: string }[]>(
      'SELECT datname FROM pg_database WHERE datname = $1',
      testDatabase,
    );

    if (existing.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${testDatabase}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

  // Execução anterior interrompida deixa os schemas de pé, e `CREATE TABLE` não é
  // idempotente: a migração é aplicada sempre sobre base limpa.
  for (const schema of MODULE_SCHEMAS) {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }

  for (const statement of migrationStatements()) {
    await prisma.$executeRawUnsafe(statement);
  }
});

beforeEach(async () => {
  if (prisma === undefined) {
    return;
  }

  const schemaList = MODULE_SCHEMAS.map((schema) => `'${schema}'`).join(', ');

  const tables = await prisma.$queryRawUnsafe<{ qualified: string }[]>(
    `SELECT format('%I.%I', schemaname, tablename) AS qualified
       FROM pg_tables
      WHERE schemaname IN (${schemaList})`,
  );

  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((table) => table.qualified).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
});

afterAll(async () => {
  if (prisma === undefined) {
    return;
  }

  for (const schema of MODULE_SCHEMAS) {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }

  await prisma.$disconnect();
  prisma = undefined;
});
