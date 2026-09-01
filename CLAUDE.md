# VinceArt — Backend

Monolito modular em NestJS. Este arquivo é o **índice de navegação** do repositório: onde está cada
regra, o que ela governa e como uma mudança nasce. Ele não repete as regras — aponta para elas.

A mecânica do repositório — como subir, comandos, estrutura de diretórios — está em
[`README.md`](README.md). Cada diretório de `src/` tem um README com as regras que valem ali.

---

## 1. A hierarquia normativa

Quatro fontes, com papéis que não se sobrepõem. Antes de escrever qualquer linha, saiba de qual
delas a exigência veio.

| Fonte                                                    | Declara                                                           | Quem decide           |
| :------------------------------------------------------- | :---------------------------------------------------------------- | :-------------------- |
| [`docs/Requisitos/URS.md`](docs/Requisitos/URS.md)       | O que o **cliente** precisa que o sistema faça (`RF-<GRP>-<NNN>`) | Partes interessadas   |
| [`docs/ADR/`](docs/ADR/)                                 | **Como** a equipe decidiu construir, com alternativas rejeitadas  | Equipe, em ADR        |
| [`docs/Padroes/`](docs/Padroes/Padroes-de-Engenharia.md) | O critério de conformidade (`PAD-<CAT>-<NNN>`)                    | Derivado dos ADRs     |
| [`openspec/`](openspec/)                                 | A mudança em curso e o contrato de comportamento do construído    | Proposta, por mudança |

