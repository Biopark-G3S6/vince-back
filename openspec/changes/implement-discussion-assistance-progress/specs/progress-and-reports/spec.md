## Purpose

Definir visões de acompanhamento e apuração da produção acadêmica com alcance limitado aos vínculos do ator.

## ADDED Requirements

### Requirement: Acompanhamento de equipes orientadas (RF-ACP-001)

O sistema SHALL apresentar ao orientador responsável suas equipes, evento, integrantes, estado do artigo, etapa e prazo, entrega espontânea ou automática, quantidade de apontamentos pendentes e tempo desde a última edição do texto. A visão SHALL destacar sinais ativos e SHALL NOT alterar artigo, apontamento ou nota.

#### Scenario: Equipes do próprio orientador

- **WHEN** orientador consulta acompanhamento
- **THEN** vê os dados obrigatórios somente das equipes de que é responsável

#### Scenario: Nenhuma equipe

- **WHEN** orientador ainda não tem equipe responsável
- **THEN** o sistema apresenta resultado vazio

#### Scenario: Ordenar e filtrar

- **WHEN** orientador ordena ou filtra a lista de equipes
- **THEN** o sistema aplica os critérios à lista limitada às equipes sob sua responsabilidade

### Requirement: Acompanhamento do curso (RF-ACP-002)

O sistema SHALL apresentar ao coordenador eventos que alcancem seu curso e, por evento, cronograma, quantidade de equipes, entregas da etapa corrente, sinais ativos e artigos concluídos. O detalhe SHALL conter os mesmos dados do acompanhamento de equipe. A consulta SHALL ser somente leitura.

#### Scenario: Alcance do curso

- **WHEN** coordenador consulta acompanhamento
- **THEN** vê somente eventos de seu curso, turmas do curso ou escopo institucional que alcance o curso

#### Scenario: Outro curso

- **WHEN** coordenador tenta consultar evento sem alcance sobre seu curso
- **THEN** o sistema não revela os dados do evento

#### Scenario: Curso sem eventos

- **WHEN** não há eventos no período consultado
- **THEN** o sistema apresenta resultado vazio

### Requirement: Sinalização de risco (RF-ACP-003)

O sistema SHALL identificar no mínimo inatividade prolongada, duas entregas automáticas consecutivas, apontamentos pendentes acumulados, integrante sem edição e proximidade de prazo sem alteração desde a devolução. O sinal SHALL ser dirigido ao orientador responsável e ao coordenador, nunca à equipe; condições ainda ativas SHALL NOT gerar notificações repetidas. O sinal SHALL cessar automaticamente quando a condição deixar de valer e SHALL NOT alterar estado, nota ou avaliação.

#### Scenario: Ativação de condição

- **WHEN** uma condição de risco passa a valer
- **THEN** o sinal fica ativo e o orientador responsável e coordenador são notificados uma vez

#### Scenario: Condição persiste

- **WHEN** uma condição já sinalizada permanece ativa
- **THEN** o sinal continua ativo sem nova notificação repetida

#### Scenario: Condição cessa

- **WHEN** os fatos deixam de satisfazer a condição
- **THEN** o sistema desativa o sinal sem ação manual

### Requirement: Contribuição por integrante (RF-ACP-004)

O sistema SHALL apresentar ao orientador responsável autoria por trecho, sessões de edição, atendimento a apontamentos e participação na discussão. A apresentação SHALL declarar que volume de texto não mede contribuição. O sistema SHALL NOT sugerir, calcular ou ordenar notas/desempenho e SHALL NOT expor o quadro à equipe.

#### Scenario: Integrante sem edição

- **WHEN** integrante nunca editou o artigo
- **THEN** o quadro apresenta contribuição nula para atividade registrada na plataforma

#### Scenario: Artigo importado sem histórico próprio

- **WHEN** o artigo foi importado sem histórico de edição do sistema
- **THEN** o sistema informa que não pode afirmar a divisão do trabalho com base no histórico ausente

#### Scenario: Acesso do aluno

- **WHEN** integrante tenta consultar o quadro de contribuição
- **THEN** o acesso é recusado

### Requirement: Relatório de produção do curso (RF-ACP-005)

O sistema SHALL permitir ao coordenador do curso ou administrador institucional gerar relatório por curso e período, respondendo quantas equipes houve por evento, artigos concluídos e não concluídos, alunos participantes, notas dos artigos e individuais, publicações externas registradas e equipes atrasadas com etapa. O relatório SHALL apresentar apenas fatos registrados, sem conteúdo de artigo, apontamentos, discussão, juízo, projeção ou recomendação.

#### Scenario: Período com produção

- **WHEN** ator autorizado solicita relatório para curso e período
- **THEN** o relatório responde todas as perguntas obrigatórias e limita-se aos dados do curso alcançado

#### Scenario: Período sem dados

- **WHEN** o período não tem produção registrada
- **THEN** o sistema retorna relatório vazio como resultado válido

#### Scenario: Curso fora do alcance

- **WHEN** ator solicita relatório para curso fora de sua titularidade
- **THEN** o sistema responde `PERMISSION_DENIED`

#### Scenario: Consolidação pendente

- **WHEN** a consolidação do período ainda está em andamento
- **THEN** o sistema responde `REPORT_NOT_READY`

### Requirement: Exportação do relatório (RF-ACP-006)

O sistema SHALL exportar o relatório gerado em formato disponível, reproduzindo os mesmos dados apresentados na consulta.

#### Scenario: Exportação fiel

- **WHEN** ator autorizado exporta relatório pronto
- **THEN** o arquivo contém as mesmas respostas e dados da versão apresentada

#### Scenario: Relatório ainda não pronto

- **WHEN** ator solicita exportação durante consolidação
- **THEN** o sistema responde `REPORT_NOT_READY`
