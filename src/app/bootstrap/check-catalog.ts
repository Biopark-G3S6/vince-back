import { resolve } from 'node:path';

import { RESPONSE_CODES } from '@shared/http/response-code';

import { AccessModule } from '@modules/access/access.module';

import {
  compareCatalogs,
  compareResponseCodes,
  describeComparison,
  describeResponseCodes,
  isMatch,
  isResponseCodeMatch,
  parseUrsCatalog,
  parseUrsResponseCodes,
  readUrs,
} from './catalog-check';

/**
 * `pnpm run docs:check-catalog` — confronta os catálogos declarados no repositório com os
 * da URS, e relata as diferenças nos dois sentidos:
 *
 *   §2.3 e §2.3.1  permissões e composição dos papéis (`ADR-0027` §18)
 *   §2.4           códigos de resposta (`ADR-0025` §20, `PAD-REQ-008`)
 *
 * São duas conferências e não uma porque são duas listas duplicadas, cada uma com o seu
 * par no código. A de §2.4 nasceu depois: até ela existir, `response-code.ts` e a URS
 * podiam divergir sem que nada reclamasse — e chegaram a divergir, quando `SUCCESS` e
 * `INTERNAL_ERROR` entraram no código antes de entrarem na URS.
 *
 * Falha explicitamente quando o submódulo `docs/` não está inicializado: silêncio ali
 * seria pior que erro, porque relataria correspondência sem ter conferido nada.
 *
 * Ambas as conferências rodam SEMPRE, mesmo que a primeira reprove: quem executa o
 * comando quer saber de tudo que está divergente, e não do primeiro problema.
 */
const URS_PATH = resolve(process.cwd(), 'docs', 'Requisitos', 'URS.md');

function main(): void {
  const markdown = readUrs(process.argv[2] ?? URS_PATH);

  const declared = AccessModule.declaredCatalog();
  const permissions = compareCatalogs(declared, parseUrsCatalog(markdown));
  const codes = compareResponseCodes(RESPONSE_CODES, parseUrsResponseCodes(markdown));

  const report = (text: string, matched: boolean): void => {
    if (matched) {
      process.stdout.write(text);

      return;
    }

    process.stderr.write(text);
    process.exitCode = 1;
  };

  report(describeComparison(permissions, declared), isMatch(permissions));
  report(describeResponseCodes(codes, RESPONSE_CODES), isResponseCodeMatch(codes));
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
