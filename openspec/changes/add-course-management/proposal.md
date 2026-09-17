## Why

Sem a capacidade de curso, a instituição não consegue organizar sua oferta acadêmica nem iniciar a
cadeia de designação que leva a turmas, eventos e orientação. A mudança implementa `RF-CUR-001` e
`RF-CUR-002`, preservando o isolamento institucional já estabelecido.

## What Changes

- Introduz o cadastro, consulta, alteração e desativação idempotente de cursos.
- Introduz a designação e a revogação do coordenador de um curso, com no máximo um coordenador ativo.
- Restringe todas as operações ao escopo da instituição do ator e impede novas turmas ou eventos em
  curso desativado.
- Publica endpoints HTTP documentados em OpenAPI, usando o envelope e os códigos da API existentes.
- Declara as permissões `COURSE:*` já previstas na URS e registra os códigos de falha correspondentes.

## Capabilities

### New Capabilities

- `course-management`: manutenção de cursos e designação do coordenador (`RF-CUR-001` e `RF-CUR-002`).

### Modified Capabilities

Nenhuma.

## Impact

- Novo módulo de negócio candidato `course`, com schema PostgreSQL próprio, fachada, casos de uso,
  repositórios e controllers.
- Integração síncrona com `access` para identidade, permissões e atribuição do papel
  `COORDINATOR`; referência ao `institution` por identificador validado, sem chave estrangeira.
- A composição do catálogo de permissões e dos códigos de resposta na documentação precisa ser
  conferida antes da aplicação.
- A criação do módulo exige ADR próprio, conforme `ADR-0003 §12`, antes de qualquer implementação.
