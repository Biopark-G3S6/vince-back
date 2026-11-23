## 1. Implementação

- [x] 1.1 Seleção pelo evento: escopo e dono via `EventFacade`
- [x] 1.2 Consulta da seleção por evento; artigo da equipe nasce com a versão congelada

## 2. Verificação

- [x] 2.1 Teste HTTP: template de curso selecionado sem `courseId`; não dono recusado; segunda seleção recusada; artigo nasce com o conteúdo da versão congelada mesmo após editar o template
- [x] 2.2 `pnpm run verify` verde e `openspec validate template-selection-from-event --strict`
