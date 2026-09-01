## 1. Alteração da URS — bloqueia toda a implementação

- [ ] 1.1 Escrever, em `vince-docs`, o requisito funcional novo do grupo `ACS` — "Convidar usuário" —
      na estrutura de `PAD-REQ-008`: ator, pré-condições, fluxo principal, fluxos de exceção, regras
      de negócio, permissões geradas, escopo de titularidade, prioridade, origem e critério de
      aceitação. Ele DEVE declarar as duas formas de convite e a cadeia de não escalonamento da
      decisão D5. Verificação: o requisito consta de §2.1.1 e da tabela-resumo do grupo.
- [ ] 1.2 Acrescentar o requisito novo como origem de `INVITATION:CREATE`, `INVITATION:READ` e
      `INVITATION:REVOKE` na URS §2.3, que hoje registram apenas RF-TUR-004. Verificação: as três
      linhas do catálogo citam as duas origens.
- [ ] 1.3 Acrescentar `INVITATION:CREATE`, `INVITATION:READ` e `INVITATION:REVOKE` à composição de
      `SYSTEM_ADMIN`, `INSTITUTION_ADMIN` e `COORDINATOR` na URS §2.3.1. Verificação: a cadeia de
      designação fica inteiramente coberta — hoje só `PROFESSOR` possui essas permissões.
- [ ] 1.4 Acrescentar à URS §2.4 o código de limite de usos atingido, com o requisito novo como
      origem. Verificação: o código consta do catálogo.
- [ ] 1.5 Submeter as alterações de 1.1 a 1.4 à validação da parte interessada, junto das duas
      assunções registradas no `design.md`: a cadeia de D5 e a recomendação de reservar a forma aberta
      ao papel `STUDENT`. Verificação: a decisão está registrada, ainda que seja manter o proposto.
- [ ] 1.6 Atualizar o submódulo (`pnpm run docs:update`) e a carga inicial do catálogo, refletindo a
      composição nova de §2.3.1. Verificação: o comando de conferência de
      `add-role-and-permission-catalog` volta a relatar correspondência integral, e `pnpm run verify`
      passa.

## 2. Persistência e domínio do convite

- [ ] 2.1 Acrescentar a `src/modules/access/access.prisma` o model de convite: derivação do endereço
      com unicidade, destinatário opcional, papel concedido, identificador e retrato da instituição,
      prazo, limite e contagem de usos, estado, e as colunas de instante (`ADR-0018` §9 a §17).
      Verificação: `pnpm run db:migrate` aplica em base limpa.
- [ ] 2.2 Acrescentar o model da trilha de auditoria do convite, no schema do próprio módulo.
      Verificação: cenários "Emissão registrada", "Aceitação registrada" e "Senha ausente da trilha".
- [ ] 2.3 Modelar o convite em `domain/`, com as invariantes das duas formas e as transições de estado
      (decisão D1). Verificação: testes de regra de domínio sem banco cobrindo prazo, limite,
      revogação e a exclusividade entre destinatário e uso múltiplo.
- [ ] 2.4 Gerar o endereço por fonte criptograficamente segura, com no mínimo 128 bits, persistindo
      apenas sua derivação (decisão D3). Verificação: cenários "Endereço opaco" e "Valor não
      recuperável do armazenamento".
- [ ] 2.5 Declarar a cadeia de não escalonamento em ponto único no `access` (decisão D5).
      Verificação: cenários "Papel dentro da cadeia", "Papel acima da cadeia", "Papel de administrador
      de sistema" e "Convidante com papéis múltiplos".

## 3. Emissão

- [ ] 3.1 Implementar, na fachada do `access`, a emissão de convite dirigido e de convite aberto, com
      a validação de papel e a recusa de e-mail já registrado. Verificação: cenários "Emissão aceita"
      (das duas formas), "E-mail já pertence a uma conta", "Prazo ausente ou no passado" e "Limite
      ausente".
