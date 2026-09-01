## 1. Pré-requisitos e dependências

- [ ] 1.1 Concluir `add-user-account-and-profile`. Verificação: seu `tasks.md` está inteiramente
      marcado e `pnpm run verify` passa na base dela.
- [ ] 1.2 Acrescentar as dependências de derivação de senha, leitura de cookie e geração de OpenAPI, e
      confirmar que instalam e executam no Linux local e no runner do GitHub Actions (risco declarado
      no `design.md`). Verificação: `pnpm install` e um teste que deriva e verifica uma senha passam
      nos dois ambientes.
- [ ] 1.3 Declarar em `.env.example` os parâmetros da derivação de senha, o segredo do token
      anti-CSRF e o prazo do meio de redefinição. Verificação: a aplicação recusa subir com
      configuração ausente, com mensagem que nomeia a variável.

## 2. Fundação HTTP — `api-response-contract`

- [ ] 2.1 Implementar o envelope de resposta em `shared/`, aplicado por interceptador, com `data` e
      `status` e a omissão de `pagination` e `errors` quando não aplicáveis. Verificação: cenários
      "Consulta por identificador", "Resposta sem corpo" e "Endpoint de saúde".
- [ ] 2.2 Declarar o catálogo de códigos de resposta em ponto único, a partir da URS §2.4, com
      `severity` por código. Verificação: cenários "Sucesso", "Falha esperada" e "Ausência de texto
      exibível".
- [ ] 2.3 Implementar o tratador global de exceções com classificação em esperadas e inesperadas
      (`ADR-0022` §11 a §15), mapeando cada código do catálogo ao status HTTP de `ADR-0025` §29.
      Verificação: cenários "Recurso inexistente", "Violação de regra de negócio", "Falha nunca sob
      status de sucesso" e "Falha inesperada".
- [ ] 2.4 Implementar o detalhamento de erro por campo, sem eco do valor submetido. Verificação:
      cenários "Dois campos inválidos" e "Valor submetido não é ecoado".
- [ ] 2.5 Implementar o identificador de correlação na borda, com validação de formato, propagação aos
      casos de uso e aos registros de log, e devolução em `X-Correlation-Id`. Verificação: cenários
      "Requisição sem identificador", "Requisição com identificador válido", "Requisição com
      identificador malformado" e "Resposta de falha".
- [ ] 2.6 Configurar o log estruturado em saída padrão com lista de permissão de campos declarada em
      ponto único (`ADR-0022` §1 a §5). Verificação: teste que introduz campo sensível não declarado
      e confirma sua ausência no registro emitido.
- [ ] 2.7 Confirmar a restrição de origens já configurada em `src/main.ts` e cobri-la por teste.
      Verificação: cenários "Origem listada" e "Origem não listada".
- [ ] 2.8 Publicar a especificação OpenAPI gerada do código. Verificação: cenários "Especificação
      disponível" e "Endpoint novo".

## 3. Credencial — `password-credential`

- [ ] 3.1 Acrescentar a credencial ao schema do módulo `access`, com a derivação da senha e sem coluna
      que admita texto puro. Verificação: `pnpm run db:migrate` aplica em base limpa e o cenário
      "Ausência de texto puro" passa.
- [ ] 3.2 Declarar a política de senha em ponto único e aplicá-la em toda definição e alteração
      (decisão D3). Verificação: cenários "Senha conforme", "Senha abaixo do comprimento mínimo" e
      "Senha acima do comprimento máximo".
- [ ] 3.3 Implementar a alteração de senha por usuário autenticado, com exigência da senha atual e
      encerramento das demais sessões. Verificação: cenários "Alteração aceita", "Senha atual
      ausente", "Senha atual incorreta" e "Demais sessões encerradas".
- [ ] 3.4 Implementar o meio de redefinição — geração aleatória, valor derivado no banco, uso único,
      prazo (decisão D7). Verificação: cenários "Redefinição com meio válido", "Reuso do meio", "Meio
      expirado", "Meio desconhecido" e "Todas as sessões encerradas".
- [ ] 3.5 Implementar a solicitação de recuperação com resposta indistinguível, em conteúdo e em tempo
      (decisão D6). Verificação: cenários "E-mail cadastrado", "E-mail não cadastrado" e "Conta
      desativada".
- [ ] 3.6 Implementar o comportamento de conta sem senha definida. Verificação: cenários "Conta sem
      senha" e "Definição da primeira senha".

## 4. Sessão — `session-authentication`

- [ ] 4.1 Implementar em `shared/` o repositório de sessão sobre Redis, com identificador de no mínimo
      128 bits de fonte criptograficamente segura e estado contendo usuário, criação, última atividade
      e origem. Verificação: cenários "Identificador sem semântica" e "Identificadores distintos entre
      sessões".
- [ ] 4.2 Implementar os ports abstratos de verificação de credencial e de resolução de permissões
      efetivas em `shared/`, ligados às implementações do módulo `access` pelo composition root
      (decisão D1). Verificação: `pnpm run lint` passa sem exceção de fronteira e `shared/` não
      importa de `modules/`.
