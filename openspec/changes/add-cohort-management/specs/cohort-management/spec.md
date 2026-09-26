## Purpose

Delimita a orientação por período letivo, seus professores e seus alunos, oferecendo matrícula direta e
ingresso por convite sem quebrar o isolamento do curso.

## ADDED Requirements

### Requirement: Manutenção de turma

O sistema SHALL permitir ao coordenador autorizado criar, listar, consultar, alterar e desativar uma
turma vinculada a curso ativo. A turma SHALL exigir identificação, período letivo, data de início e data
de término; a identificação SHALL ser única dentro do curso e do período letivo. Listagens SHALL ser
paginadas.

#### Scenario: Turma criada

- **WHEN** um coordenador designado informa dados válidos para curso ativo
- **THEN** o sistema cria uma turma ativa vinculada ao curso
- **AND** a turma admite designação de professores e matrículas

#### Scenario: Intervalo inválido

- **WHEN** a data de término é anterior à data de início
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Identificação duplicada

- **WHEN** o coordenador cria outra turma com a mesma identificação no mesmo curso e período
- **THEN** a operação falha com conflito de estado

#### Scenario: Curso inativo

- **WHEN** um coordenador tenta criar turma para curso inativo
- **THEN** a operação falha com `VALIDATION_FAILED`

### Requirement: Designação de professor

O sistema SHALL permitir ao coordenador designar e revogar professores ativos em turma ativa do seu
curso. Uma turma SHALL admitir mais de um professor, e a repetição da designação SHALL ser idempotente.

#### Scenario: Professor designado

- **WHEN** o coordenador designa professor ativo a turma do seu curso
- **THEN** o vínculo com a turma é criado
- **AND** o professor pode cadastrar alunos e emitir convites nessa turma

#### Scenario: Designação repetida

- **WHEN** o coordenador repete a designação do mesmo professor na mesma turma
- **THEN** a operação conclui sem duplicar o vínculo

#### Scenario: Coordenador fora do curso

- **WHEN** um coordenador tenta designar professor em turma de curso ao qual não está designado
- **THEN** a operação falha com `PERMISSION_DENIED`

### Requirement: Matrícula direta de aluno

O sistema SHALL permitir ao professor designado cadastrar aluno por nome e e-mail. Se o e-mail não
existir, o sistema SHALL criar a conta com papel `STUDENT` e sem senha definida e SHALL criar uma
matrícula ativa; a matrícula SHALL ser entidade própria e o e-mail SHALL ser globalmente único.

#### Scenario: Aluno novo matriculado

- **WHEN** professor designado informa nome e e-mail ainda não cadastrado
- **THEN** o sistema cria a conta sem senha e a matrícula ativa na turma

#### Scenario: E-mail já cadastrado

- **WHEN** o professor informa e-mail que já pertence a uma conta
- **THEN** a operação falha com `EMAIL_ALREADY_REGISTERED`
- **AND** nenhuma matrícula nova é criada

#### Scenario: Matrícula ativa duplicada

- **WHEN** o aluno já possui matrícula ativa
- **THEN** a operação falha com `STUDENT_ALREADY_ENROLLED`

### Requirement: Convite de ingresso na turma

O sistema SHALL permitir ao professor designado emitir, consultar e revogar convite aberto de uso
múltiplo para uma única turma ativa. O prazo SHALL ser obrigatório e futuro; o convite SHALL conceder
somente o papel `STUDENT` e a matrícula da turma vinculada.

#### Scenario: Convite válido

- **WHEN** professor designado informa prazo futuro para turma ativa
- **THEN** o sistema cria convite ativo e devolve endereço de ingresso

#### Scenario: Prazo inválido

- **WHEN** o prazo está ausente ou no passado
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Convite revogado

- **WHEN** o professor revoga convite emitido
- **THEN** novas aceitações daquele endereço são recusadas com `INVITATION_REVOKED`

### Requirement: Aceitação pública do convite de turma

O sistema SHALL permitir, sem autenticação, aceitar convite de turma ativo informando nome, e-mail e
senha. A aceitação SHALL criar a conta `STUDENT` e a matrícula na turma do convite, SHALL revalidar
expiração, revogação, e-mail existente e matrícula ativa, e NÃO DEVE permitir escolher papel, turma ou
instituição. A aceitação NÃO DEVE estabelecer sessão.

