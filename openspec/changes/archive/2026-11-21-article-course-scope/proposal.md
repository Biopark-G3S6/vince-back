## Why

`RF-ART-001` RN3 restringe o coordenador aos artigos **do seu curso**. Hoje o coordenador lê os
artigos da instituição inteira, pela listagem e pela consulta por identificador — registrado como
pendência na primeira rodada da integração.

## What Changes

- O coordenador passa a alcançar os artigos dos cursos que coordena (somados ao que já alcança como
  integrante, orientador responsável ou orientador de evento).
- O administrador institucional continua alcançando a instituição inteira.
- Artigo fora do alcance responde `RESOURCE_NOT_FOUND`, como hoje.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `article-listing`: alcance do coordenador restrito aos cursos coordenados.

## Impact

- `src/modules/article/application/article-scope.ts` e o filtro do repositório.