`docs/` é submódulo de [vince-docs](https://github.com/Biopark-G3S6/vince-docs) e é a fonte da
verdade. **Divergência entre este código e um ADR é defeito, não estilo.** Alterar uma regra exige
reescrever o ADR correspondente — nunca contorná-lo, nunca duplicá-lo aqui (`PAD-TEC-015`).

Termos normativos, em toda a documentação: **DEVE** é obrigatório, **NÃO DEVE** é proibido, **PODE**
é permitido sem obrigação. Violação de `DEVE`/`NÃO DEVE` reprova a entrega.

Atualizar a documentação: `pnpm run docs:update`.

---

## 2. Índice dos ADRs

27 decisões, todas em `Aceito`. O índice canônico, com status e datas, está em
[`docs/ADR/README.md`](docs/ADR/README.md); a coluna abaixo diz **quando abrir cada uma**.

| ADR                                                                    | Decide                                       | Abra quando                                         |
| :--------------------------------------------------------------------- | :------------------------------------------- | :-------------------------------------------------- |
| [0000](docs/ADR/0000-adocao-de-adrs.md)                                | Adoção e processo de ADR                     | For registrar ou revisar uma decisão                |
| [0001](docs/ADR/0001-monolito-modular.md)                              | Monolito modular                             | Alguém sugerir extrair um serviço                   |
| [0002](docs/ADR/0002-stack-backend-nestjs.md)                          | NestJS + TypeScript estrito                  | Questionar framework ou configuração de compilador  |
| [0003](docs/ADR/0003-fronteira-e-estrutura-de-modulo.md)               | Fronteira e camadas do módulo                | Criar módulo ou colocar um arquivo em alguma camada |
| [0004](docs/ADR/0004-fachada-como-superficie-publica.md)               | Fachada abstrata em `contracts/`             | Expor algo de um módulo para outro                  |
| [0005](docs/ADR/0005-comunicacao-entre-modulos.md)                     | Evento como padrão; síncrono só via fachada  | Um módulo precisar falar com outro                  |
| [0006](docs/ADR/0006-propriedade-de-dados-por-modulo.md)               | Propriedade exclusiva de dados               | Precisar de dado que é de outro módulo              |
| [0007](docs/ADR/0007-enforcement-de-fronteiras.md)                     | Fronteira imposta por análise estática       | O lint reprovar uma importação                      |
| [0008](docs/ADR/0008-escalabilidade-por-papel-de-processo.md)          | Papéis `api`, `worker`, `relay`              | Mexer no bootstrap ou pensar em escala              |
| [0009](docs/ADR/0009-dry-e-shared-kernel.md)                           | Escopo de `shared/`, DRY com limite          | Sentir vontade de extrair código repetido           |
| [0010](docs/ADR/0010-camada-http-e-orm.md)                             | Express e Prisma                             | Mexer em controller, schema Prisma ou migração      |
| [0011](docs/ADR/0011-desempenho-e-prevencao-de-n-mais-1.md)            | Metas de desempenho, N+1                     | Escrever consulta em laço ou paginação              |
| [0012](docs/ADR/0012-retentativa-e-dead-letter-queue.md)               | Retentativa e DLQ                            | Escrever consumidor de fila                         |
| [0013](docs/ADR/0013-autenticacao-por-sessao-opaca.md)                 | Sessão opaca em cookie                       | Tocar em login, sessão ou cookie                    |
| [0014](docs/ADR/0014-autorizacao-rbac-e-delegacao.md)                  | RBAC e delegação de permissões               | Proteger uma rota ou criar permissão                |
| [0015](docs/ADR/0015-arquitetura-do-frontend.md)                       | Arquitetura do frontend                      | Precisar do outro lado do contrato de integração    |
| [0016](docs/ADR/0016-stack-do-frontend.md)                             | React, Vite, Tailwind                        | Precisar do outro lado do contrato de integração    |
| [0017](docs/ADR/0017-contrato-de-integracao-frontend-backend.md)       | Contrato, CORS, CSRF, versionamento          | Criar ou alterar endpoint público                   |
| [0018](docs/ADR/0018-organizacao-fisica-do-banco-de-dados.md)          | Schemas, nomes, ausência de FK entre módulos | Escrever `.prisma` ou migração                      |
| [0019](docs/ADR/0019-transacoes-e-gestao-de-conexoes.md)               | Transação, pool, outbox na transação         | Abrir transação ou configurar pool                  |
| [0020](docs/ADR/0020-transporte-de-mensagens-e-isolamento-de-filas.md) | BullMQ sobre Redis, isolamento de fila       | Criar fila ou publicar mensagem                     |
| [0021](docs/ADR/0021-outbox-transacional-e-relay-de-eventos.md)        | Outbox e relay                               | Publicar evento de domínio                          |
| [0022](docs/ADR/0022-observabilidade-e-registro-de-erros.md)           | Log estruturado, correlação, erros em tabela | Tratar erro, logar ou instrumentar                  |
| [0023](docs/ADR/0023-ambiente-de-desenvolvimento-e-verificacao.md)     | `verify`, ganchos, CI                        | Mexer em ferramenta, gancho ou workflow             |
| [0024](docs/ADR/0024-estrategia-de-testes.md)                          | Níveis de teste e suas fronteiras            | Escrever qualquer teste                             |
| [0025](docs/ADR/0025-formato-de-resposta-da-api.md)                    | Envelope de resposta e código de erro        | Retornar sucesso ou erro de um endpoint             |
| [0026](docs/ADR/0026-estrategia-de-internacionalizacao.md)             | Idioma do código, fronteira de tradução      | Nomear símbolo ou produzir texto exibível           |

**Decisões pendentes** (`docs/ADR/README.md`): decomposição em módulos, carga de referência,
infraestrutura de implantação, conformidade legal de dados pessoais. Criar um módulo **exige ADR
próprio** declarando sua capacidade e as tabelas sob sua propriedade (`ADR-0003 §12`).

---

## 3. Índice dos Padrões de Engenharia

[`docs/Padroes/Padroes-de-Engenharia.md`](docs/Padroes/Padroes-de-Engenharia.md) — 158 padrões, um
por linha de tabela, cada um com verificação e rastreio até o ADR de origem. É o critério usado em
revisão de código e na aceitação de um requisito como especificado. **Não são requisitos**: ninguém
os pediu.

| Categoria | Faixa   | Cobre                                                                        | Seção |
| :-------- | :------ | :--------------------------------------------------------------------------- | :---- |
| `MOD`     | 001–018 | Modularidade, superfície pública, SOLID/DRY/KISS, escopo de `shared/`        | 3.1   |
| `EVO`     | 001–012 | Extração para serviço, versionamento de contrato, envelope de resposta       | 3.2   |
| `ESC`     | 001–017 | Escalabilidade por papel, metas de latência, N+1, paginação                  | 3.3   |
| `CON`     | 001–022 | Schema por módulo, UUIDv7, transação, idempotência, retentativa, DLQ, outbox | 3.4   |
| `OBS`     | 001–013 | Log estruturado, correlação, métricas, registro de erro                      | 3.5   |
| `SEG`     | 001–025 | Sessão, RBAC, delegação, CORS, CSRF, dados pessoais, isolamento de fila      | 3.6   |
| `VER`     | 001–012 | Ambiente, pull request, ganchos, níveis e fronteiras de teste                | 3.7   |
| `REQ`     | 001–008 | Como especificar requisito, catálogos de permissão e de código               | 3.8   |
| `NOM`     | 001–015 | Idioma dos identificadores, tradução, glossário do domínio (3.9.1)           | 3.9   |
| `TEC`     | 001–016 | Restrições tecnológicas impostas — não renegociáveis por decisão isolada     | 4     |

Convenções: identificador `PAD-<CAT>-<NNN>`, sequencial e **imutável**. Prioridade **E** essencial,
**I** importante, **D** desejável. Origem `ARQ` (decisão em ADR), `STK` (imposição) ou `PRO`
(processo, sem ADR). A matriz ADR → padrões está na seção 5 do documento; as lacunas conhecidas, na
seção 6.

Dois pontos de consulta frequente:

- **Seção 4 — restrições tecnológicas.** Fixa NestJS, PostgreSQL único, Redis único, Express,
  Prisma, GitHub Actions. Trocar qualquer um exige reescrever o ADR de origem.
- **Seção 3.9.1 — glossário de nomeação.** A correspondência português → inglês dos conceitos do
  domínio, com o motivo de cada escolha não óbvia (`SimilarityCheck` e não `PlagiarismCheck`,
  `AuthorshipSignal` e não `AiDetection`, `Revision` distinta de `Submission`). **Consulte antes de
  nomear entidade, tabela, rota ou evento** — o nome errado se propaga por migração e contrato.

---

## 4. Os requisitos

[`docs/Requisitos/URS.md`](docs/Requisitos/URS.md) — versão 0.4, escopo funcional coberto, pendente
de ratificação. 70 requisitos funcionais em 14 grupos, um quadro por requisito, cada um rastreado
até a evidência de elicitação.

| Grupo | Assunto             | Grupo | Assunto                     |
| :---- | :------------------ | :---- | :-------------------------- |
| `ACS` | Acesso e identidade | `TPL` | Template                    |
| `INS` | Instituição         | `EDT` | Edição do artigo            |
| `CUR` | Curso               | `REV` | Ciclo de correção           |
| `TUR` | Turma               | `DSC` | Discussão e notificações    |
| `EVT` | Evento              | `IAA` | Assistência automatizada    |
| `EQP` | Equipe              | `ACP` | Acompanhamento e relatórios |
| `ART` | Artigo              | `INT` | Internacionalização         |

Também na URS: §1.5 modelo de domínio, §2.3 catálogo de permissões, §2.4 catálogo de códigos de
resposta. Ambos os catálogos são **derivados** — nascem do que os requisitos declaram.

---

## 5. OpenSpec

### 5.1 O que é, e por que existe aqui

OpenSpec conduz **a mudança**, do enunciado ao código, em artefatos versionados que precedem a
implementação. Os ADRs registram o que já foi decidido; a URS, o que o cliente pediu. Nenhum dos
dois diz como uma alteração concreta sai do papel — esse é o vão que o OpenSpec preenche.

CLI instalado como dependência de desenvolvimento (`@fission-ai/openspec`), fixado no lockfile.
Invoque com `pnpm exec openspec ...`; nunca instale globalmente.

### 5.2 Onde vive

```
openspec/
  config.yaml              schema em uso (spec-driven) e o contexto de idioma
  specs/<capability>/spec.md   as specs vigentes — o que o sistema faz hoje
  changes/<nome>/          uma mudança em curso
    .openspec.yaml         o schema da mudança e marcadores como skip_specs
    proposal.md            por quê e o quê
    specs/<capability>/spec.md   o delta — só o que muda
    design.md              como (condicional)
    tasks.md               a lista de execução, em caixas de seleção
  changes/archive/         mudanças concluídas, preservadas
```

`specs/` e `changes/` são criados na primeira mudança. Tudo aí é versionado: é o registro do que foi
acordado. `.claude/commands/opsx/` e `.claude/skills/openspec-*/` são **gerados** pelo CLI — não os
edite à mão; `pnpm exec openspec update` os reescreve.

### 5.3 O ciclo

| Comando         | Faz                                                                      |
| :-------------- | :----------------------------------------------------------------------- |
| `/opsx:explore` | Pensar em voz alta. **Não escreve código.**                              |
| `/opsx:propose` | Cria a mudança e todos os artefatos de planejamento. **Não implementa.** |
| `/opsx:update`  | Revisa artefatos de uma mudança já proposta, mantendo-os coerentes       |
| `/opsx:apply`   | Executa `tasks.md` — é aqui, e só aqui, que o código é escrito           |
| `/opsx:sync`    | Aplica os deltas às specs vigentes                                       |
| `/opsx:archive` | Encerra a mudança: consolida as specs e move para `changes/archive/`     |

A separação entre propor e aplicar é deliberada e **não deve ser atalhada**: pedir uma proposta
autoriza planejamento, não implementação, mesmo que o pedido diga "implemente". O passo de aplicar
exige um pedido novo.

Fora dos comandos: `pnpm exec openspec list` (mudanças ativas), `openspec status --change <nome>`
(o que falta), `openspec validate --strict`, `openspec view` (painel).

### 5.4 O que é uma spec

Uma spec é um **contrato de comportamento observável** — não um plano de implementação. Entra o que
o usuário ou um sistema consumidor percebe: entradas, saídas, condições de erro, restrições
externas. Fica de fora nome de classe, escolha de biblioteca e passo a passo. O teste é direto: se a
implementação pode mudar sem alterar o comportamento visível, aquilo não pertence à spec.

Formato — a estrutura é verificada, e errar o nível de cabeçalho falha em silêncio:

```markdown
## ADDED Requirements

### Requirement: Nome do requisito

O sistema SHALL ... (use SHALL/MUST; nunca should/may)

#### Scenario: Nome do cenário

- **WHEN** condição
- **THEN** resultado esperado
```

Regras que valem sempre:

- Todo requisito **tem pelo menos um cenário**; cada cenário é um caso de teste em potencial.
- Cenário usa exatamente **quatro** `#`.
- Operações de delta: `ADDED`, `MODIFIED`, `REMOVED`, `RENAMED`. `MODIFIED` exige **o bloco inteiro
  do requisito, já atualizado** — delta parcial perde conteúdo no arquivamento. Acrescentando algo
  sem mudar o que existe, use `ADDED`.
- `REMOVED` exige **Reason** e **Migration**.
- Capacidade nova abre com `## Purpose`; capacidade existente, não.
- Mudança sem efeito sobre comportamento — refatoração, ferramenta, documentação — declara
  `skip_specs: true` no `.openspec.yaml` da mudança. Não invente requisito para satisfazer a
  validação.

O texto dos artefatos é escrito em **pt-BR** (`openspec/config.yaml`); os cabeçalhos estruturais e as
palavras normativas SHALL/MUST permanecem em inglês.

### 5.5 Como o OpenSpec convive com `docs/`

Convenção deste repositório, para que uma coisa não vire cópia da outra:

- **Não duplique a URS.** A spec descreve o comportamento da capacidade implementada; o requisito
  fica na URS. Cite o identificador — `RF-REV-003` — em vez de repetir o quadro (`PAD-TEC-015`).
- **Proposta não revoga ADR.** Se a mudança contraria uma decisão aceita, o caminho é reescrever o
  ADR em `vince-docs` primeiro. `design.md` registra a alternativa; não a decide sozinho.
- **Capacidade ≠ módulo.** Nomeie a capacidade em `openspec/specs/` pelo comportamento. Criar um
  módulo em `src/modules/` continua exigindo ADR próprio (`ADR-0003 §12`).
- **`design.md` cita, não reescreve.** Ao justificar uma escolha técnica, aponte o ADR e o padrão
  que a impõem.

---

## 6. Trabalhando no código

`pnpm run verify` é a porta: tipos, lint, formatação e testes — a mesma definição que o CI executa.
O gancho de pré-push a roda inteira; o de pré-commit, só o que mudou.

O lint **não é estilo**: `eslint.config.mjs` codifica a fronteira arquitetural, e violação reprova o
build. Um módulo só importa de `contracts/` de outro; `domain/` não conhece camada acima;
`presentation/` invoca caso de uso, nunca repositório; `shared/` nunca importa de `modules/`. Se o
lint reclamar de uma importação, a resposta quase nunca é abrir exceção — supressão por comentário
**não passa em revisão** (`ADR-0007 §11`).

Antes de propor qualquer alteração de regra, verifique se ela já foi decidida: procure no índice
acima, leia o ADR, e só então discuta. A decisão anterior está registrada em `Alternativas
rejeitadas` do próprio ADR — o argumento provavelmente já foi considerado.
