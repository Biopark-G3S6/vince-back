# cohort-management Specification

## Purpose

Delimita a orientação por período letivo, seus professores e seus alunos, oferecendo matrícula direta e
ingresso por convite sem quebrar o isolamento do curso.

## Requirements

### Requirement: Manutenção de turma

O sistema SHALL permitir ao coordenador autorizado criar, listar, consultar por identificador, alterar e
desativar uma turma vinculada a curso ativo. A turma SHALL exigir identificação, período letivo, data de
início e data de término; a identificação SHALL ser única dentro do curso e do período letivo. Listagens
SHALL ser paginadas.

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
