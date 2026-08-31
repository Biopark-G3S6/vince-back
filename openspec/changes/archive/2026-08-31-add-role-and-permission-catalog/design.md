## Context

`src/modules/` está vazio: esta é a primeira ocupação. Ela decide, portanto, mais do que o catálogo de
autorização — fixa como um módulo se registra, como recebe cliente Prisma escopado, como suas tabelas
nascem e como a carga inicial é executada. Tudo isso é reaproveitado pelas verticais seguintes, e
errar aqui se propaga.

As restrições que moldam o desenho: `ADR-0003` (camadas e fronteira), `ADR-0004` (fachada como única
superfície), `ADR-0006` (propriedade de dados), `ADR-0010` §3 a §7 (cliente escopado, schema no
módulo), `ADR-0018` (schema por módulo, UUIDv7, sem `ENUM` nativo), `ADR-0014` §1 a §8 (modelo RBAC e
origem das permissões), `ADR-0023` §5 e §8 (carga inicial reproduzível, comando único de verificação)
e `ADR-0024` §2 a §5 e §9 a §12 (fronteira do teste unitário e infraestrutura de teste).

Para a motivação, ver `proposal.md` — Why. Para o contrato de comportamento, ver
`specs/role-and-permission-catalog/spec.md`.

## Goals / Non-Goals

**Goals:**

- Deixar o módulo `access` registrado, com schema próprio, migração e cliente Prisma escopado, de
  modo que a vertical seguinte acrescente tabela sem redecidir nada disso.
- Fazer do catálogo uma declaração única no repositório, da qual a carga e os testes derivam — sem
  segunda cópia a manter em sincronia.
- Deixar a estrutura de teste com PostgreSQL real funcionando (o `TODO` de `test-setup.ts`), já que é
  pré-requisito de qualquer teste de repositório daqui em diante.

**Non-Goals:**

- Qualquer decisão sobre a fronteira do módulo além do que o ADR do módulo `access` fixará. Este
  documento não cria a decisão; ele a pressupõe (ver Riscos).
- Desenho da guarda de borda, do cache de permissões efetivas e do envelope de resposta — não há rota
  HTTP nesta mudança.
- Renomeação dos identificadores em português que já existem no repositório (ver Riscos).

## Decisions

### D1 — Um módulo de negócio `access`, dono de todo o vocabulário de acesso

O módulo `access` é dono de `role`, `permission` e `role_permission` agora, e de `user`, `user_role`,
credencial e `permission_grant` nas verticais seguintes.

_Por quê:_ `ADR-0006` §4 proíbe chave estrangeira entre módulos. Separar papéis de usuários colocaria
`user_role` atravessando fronteira, sem integridade referencial declarada, para uma associação que é
lida em toda requisição autenticada (`ADR-0014` §9). O ganho de isolamento não paga o custo.

_Alternativas consideradas:_ dois módulos, `identity` e `authorization` — mais isolado, exige dois
ADRs e transforma a resolução das permissões efetivas em travessia de fachada; colocar o catálogo em
`shared/` — vedado por `ADR-0009` §5, que proíbe acesso a dados de módulo ali, e por `ADR-0003` §15,
que manda o dado próprio residir em módulo.

### D2 — `permission` como tabela de domínio, não como texto com restrição

`ADR-0018` §19 admite as duas formas. Adota-se tabela de domínio.

_Por quê:_ `PermissionGrant` (RF-ACS-006) referenciará uma permissão, e a trilha de auditoria de
`ADR-0014` §18 precisa de referência estável. Tabela de domínio dá chave estrangeira dentro do próprio
módulo, exigida por `ADR-0018` §12.

_Alternativa considerada:_ coluna de texto com `CHECK` — dispensaria uma tabela, mas cada permissão
nova viraria alteração da restrição, isto é, migração de esquema em vez de linha de dado.

### D3 — O catálogo é declarado uma única vez, em código tipado, e tudo deriva dele

Uma declaração em `domain/` enumera as permissões e a composição de cada papel. A carga inicial lê
dela; os testes conferem o estado carregado contra ela; o código que exigir permissão referencia o
símbolo, não o literal.

_Por quê:_ `PAD-TEC-015` proíbe duplicar a documentação no repositório de código, mas o código precisa
do catálogo em tempo de compilação para que `PERMISSION_GRANT:CREATE` seja um símbolo verificável, e
não uma string solta. Uma declaração única, com o rastreio ao RF de origem em comentário, é a menor
duplicação possível; duas declarações — uma para a carga, outra para o código — seria a maior.

_Alternativa considerada:_ derivar o catálogo lendo a URS em tempo de execução — elimina a
duplicação, mas põe o submódulo de documentação no caminho crítico da aplicação e perde a checagem
de tipo.

### D4 — A conferência com a URS é comando deliberado, fora de `pnpm run verify`

`pnpm run docs:check-catalog` (nome a confirmar na implementação) lê `docs/Requisitos/URS.md`,
extrai §2.3 e §2.3.1 e confronta com a declaração de D3, relatando diferença nos dois sentidos.
Falha explicitamente quando o submódulo não está inicializado.

