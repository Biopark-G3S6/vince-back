# Módulo `institution`

A instituição como **fronteira de isolamento** do sistema (`ADR-0028`). RF-INS-001 RN1 declara que
todo curso, turma, evento, equipe, artigo e usuário pertence a exatamente uma instituição — este
módulo é o dono desse conceito: sua existência, seus dados de identificação, seu estado ativo ou
inativo, e quem a administra.

**Não** responde identidade, credencial, papel ou permissão: isso é do `access` (`ADR-0027 §1`).
**Não** responde curso, turma, evento, equipe ou artigo: cada um pertence ao módulo que vier a ser
declarado seu proprietário (`ADR-0028 §3`).

## A direção da dependência

Este módulo **chama** a fachada do `access`; o `access` não chama a dele (`ADR-0027 §9`,
`ADR-0028 §16`). É a primeira dependência síncrona entre módulos de negócio do sistema, e ela
aponta para o `access` porque ele é módulo folha — a direção contrária fecharia o ciclo que
`ADR-0005 §6` proíbe.

Consequência que vale para todo o sistema: **o identificador de instituição chega ao `access` já
validado por quem o forneceu**, e não é validado por ele (`ADR-0028 §24`, `§25`). Toda designação e
todo convite passam a ser emitidos pelo módulo dono do escopo — o que coincide com a cadeia de
designação da URS: RF-INS-002 é do administrador de sistema sobre a instituição, RF-CUR-002 do
administrador institucional sobre o curso, RF-TUR-002 do coordenador sobre a turma.

## O que ele possui

Schema `institution` no PostgreSQL. Tabelas declaradas em `institution.prisma`:

| Tabela              | Guarda                                                       |
| :------------------ | :----------------------------------------------------------- |
| `institution`       | a instituição, seus dados de identificação e seu estado      |
| `institution_admin` | o vínculo de administração entre uma conta e uma instituição |

Tabela fora dessa lista **não** nasce aqui sem reescrever o ADR (`ADR-0028 §6`).

### Os dados de identificação

Decididos com a parte interessada em 2026-09-02, antes de a migração ser gerada: `name` e `code`
obrigatórios; `cnpj`, `website` e `contactEmail` opcionais. O núcleo obrigatório é pequeno de
propósito — acrescentar coluna opcional depois é barato, acrescentar coluna obrigatória exige valor
para toda linha existente (`ADR-0028 §7`).

`code` é a sigla, única e gravada em caixa alta; `cnpj` é único e gravado **só com dígitos**. Os
dois são normalizados antes de comparar e antes de gravar, e é isso que faz da unicidade do banco a
própria regra: não há duas grafias do mesmo valor no índice.

### O vínculo de administração

`institution_admin` é chave primária composta pelas duas referências (`ADR-0018 §11`). `user_id`
referencia a conta, que é do módulo `access`: coluna indexada, **sem** chave estrangeira
(`ADR-0028 §8`). O índice não é formalidade — a revogação pergunta se resta outro vínculo daquele
usuário (RF-INS-002 RN3), e essa consulta filtra por ele.

**É o vínculo que dá escopo ao papel, e não o contrário.** `INSTITUTION_ADMIN` é papel global
(`ADR-0027 §16`, RF-INS-002 RN2); quem diz _de qual_ instituição alguém é administrador é a linha
desta tabela.

## O estado, e o que ele alcança

`active` **não é exclusão lógica** (`ADR-0018 §18`, `ADR-0028 §9`): tem significado de negócio —
usuário de instituição inativa não autentica (RF-INS-001 RN2) —, a instituição inativa continua a
ser consultada e listada, e nenhuma consulta a filtra implicitamente.

A desativação é aceita ainda que existam cursos ativos (RF-INS-001 E2), é idempotente, e **não
remove** a instituição nem registro associado a ela (`§10`, `§11`).

O efeito sobre o acesso é indireto, e é assim por imposição de ADR:

- a instituição inativa **zera as permissões efetivas** dos seus usuários (`ADR-0028 §12`);
- ela **não encerra sessão** — `ADR-0013 §18` proíbe módulo de invalidar sessão, e `§15` proíbe
  consulta ao banco relacional na resolução dela.

