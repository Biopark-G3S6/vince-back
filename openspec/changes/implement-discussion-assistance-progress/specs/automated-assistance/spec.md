## Purpose

Definir análises automatizadas como subsídios consultivos, sem decisões automáticas sobre correção, autoria ou avaliação.

## ADDED Requirements

### Requirement: Resumo de mudanças da entrega (RF-IAA-001)

O sistema SHALL apresentar ao orientador responsável resumo de mudanças entre entregas e apontamentos pendentes cujo trecho não mudou ou cuja alteração aparenta não atender ao pedido. A análise SHALL depender de consentimento institucional vigente. Sua indisponibilidade SHALL NOT impedir a correção e sua saída SHALL NOT alterar apontamentos.

#### Scenario: Resumo disponível

- **WHEN** orientador abre correção de artigo em `IN_REVIEW` com entrega anterior e consentimento vigente
- **THEN** vê resumo das mudanças e apontamentos aparentemente não atendidos

#### Scenario: Sem consentimento ou consentimento revogado

- **WHEN** não há consentimento institucional vigente
- **THEN** nenhuma chamada externa é feita, o sistema informa `AI_CONSENT_REQUIRED` e a correção permanece disponível

#### Scenario: Serviço indisponível

- **WHEN** o serviço de análise não está disponível
- **THEN** a análise é apresentada como indisponível e a correção continua normalmente

#### Scenario: Saída não decisória

- **WHEN** a análise retorna apontamento aparentemente não atendido
- **THEN** o sistema não valida, reabre, dispensa nem encerra apontamento

### Requirement: Verificação da conformidade ABNT (RF-IAA-002)

O sistema SHALL localizar divergências de formatação, estrutura e referências em relação à ABNT, incluindo vínculos entre citações e referências estruturadas. A verificação SHALL apontar sem corrigir o artigo ou bloquear entrega e SHALL NOT enviar conteúdo a serviço externo de IA. A validação estrutural da referência SHALL cobrir campos obrigatórios conhecidos e vínculos; regras específicas por tipo de fonte dependem do catálogo de tipos de referência.

O editor SHALL persistir, junto ao conteúdo, um `formatProfile` com as medidas efetivamente lidas do documento: margens e papel, fonte, entrelinhas, recuo, alinhamento, paginação, estilos de título, legendas e citações longas. Cada elemento localizado SHALL carregar o caminho do nó correspondente no documento. O perfil não substitui o conteúdo e sua ausência não será tratada como prova de divergência: o resultado usa `conformant: null` e `severity: UNVERIFIED` nos campos sem medição. Recomendações da norma usam `severity: RECOMMENDATION` e não tornam o resultado não conforme.

#### Scenario: Divergência de referência

- **WHEN** uma citação estruturada não tem referência correspondente
- **THEN** o sistema apresenta a divergência vinculada ao ponto do texto

#### Scenario: Artigo conforme

- **WHEN** nenhuma divergência coberta é encontrada
- **THEN** o sistema informa conformidade sem modificar o artigo

#### Scenario: Perfil de formatação incompleto

- **WHEN** o artigo não informa uma medida necessária à verificação
- **THEN** o resultado marca o campo como `UNVERIFIED`, usa `conformant: null` se não houver divergência comprovada, e não afirma que o artigo está conforme

#### Scenario: Recomendação de formatação

- **WHEN** uma medida diverge de recomendação da norma, como tamanho de fonte recomendado ou recuo recomendado de citação longa
- **THEN** o resultado marca a ocorrência como `RECOMMENDATION`, sem classificá-la como divergência obrigatória

#### Scenario: Citação direta sem página

- **WHEN** uma citação registrada como direta não informa a página
- **THEN** o sistema aponta a ocorrência no caminho da citação

#### Scenario: Tipo de referência sem regra cadastrada

- **WHEN** uma referência estruturada usa um tipo sem regra de elementos essenciais cadastrada
- **THEN** o sistema retorna `REFERENCE_FORMAT_UNVERIFIED` para esse registro e não afirma conformidade completa

#### Scenario: Verificação sem bloqueio

- **WHEN** o artigo apresenta divergências
- **THEN** o sistema permite que a equipe continue editando e entregue o artigo

### Requirement: Similaridade com acervo interno (RF-IAA-003)

O sistema SHALL comparar o texto com artigos existentes na própria plataforma e apresentar trechos coincidentes e proporção. A citação corretamente referenciada SHALL NOT ser contada como similaridade indevida. A origem da equipe SHALL ser visível ao orientador e ocultada do aluno.

#### Scenario: Coincidência para orientador

- **WHEN** orientador consulta resultado com trecho coincidente
- **THEN** vê trecho, proporção e artigo de origem

#### Scenario: Coincidência para aluno

- **WHEN** integrante consulta resultado de seu artigo
- **THEN** vê o trecho coincidente no próprio artigo, sem identificação da equipe de origem

#### Scenario: Acervo insuficiente

- **WHEN** não há material suficiente no acervo interno
- **THEN** o sistema informa que não há base para afirmar similaridade

### Requirement: Indícios objetivos de autoria (RF-IAA-004)

O sistema SHALL apresentar somente ao orientador responsável fatos do histórico de edição e metadados existentes de arquivo importado. O sistema SHALL NOT afirmar nem estimar que texto foi gerado por IA e SHALL NOT produzir sanção automática.

#### Scenario: Histórico consultável

- **WHEN** orientador consulta artigo com histórico suficiente
- **THEN** vê inserções grandes com autor e data, sessões, proporção revisada, autoria por integrante e metadados disponíveis

#### Scenario: Histórico insuficiente

- **WHEN** não há dados suficientes de histórico
- **THEN** o sistema informa insuficiência e não produz conclusão sobre autoria

#### Scenario: Integrante tenta consultar indícios

- **WHEN** integrante da equipe tenta consultar o quadro de indícios
- **THEN** o acesso é recusado

### Requirement: Consentimento institucional para processamento externo (RF-IAA-005)

O sistema SHALL permitir ao administrador institucional registrar e revogar consentimento para processamento externo, registrando autor, instante e versão da declaração apresentada. Sem consentimento vigente, conteúdo de artigo SHALL NOT ser enviado a serviço externo.

#### Scenario: Consentimento registrado

- **WHEN** administrador de instituição ativa registra o consentimento apresentado
- **THEN** o sistema registra instituição, autor, instante e declaração vigente

#### Scenario: Consentimento revogado

- **WHEN** administrador revoga consentimento
- **THEN** nenhuma nova análise externa daquela instituição é iniciada a partir da revogação

#### Scenario: Instituição inativa

- **WHEN** administrador tenta registrar consentimento para instituição inativa
- **THEN** o sistema responde `INSTITUTION_INACTIVE`