- [ ] 3.2 Publicar, no módulo `institution`, a rota de emissão no escopo de uma instituição, validando
      instituição ativa e atuação do ator, e passando o retrato da instituição (decisões D2 e D4).
      Verificação: cenários "Instituição desativada", "Ator sem a permissão", "Convidante na própria
      instituição", "Convidante em instituição alheia" e "Administrador de sistema".
- [ ] 3.3 Confirmar que `access` continua sem importar nada de `institution` (regra de módulo folha).
      Verificação: `pnpm run lint` passa e a busca por importações cruzadas não encontra ocorrência.

## 4. Consulta e aceitação públicas

- [ ] 4.1 Publicar, no `access`, a rota pública de consulta do convite pelo endereço, com resposta
      indistinguível para expirado, revogado, esgotado e inexistente. Verificação: cenários "Convite
      ativo", "Convite dirigido", "Convite indisponível" e "Emissor não é revelado".
- [ ] 4.2 Publicar a rota pública de aceitação, criando a conta com papel e vínculo do convite e
      desconsiderando papel e instituição vindos do corpo. Verificação: cenários "Aceitação de convite
      dirigido", "Aceitação de convite aberto", "Papel submetido é desconsiderado", "E-mail já
      registrado", "Senha fora da política", "Convite expirado", "Convite revogado" e "Sessão não é
      estabelecida".
- [ ] 4.3 Implementar o consumo do convite por escrita condicional, na mesma transação da criação da
      conta (decisão D7). Verificação: cenários "Duas aceitações simultâneas do mesmo convite
      dirigido", "Aceitações múltiplas" e "Limite de usos atingido".
- [ ] 4.4 Marcar as duas rotas como públicas na declaração da guarda de borda, que exige declaração
      explícita. Verificação: a aplicação sobe e as rotas respondem sem sessão.

## 5. Gestão dos convites emitidos

- [ ] 5.1 Publicar a listagem paginada de convites por instituição, restrita a quem atua nela.
      Verificação: cenários "Listagem" e "Listagem não alcança outra instituição".
- [ ] 5.2 Publicar a revogação, idempotente e sem efeito sobre contas já criadas. Verificação:
      cenários "Revogação", "Revogação repetida" e "Contas criadas permanecem".

## 6. Primeiro acesso do administrador inicial

- [ ] 6.1 Fazer a carga inicial emitir e apresentar o meio de redefinição da conta inicial, apenas
      enquanto ela não tiver senha (decisão D8). Verificação: cenários "Primeira carga", "Carga após a
      senha definida", "Meio inicial é de uso único" e "Senha não vem de configuração".
- [ ] 6.2 Documentar o primeiro acesso no `README.md` do repositório, no bloco de começando.
      Verificação: alguém que siga o README a partir de repositório limpo consegue entrar no sistema.

## 7. Encerramento

- [ ] 7.1 Percorrer a cadeia inteira de ponta a ponta, como teste de jornada (`ADR-0024` §8): definir a
      senha inicial, autenticar como `SYSTEM_ADMIN`, criar instituição, convidar um
      `INSTITUTION_ADMIN`, aceitar o convite, autenticar com a conta nova e emitir dela um convite de
      `COORDINATOR`. Verificação: a jornada passa sem intervenção manual no banco.
- [ ] 7.2 Registrar a limitação de taxa das rotas públicas como pendência rastreável, junto da que
      `add-session-authentication` já abriu. Verificação: a pendência existe e nomeia as três rotas
      públicas do sistema.
- [ ] 7.3 Atualizar os READMEs de `src/modules/access/` e `src/modules/institution/` com a repartição
      da validação entre emissor e mecanismo. Verificação: os dois arquivos a descrevem.
- [ ] 7.4 Executar `pnpm run verify` inteiro. Verificação: tipos, lint, formatação e testes passam,
      com o Compose ativo.
