# Módulo `event`

Mantém o ciclo de vida do evento, o seu escopo, o cronograma de etapas e a designação dos
orientadores (`ADR-0032`). Instituição, curso, turma e usuário são referências opacas: existência,
estado, titularidade e elegibilidade são confirmados pelas fachadas dos módulos proprietários.

## Fronteira

```
event/
  contracts/       EventFacade, DTOs e fatos de contrato
  domain/          entidades, invariantes de limite e cronograma, ports
  application/     casos de uso, resolução de escopo e consumo de fatos
  infrastructure/  cliente Prisma escopado e repositório
  presentation/    controllers HTTP e DTOs de entrada/OpenAPI
  event.module.ts  composition root do módulo
```

## Duas coisas que este módulo deliberadamente não faz

**Não pergunta pela equipe.** O limite de equipes é declarado aqui e consumido lá. Apurá-lo por
fachada fecharia o ciclo `team` → `event` → `team`, que `ADR-0005` §6 proíbe. O que existe aqui é
uma **projeção** (`teamsInUse`, `largestTeamSize`), alimentada pelos fatos que `team` publica
(`ADR-0032` §16). Ela serve para recusar cedo uma redução de limite; a guarda do limite é a escrita
condicional de quem possui a equipe (§17), e a defasagem da projeção não autoriza equipe acima do
teto.

**Não lê tabela alheia para saber de quem é o alvo.** `application/event-scope.ts` resolve as três
perguntas do escopo — de quem é o alvo, quem ele alcança, quem ele torna elegível — por fachadas, em
lote e com cota fixa de consultas: quatro chamadas para o alcance de um ator, duas para a
elegibilidade de qualquer quantidade de usuários (`ADR-0011` §9).

## Ancestralidade derivada

O evento guarda `institutionId` sempre e `courseId` quando o alvo é curso ou turma (`ADR-0032` §9).
É o que permite responder "os eventos do meu curso" com um predicado indexado, em vez de pedir ao
módulo vizinho a lista de turmas de cada curso. Os dois são imutáveis depois da criação.
