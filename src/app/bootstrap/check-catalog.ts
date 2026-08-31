import { resolve } from 'node:path';

import { AccessModule } from '@modules/access/access.module';

import { compareCatalogs, describeComparison, isMatch, readUrsCatalog } from './catalog-check';

/**
 * `pnpm run docs:check-catalog` — confronta o catálogo declarado no repositório com o
 * da URS §2.3 e §2.3.1, e relata as diferenças nos dois sentidos (ADR-0027 §18).
 *
 * Falha explicitamente quando o submódulo `docs/` não está inicializado: silêncio ali
 * seria pior que erro, porque relataria correspondência sem ter conferido nada.
 */
const URS_PATH = resolve(process.cwd(), 'docs', 'Requisitos', 'URS.md');

function main(): void {
  const declared = AccessModule.declaredCatalog();
  const urs = readUrsCatalog(process.argv[2] ?? URS_PATH);
  const comparison = compareCatalogs(declared, urs);

  if (isMatch(comparison)) {
    process.stdout.write(describeComparison(comparison, declared));

    return;
  }

  process.stderr.write(describeComparison(comparison, declared));
  process.exitCode = 1;
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
