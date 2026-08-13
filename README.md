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
pnpm run start:dev
```

Já clonou sem os submódulos? `git submodule update --init --recursive`.

## Papéis de execução

O artefato de build é único; o papel vem do ambiente (`ADR-0008`).

| `ROLE` | Faz | Replicável |
| :--- | :--- | :--- |
| `api` | Controllers HTTP. Sem processadores de fila. | Sim |
| `worker` | Processadores de fila dos módulos em `MODULES`. Sem HTTP salvo saúde. | Sim |
| `relay` | Publica os eventos do outbox. Sem HTTP salvo saúde. | **Não**, por módulo |

`MODULES` vazio significa todos os módulos. Escalar réplicas por papel é a resposta padrão a
gargalo — antes de considerar extrair um módulo para serviço próprio.

## Estrutura

```
src/
  app/                    composition root — conhece só a lista de módulos
  shared/                 kernel transversal: log, erros, autenticação de borda, config
  modules/<modulo>/
    contracts/            ÚNICA superfície pública
    domain/               entidades, value objects, regras, ports
    application/          casos de uso
    infrastructure/       repositórios, adapters, consumidores
    presentation/         controllers e rotas
    <modulo>.module.ts    registro do módulo
prisma/schema/            um .prisma por módulo
```

Cada diretório tem um README com as regras que valem ali.

## Comandos

| Comando | O que faz |
| :--- | :--- |
| `pnpm run verify` | **A porta de verificação**: tipos, lint, formatação, fronteiras e testes |
| `pnpm run start:dev` | Sobe a aplicação com recarga |
| `pnpm run test` | Testes unitários e de integração |
| `pnpm run db:migrate` | Cria e aplica migração |
| `pnpm run docs:update` | Atualiza o submódulo de documentação para o último commit |

`pnpm run verify` é a mesma definição que o GitHub Actions executa. Se passa aqui, passa lá.

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