#### Scenario: Aceitação concluída

- **WHEN** visitante fornece nome, e-mail livre e senha válida para convite ativo
- **THEN** o sistema cria a conta `STUDENT` e a matrícula ativa na turma indicada
- **AND** não estabelece sessão

#### Scenario: Convite indisponível

- **WHEN** o convite está expirado ou revogado
- **THEN** a aceitação falha com o código correspondente e nenhum registro é criado

#### Scenario: Vaga ou matrícula indisponível

- **WHEN** o e-mail já possui conta ou matrícula ativa
- **THEN** a aceitação falha com `EMAIL_ALREADY_REGISTERED` ou `STUDENT_ALREADY_ENROLLED`

### Requirement: Contrato HTTP de turma

Os endpoints de turma SHALL exigir as permissões `COHORT:*`, `ENROLLMENT:*` ou `INVITATION:*` conforme
a operação e SHALL usar o envelope, a paginação, os códigos estáveis e a especificação OpenAPI da API.

#### Scenario: Acesso fora do escopo

- **WHEN** ator autenticado chama endpoint para turma fora dos seus vínculos
- **THEN** a resposta tem status HTTP `403` e código `PERMISSION_DENIED`

#### Scenario: Convite público

- **WHEN** visitante consulta ou aceita endereço de convite válido
- **THEN** a operação não exige sessão e a resposta segue o envelope HTTP publicado

## MODIFIED Requirements

### Requirement: Aceitação do convite

O sistema SHALL permitir, sem autenticação, aceitar um convite ativo informando nome e senha, criando a
conta com o papel e o vínculo institucional declarados no convite. Quando o convite também declarar uma
turma validada pelo módulo emissor, a aceitação SHALL criar a matrícula ativa nessa turma na mesma
operação lógica. Em convite dirigido, o e-mail SHALL ser o do convite e NÃO DEVE ser informado pelo
solicitante; em convite aberto, o e-mail SHALL ser informado e NÃO DEVE pertencer a conta existente. A
aceitação NÃO DEVE permitir escolher papel, instituição, turma ou qualquer outro atributo além de nome,
senha e, no convite aberto, e-mail. A aceitação NÃO DEVE estabelecer sessão.

#### Scenario: Aceitação de convite dirigido

- **WHEN** nome e senha conformes são informados para convite dirigido ativo
- **THEN** a conta é criada com o e-mail, o papel e a instituição do convite
- **AND** o convite passa a esgotado

#### Scenario: Aceitação de convite aberto

- **WHEN** nome, e-mail livre e senha conformes são informados para convite aberto ativo
- **THEN** a conta é criada com o e-mail informado e com o papel e a instituição do convite

#### Scenario: Aceitação de convite de turma

- **WHEN** nome, e-mail livre e senha conformes são informados para convite de turma ativo
- **THEN** a conta é criada com papel `STUDENT`
- **AND** a matrícula ativa é criada na turma declarada pelo convite

#### Scenario: Papel ou escopo submetido é desconsiderado

- **WHEN** a aceitação inclui papel, instituição ou turma no corpo
- **THEN** os valores são desconsiderados e prevalecem os do convite

#### Scenario: E-mail já registrado

- **WHEN** a aceitação de convite aberto informa e-mail de conta existente
- **THEN** a operação falha com `EMAIL_ALREADY_REGISTERED` e nenhuma conta ou matrícula é criada

#### Scenario: Senha fora da política

- **WHEN** a aceitação informa senha que não satisfaz a política
- **THEN** a operação falha com `VALIDATION_FAILED` e nenhum registro é criado

#### Scenario: Convite expirado

- **WHEN** a aceitação ocorre após o prazo de validade
- **THEN** a operação falha com `INVITATION_EXPIRED`

#### Scenario: Convite revogado

- **WHEN** a aceitação ocorre sobre convite revogado
- **THEN** a operação falha com `INVITATION_REVOKED`

#### Scenario: Sessão não é estabelecida

- **WHEN** uma aceitação conclui com sucesso
- **THEN** nenhuma sessão é estabelecida, e o usuário autentica-se pelo fluxo comum

#### Scenario: Duas aceitações simultâneas do mesmo convite dirigido

- **WHEN** duas aceitações do mesmo convite dirigido são processadas concorrentemente
- **THEN** exatamente uma cria conta, e a outra falha