O resultado prático é `403` em toda rota protegida. O usuário de instituição desativada permanece
numa aplicação em que nada funciona, em vez de ser levado à autenticação, porque `ADR-0017 §17`
determina que `403` não encerre a sessão no cliente. É gap declarado: o fecho correto depende do
relay de `ADR-0021` (`ADR-0028`, implicação 3).

A composição entre "permissões efetivas do `access`" e "estado da instituição" **não** é chamada de
um módulo ao outro: mora no composition root, em `src/app/auth/access-auth-ports.ts`, sobre o port
`InstitutionAccess` de `shared/` (`ADR-0028 §13`, decisão D5).

## A designação, e por que ela não é atômica

`ADR-0005 §7` proíbe um módulo de participar da transação de outro. A designação atribui o papel
pelo `access` e grava o vínculo aqui — **duas transações**. A ordem é papel primeiro, vínculo
depois, e ambas as operações são idempotentes (`ADR-0028 §18`).

É a idempotência, e não a atomicidade, que fecha a operação: repetir a designação conclui a que
ficou pela metade. Das duas falhas parciais possíveis, esta é a inócua — papel sem vínculo não
autoriza nada, porque `ADR-0014 §12` obriga a verificação de titularidade dentro do caso de uso. A
ordem inversa produziria vínculo sem papel, que aparenta designação concluída e não funciona.

## A paginação

Esta é a **primeira listagem do sistema**, e a forma que ela estabelece é a que as próximas copiam
(`ADR-0025 §21 a §25`, `shared/http/pagination.ts`):

- a página é buscada com **um registro além** do tamanho pedido, e o excedente responde `hasNext`
  sem consulta de contagem (`§23`);
- `totalItems` e `totalPages` só são apurados sob pedido explícito (`§24`), e custam a segunda
  consulta;
- `pageSize` acima de 100 é **truncado**, nunca recusado (`§25`, `ADR-0011 §7`), e a resposta
  informa o tamanho efetivo.

A contagem de consultas é invariante em relação à quantidade de registros devolvidos
(`ADR-0011 §9`, `§10`), e há teste que reprova o build se deixar de ser.

## Os dois caches

| Cache                 | Chave                    | Invalidado por          |
| :-------------------- | :----------------------- | :---------------------- |
| Estado da instituição | `institution:state:<id>` | desativação, reativação |

A chave é **por instituição, não por usuário**, e é isso que atende `ADR-0011 §13`: a desativação
invalida uma chave, qualquer que seja a quantidade de usuários afetados. Instituição inexistente
**não** é gravada — não há escrita que invalide a sua chave, e o resíduo seria herdado pelo cadastro
de uma instituição de mesmo identificador.

**Falha fechada:** o erro do Redis sobe. Devolver "ativa" diante de indisponibilidade concederia
acesso a usuário de instituição desativada; devolver "inativa" negaria acesso legítimo em massa e
esconderia a queda.

## Permissões

`INSTITUTION:CREATE`, `INSTITUTION:READ`, `INSTITUTION:UPDATE`, `INSTITUTION:DEACTIVATE`,
`INSTITUTION:ASSIGN_ADMIN` e `INSTITUTION:REVOKE_ADMIN` — todas do `SYSTEM_ADMIN` (URS §2.3.1). O
catálogo é declarado no módulo `access` (`ADR-0027 §17`); aqui elas apenas são **exigidas**.

`INSTITUTION:CONSENT_AI` (RF-IAA-005) não é desta vertical: pertence à assistência automatizada,
cujo teor e base legal a URS §3, item 12, registra como indefinidos.

## Onde encontrar

```
institution/
  contracts/       InstitutionFacade e DTOs — a única superfície pública
  domain/          a entidade, as regras de validação e os ports
  application/     os casos de uso, um método público de execução cada
  infrastructure/  repositórios Prisma, cliente escopado e cache Redis
  presentation/    os controllers de RF-INS-001 e RF-INS-002
```

O cliente Prisma escopado (`infrastructure/institution-prisma.ts`) é o que torna `ADR-0028 §17`
verificável e não apenas combinado: o módulo não consegue escrever em `access.user_role` nem que
queira — o model não existe no tipo, e o gancho de consulta o recusaria em execução.