- [ ] 4.3 Implementar a autenticação por e-mail e senha, com regeneração do identificador e resposta
      indistinguível entre os casos de falha. Verificação: cenários "Credencial válida", "Senha
      incorreta", "Conta inexistente", "Conta desativada" e "Identificador regenerado".
- [ ] 4.4 Implementar o transporte em cookie com os quatro atributos exigidos. Verificação: cenários
      "Atributos do cookie" e "Credencial ausente do corpo e da URL".
- [ ] 4.5 Implementar as duas expirações e a renovação apenas da janela de inatividade. Verificação:
      cenários "Renovação por atividade", "Expiração por inatividade" e "Expiração por prazo
      absoluto".
- [ ] 4.6 Implementar encerramento idempotente e revogação de todas as sessões de um usuário.
      Verificação: cenários "Encerramento", "Encerramento de sessão já expirada", "Outras sessões
      preservadas" e "Revogação de todas as sessões".
- [ ] 4.7 Garantir que a resolução da sessão não consulte o banco relacional e que a indisponibilidade
      do Redis recuse a requisição. Verificação: cenários "Requisição autenticada comum" e
      "Repositório de sessões indisponível", este com teste de invariância de contagem de consultas.
- [ ] 4.8 Implementar a proteção anti-CSRF por sessão, exigida nas requisições que alteram estado.
      Verificação: cenários "Requisição de alteração com token válido", "sem token", "com token de
      outra sessão" e "Requisição de leitura".

## 5. Autorização na borda — `permission-enforcement`

- [ ] 5.1 Implementar a guarda global com declaração obrigatória de permissão ou de acesso público por
      rota, verificada na inicialização (decisão D4). Verificação: cenários "Usuário com a permissão",
      "Usuário sem a permissão", "Requisição não autenticada", "Rota sem declaração" e "Permissão
      enviada pelo cliente é ignorada".
- [ ] 5.2 Registrar a negativa de autorização em log estruturado, dentro da lista de permissão de
      campos. Verificação: cenários "Negativa registrada" e "Campo não declarado".
- [ ] 5.3 Confirmar que nenhuma regra de titularidade virou permissão e que a titularidade é decidida
      no caso de uso. Verificação: cenários "Permissão presente, registro de terceiro" e "Catálogo sem
      permissão de titularidade".

## 6. Rotas publicadas

- [ ] 6.1 Publicar as rotas de autenticação e de encerramento de sessão, marcadas como públicas na
      declaração da guarda. Verificação: jornada completa — entrar, requisitar rota protegida, sair,
      requisitar de novo e receber `401`.
- [ ] 6.2 Publicar o endpoint de identidade do usuário autenticado. Verificação: cenários "Identidade
      devolvida", "Sem sessão", "Permissões refletem revogação" e "Ação oculta na interface continua
      protegida".
- [ ] 6.3 Publicar as rotas de definição e alteração de senha e a de solicitação de recuperação.
      Verificação: as rotas exercitam os casos de uso do grupo 3 por HTTP, com o envelope do grupo 2.
- [ ] 6.4 Publicar as rotas do perfil próprio sobre os casos de uso de `add-user-account-and-profile`
      (RF-ACS-005, RF-INT-001). Verificação: consulta e atualização do perfil por HTTP, com
      `PERMISSION_DENIED` na tentativa de alterar e-mail, papéis ou vínculos.

## 7. Fechamento

- [ ] 7.1 Comunicar ao repositório do frontend os códigos de resposta que esta vertical passa a emitir,
      para que ganhem chave no catálogo de tradução (`PAD-NOM-008`, decisão D5). A comunicação DEVE
      ser um **documento de especificação para o frontend**, versionado, e não uma mensagem avulsa:
      a lista é contrato de integração e precisa sobreviver à conversa que a originou. Verificação: o
      documento existe em `vince-front`, enumera cada código e diz o que a interface deve fazer com
      ele.
- [ ] 7.2 Atualizar `src/shared/README.md` e `src/modules/access/README.md` com o que passou a viver em
      cada um. Verificação: os arquivos descrevem sessão, guarda, envelope e correlação em `shared/`,
      e a credencial no módulo.
- [ ] 7.3 Registrar as duas questões em aberto do `design.md` — limitação de taxa e rotação do segredo
      anti-CSRF — como pendências rastreáveis. Ambas têm efeito observável no cliente: a limitação de
      taxa produz resposta que a interface precisa tratar, e o token anti-CSRF é consumido por ela.
      O que as alcança DEVE, portanto, constar também do **documento de especificação para o
      frontend** da tarefa 7.1. Verificação: as duas pendências estão registradas, e o documento de
      7.1 declara o comportamento esperado da interface diante de cada uma.
- [ ] 7.4 Executar `pnpm run verify` inteiro e a jornada de ponta a ponta da autenticação
      (`ADR-0024` §8). Verificação: tudo passa com o Compose ativo.
