# VinceArt — Backend

Monolito modular em NestJS. As decisões de arquitetura que governam este repositório estão em
[`docs/`](docs/), incluído como submódulo a partir de
[vince-docs](https://github.com/Biopark-G3S6/vince-docs).

> Divergência entre este código e os ADRs é **defeito**, não estilo. Alterar uma regra exige
> reescrever o ADR correspondente, nunca contorná-lo.

## Começando

```bash
git clone --recurse-submodules https://github.com/Biopark-G3S6/vince-back.git
cd vince-back

cp .env.example .env
docker compose up -d          # PostgreSQL e Redis
pnpm install
pnpm run db:migrate
pnpm run db:seed              # papéis e permissões — sem isso não há autorização
pnpm run start:dev
```

Já clonou sem os submódulos? `git submodule update --init --recursive`.

Toda variável de `.env.example` é **obrigatória**: a aplicação recusa subir sem ela, e a mensagem
nomeia a que falta. Configuração ausente que assume um padrão silencioso é o modo de falha que só
aparece em produção — e `CSRF_TOKEN_SECRET` é exatamente o caso em que um padrão embutido seria pior
que a parada.

## Papéis de execução

O artefato de build é único; o papel vem do ambiente (`ADR-0008`).

| `ROLE`   | Faz                                                                   | Replicável          |
| :------- | :-------------------------------------------------------------------- | :------------------ |
| `api`    | Controllers HTTP. Sem processadores de fila.                          | Sim                 |
| `worker` | Processadores de fila dos módulos em `MODULES`. Sem HTTP salvo saúde. | Sim                 |
| `relay`  | Publica os eventos do outbox. Sem HTTP salvo saúde.                   | **Não**, por módulo |

`MODULES` vazio significa todos os módulos. Escalar réplicas por papel é a resposta padrão a
gargalo — antes de considerar extrair um módulo para serviço próprio.

## Estrutura

```
src/
  app/                    composition root — conhece só a lista de módulos
  shared/                 kernel transversal
    config/               leitura da configuração, em ponto único
    correlation/          o identificador de correlação da requisição
    logging/              log estruturado e a lista de permissão de campos
    http/                 envelope, catálogo de códigos, declaração de acesso da rota
    errors/               falha esperada e tratador global de exceções
    auth/                 sessão opaca, guarda de borda, CSRF, identidade
  modules/<modulo>/
    contracts/            ÚNICA superfície pública
    domain/               entidades, value objects, regras, ports
    application/          casos de uso
    infrastructure/       repositórios, adapters, consumidores
    presentation/         controllers e rotas
    <modulo>.module.ts    registro do módulo
    <modulo>.prisma       schema do módulo — reside DENTRO dele (ADR-0010 §3)
prisma/migrations/        migrações geradas, únicas para a aplicação
```

Cada diretório tem um README com as regras que valem ali.

## Comandos

| Comando                | O que faz                                                                |
| :--------------------- | :----------------------------------------------------------------------- |
| `pnpm run verify`      | **A porta de verificação**: tipos, lint, formatação, fronteiras e testes |
| `pnpm run start:dev`   | Sobe a aplicação com recarga                                             |
| `pnpm run test`        | Testes unitários e de integração                                         |
| `pnpm run db:migrate`  | Cria e aplica migração                                                   |
| `pnpm run db:seed`     | Carga inicial: o catálogo de permissões e os cinco papéis                |
| `pnpm run docs:update` | Atualiza o submódulo de documentação para o último commit                |

## A API

Prefixo de versão `/api/v1` (`ADR-0017 §7`). Com a aplicação em execução:

| Recurso                    | Caminho             |
| :------------------------- | :------------------ |
| Especificação OpenAPI      | `/api/openapi.json` |
| Navegador da especificação | `/api/docs`         |

A especificação é **gerada do código** (`ADR-0017 §1`): endpoint novo consta dela sem que ninguém
edite documento algum, e é dela que o frontend deriva os seus tipos (§2).

**Toda rota declara o seu acesso**, e o esquecimento reprova a inicialização — `@PublicRoute()`,
`@AuthenticatedRoute()` ou `@RequiresPermission(...)`. A falha típica da guarda por rota não é a
regra errada: é a rota nova que não declara nada, e essa falha é aberta e silenciosa. Aqui ela é
fechada, e acontece antes de a aplicação escutar em porta alguma.

O que o **frontend** precisa saber a cada vertical entregue — códigos de resposta, cookies,
cabeçalhos e o que ficou por fazer — está em
[`docs/front-end-implementations.md`](docs/front-end-implementations.md).

`pnpm run verify` é a mesma definição que o GitHub Actions executa. Se passa aqui, passa lá.
Ele depende do Compose ativo: os repositórios são exercitados contra PostgreSQL real
(`ADR-0024 §9`), em uma base por processo de teste.

`pnpm run docs:check-catalog` fica **fora** de `verify`: confronta o catálogo de permissões
declarado no código com a URS §2.3 e §2.3.1, e por isso depende do submódulo `docs/`, que a
verificação não busca (`ADR-0027 §19`). É ferramenta de revisão, e roda deliberadamente.

## O que o lint impede

A configuração em `eslint.config.mjs` não é estilo — é a fronteira arquitetural, e violação é
erro que reprova o build:

- Um módulo só importa de `contracts/` de outro módulo.
- `domain/` não conhece camada alguma acima dele.
- `presentation/` invoca casos de uso, nunca repositório.
- `shared/` nunca importa de `modules/`.

Se o lint reclamar de uma importação, a resposta correta quase nunca é adicionar uma exceção.
Supressão pontual por comentário **não é aceita em revisão** (`ADR-0007 §11`).

## Antes de criar um módulo

Exige ADR próprio declarando a capacidade e as tabelas sob sua propriedade (`ADR-0003 §12`).
Módulo de plataforma exige também justificar por que os dados não podem viver em `shared/`.
