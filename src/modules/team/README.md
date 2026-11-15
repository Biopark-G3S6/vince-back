# Módulo `team`

Forma equipes dentro de um evento, mantém os seus integrantes, media o convite de integrante e
registra o orientador responsável (`ADR-0033`). Evento, turma, curso e usuário são referências
opacas: estado, limites, orientação e elegibilidade são confirmados pela fachada de `event`.

## Fronteira

```
team/
  contracts/       TeamFacade, DTOs e fatos de contrato
  domain/          entidades, invariantes de participação, ports
  application/     casos de uso, resolução de escopo e publicação de fatos
  infrastructure/  cliente Prisma escopado, transações serializadas e repositório
  presentation/    controllers HTTP e DTOs de entrada/OpenAPI
  team.module.ts   composition root do módulo
```

## Onde as invariantes de verdade moram

**No banco, não na leitura prévia.** Limite de equipes, lotação e unicidade de participação são
conferidos **dentro** da transação de escrita (`ADR-0033` §14, §15). A transação começa com
`pg_advisory_xact_lock` sobre a chave de negócio — o evento, para criar equipe; a equipe, para
admitir integrante —, porque sob `READ COMMITTED` duas transações concorrentes contariam as mesmas
linhas e ambas gravariam. O índice único parcial `(event_id, user_id)` sobre as participações ativas
é a segunda rede: ele é parcial para que a remoção não impeça o reingresso.

**No instante do aceite, não no da emissão.** O convite não reserva vaga. Prazo, elegibilidade,
unicidade e lotação são reavaliados quando o aluno aceita (`RF-EQP-004` RN2) — a vaga pode ter sido
preenchida no meio.

## O artigo não nasce aqui

A criação da equipe grava `TeamCreated` na outbox, na mesma transação, e `article` o consome para
criar o artigo `STARTED` (`ADR-0033` §17, §18). A transação não espera por esse consumo e nenhum
consumidor pode desfazê-la: o artigo temporariamente ausente é estado eventual legítimo (§21).

Os fatos de composição transportam a **contagem resultante** (§20), apurada dentro da transação. É
disso que `event` alimenta a sua projeção de uso sem perguntar nada de volta — o que fecharia o
ciclo que `ADR-0005` §6 proíbe.
