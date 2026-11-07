# Módulo `article`

Mantém a situação do artigo, as suas avaliações auditáveis e os registros de publicação externa
(`ADR-0030`). Equipe, evento, curso e usuário são referências opacas: participação, orientação,
responsabilidade direta e coordenação são confirmadas pelas fachadas dos módulos proprietários.

## Fronteira

```
article/
  contracts/        ArticleFacade, DTOs e fatos de contrato
  domain/           entidades, faixa de nota, validação de publicação, ports
  application/      casos de uso, resolução de alcance e consumo de fatos
  infrastructure/   cliente Prisma escopado e repositório
  presentation/     controllers HTTP e DTOs de entrada/OpenAPI
  article.module.ts composition root do módulo
```

## O artigo não é criado por ninguém daqui

Ele nasce do consumo de `TeamCreated` (`ADR-0030` §9), publicado por `team`. A idempotência é do
**índice único** sobre `team_id`: a reentrega do mesmo fato encontra o artigo e conclui. O consumo
não participa da transação de `team` e não a reverte (§11) — equipe sem artigo é estado eventual
legítimo até o consumidor convergir.

## O histórico só cresce

Cada gravação de nota — do artigo ou individual — escreve a visão corrente e **acrescenta** uma
linha ao histórico, na mesma transação (§7, §8). Nada aqui altera ou remove linha histórica: autor e
instante de cada versão são a evidência que `RF-ART-002` RN3 e `RF-ART-003` RN3 exigem.

A nota individual guarda um instantâneo da participação avaliada (§15). É o que mantém consultável a
nota de quem foi removido da equipe depois de avaliado — sem reativar o vínculo.

## Três alcances distintos

`application/article-scope.ts` separa o que a URS separa: **ler** (integrante, inclusive quem saiu;
orientador do evento; coordenador do curso), **registrar publicação** (integrante ativo e orientador
do evento) e **avaliar** (somente o orientador responsável pela equipe). Orientador do evento sem
responsabilidade direta lê tudo e avalia nada — daí a recusa de avaliação ser `PERMISSION_DENIED`, e
não `RESOURCE_NOT_FOUND`: quem chegou lá já provou que alcança o artigo.
