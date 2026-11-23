## Decisions

- **O evento é a fonte do escopo** (`ADR-0005`, `ADR-0006`): curso, instituição e propriedade vêm da
  fachada de `event` (`stateOf`, `isScopeOwner`); o cliente não informa o que o servidor pode deduzir
  (`ADR-0017`).
- **Versão congelada, não a corrente:** a sincronização usa `templateVersionId` gravado na seleção; a
  edição posterior do template não alcança o evento (RN3).
- **Idempotência preservada:** o artigo só recebe o conteúdo na criação; as sincronizações seguintes
  não o tocam.
