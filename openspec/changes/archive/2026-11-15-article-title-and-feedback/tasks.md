## 1. Persistência

- [x] 1.1 Colunas `article.title` e `article_assessment.feedback`, com migração SQL escrita à mão; verificar com `prisma migrate deploy`

## 2. Título

- [x] 2.1 `articleTitle` opcional na criação da equipe, levado no `TeamCreated` e gravado pelo consumidor do artigo; verificar com teste HTTP
- [x] 2.2 `title` na consulta e na listagem, e `PATCH /articles/:articleId` com `ARTICLE:EDIT`; verificar com teste HTTP

## 3. Parecer

- [x] 3.1 `feedback` na nota do artigo e na consulta das avaliações, recusado na nota individual; verificar com teste HTTP

## 4. Verificação

- [x] 4.1 `pnpm run verify` verde e `openspec validate article-title-and-feedback --strict` sem erros