_Por quê:_ `.github/workflows/verify.yml` declara, em comentário, que não busca o submódulo porque
nada em `verify` lê `docs/`. Pôr a conferência dentro de `verify` reverteria essa decisão e
acrescentaria a clonagem do submódulo a cada execução, tornando o build do backend dependente da
disponibilidade de outro repositório. `PAD-SEG-008` declara a verificação como **revisão**, não como
teste automatizado: o comando é ferramenta para essa revisão, não substituto dela.

_Alternativa considerada:_ teste dentro de `verify`, com `submodules: recursive` no checkout — pega a
divergência mais cedo, ao custo de reverter uma decisão registrada e de acoplar os dois repositórios
no caminho de integração. Se a equipe preferir esse acoplamento, é alteração de uma linha no workflow
e de uma no `package.json` — mas é decisão dela, não desta mudança.

### D5 — A carga inicial é acionada pelo composition root, não pelo `prisma/seed.ts`

`pnpm run db:seed` passa a apontar para um bootstrap em `src/app/bootstrap/`, que cria um contexto
Nest autônomo e invoca um método estático de `AccessModule`.

_Por quê:_ `boundaries/no-unknown-files` está em `error` e `boundaries/include` cobre `src/**/*.ts`;
`app` pode importar `module-root` e `contracts`, e nada mais de módulo. Um script em `prisma/` que
importasse o interno do módulo escaparia da análise de fronteiras justamente por estar fora de `src/`
— conformidade aparente, não real. `ADR-0003` §9 já faz do `<modulo>.module.ts` o único ponto de
registro do módulo; a carga entra por ali.

_Alternativas consideradas:_ expor a carga na fachada — a tornaria operação pública, contrariando o
requisito de imutabilidade da spec; um `ModuleSeeder` abstrato em `shared/` — `ADR-0009` §4 enumera
exaustivamente o que pode viver ali, e carga inicial não está na lista.

### D6 — Idempotência por identificador natural

`role.code` e `permission.code` são únicos e são a chave da carga; a chave primária permanece o
UUIDv7 gerado pela aplicação (`ADR-0018` §9, §10). A carga reconcilia: insere o que falta, remove
vínculo de `role_permission` que não conste mais da declaração, e nunca reescreve identificador
existente.

_Por quê:_ a spec exige reexecução com estado final idêntico e identificadores estáveis. Sem
identificador natural, a segunda execução duplicaria; sem a remoção de vínculo, retirar uma permissão
da composição de um papel não teria efeito.

### D7 — Cliente Prisma escopado por extensão, construído no `AccessModule`

Uma única instância de `PrismaClient` por processo (`ADR-0010` §7), estendida para expor a `access`
apenas seus três models (`ADR-0010` §4, §5).

_Por quê:_ é a exigência literal do ADR. O ponto de atenção é que a instância não escopada precisa
existir em algum lugar para ser estendida — e `shared/` não pode conhecer models de módulo
(`ADR-0009` §5). A instância crua nasce como provider do composition root e o módulo recebe apenas a
extensão. A implementação deve confirmar que a extensão de cliente do Prisma remove os models não
concedidos do tipo, e não apenas em tempo de execução.

## Risks / Trade-offs

- **A mudança pressupõe um ADR que ainda não existe.** `ADR-0003` §12 exige ADR antes de criar módulo,
  e "decomposição em módulos" consta como decisão pendente em `docs/ADR/README.md`. → Tarefa
  bloqueante em `tasks.md`: o ADR do módulo `access` é escrito e aceito em `vince-docs` antes de
  qualquer código. Se o ADR recortar a fronteira de outro modo, D1 cai e a mudança é reproposta.

- **`User` não está no glossário de nomeação.** `PAD-NOM-015` exige que o termo entre no glossário
  §3.9.1 antes de aparecer em código, e `PAD-REQ-002` torna imutável o identificador publicado. →
  Tarefa em `tasks.md`, junto do ADR.

- **O repositório já contém identificadores em português** — `src/modules/observabilidade/`,
  `src/shared/erros/`, `src/shared/tipos/`, `src/shared/autenticacao/`, o model `AssinaturaErro` e o
  schema `observabilidade` — anteriores a `ADR-0026`, que os torna não conformes com `PAD-NOM-001`. →
  Esta mudança nasce em inglês e **não** renomeia o que já existe: a renomeação atravessa migração de
  schema e é mudança própria. A consequência aceita é conviver, por um tempo, com os dois idiomas em
  `src/`.

- **`test-setup.ts` está com o `TODO` de criação de schema e truncamento por processo.** Sem ele não
  há teste de repositório contra PostgreSQL real, exigido por `ADR-0024` §9 a §12. → Faz parte desta
  mudança; é a primeira que precisa dele. O custo é que a suíte passa a exigir o Compose ativo,
  consequência já prevista em `ADR-0024`, implicação 2.

- **Múltiplos schemas do Prisma como dependência da decisão**, apontado em `ADR-0018`, implicação 1. →
  O schema `observabilidade` já está declarado em `_datasource.prisma` e nenhuma migração foi gerada
  ainda; esta mudança é a primeira a exercitar o recurso de verdade. Se ele se mostrar instável na
  versão adotada, o impacto é da organização física, não do catálogo.

- **O catálogo tem 98 permissões e cinco composições enumeradas.** Transcrição manual erra. → A
  conferência de D4 existe exatamente para isso, e deve ser executada e reportada na revisão desta
  mudança, não depois.
