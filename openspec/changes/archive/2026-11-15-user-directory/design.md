## Context

- `AccessGuard` aceita uma única permissão por rota. A titularidade e as regras finas ficam no caso de
  uso (`ADR-0014` §12).
- O catálogo de permissões deriva da URS (`PAD-REQ-*`), e nenhum requisito gera permissão de leitura
  de usuários.
- A conformidade legal de dados pessoais é decisão pendente (`PAD-SEG-015`). Por isso a mudança expõe
  o mínimo de dado pessoal.

## Goals / Non-Goals

**Goals:** destravar a escolha de pessoa e a exibição de nomes nas telas de designação.

**Non-Goals:**

- Manutenção de usuários: criar, alterar ou desativar por outro.
- Busca entre instituições para usuários comuns.

## Decisions

1. **Rota `@Authenticated()` com autorização no caso de uso, sem permissão nova.**
   - O conjunto de permissões aceitas é exatamente o dos requisitos que precisam escolher alguém.
   - Alternativa rejeitada: criar `USER:READ`. Seria uma permissão que nenhum requisito gera, fora da
     regra de catálogo derivado.
   - Alternativa rejeitada: enriquecer o DTO de cada módulo com nomes. Exigiria que cada módulo
     consultasse `access` em toda listagem, gerando N chamadas de fachada e mudança de contrato em
     seis módulos.
2. **Dois modos na mesma rota.**
   - Com `ids`, é a resolução de nomes, aberta e sem e-mail.
   - Sem `ids`, é a busca, restrita e com e-mail.
   - O cliente faz a junção a partir das listagens que já recebe.
3. **Consulta única.** `where institution_id = ? and (name ilike ? or email ilike ?)`. O filtro de
   papel usa `some` em `user_role`. A paginação segue o `ADR-0025`. Não há consulta por item
   (`ADR-0011`).

## Risks / Trade-offs

- [Exposição de e-mails a quem tem permissão de designação] → a exposição é restrita à própria
  instituição e a quem já designa pessoas nela, e é revisitada quando a decisão de dados pessoais
  sair.
