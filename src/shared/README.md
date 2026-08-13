# Shared

Kernel de infraestrutura transversal. Deve permanecer **pequeno e estável**: crescimento contínuo
é indicador de erosão da fronteira e motiva revisão (`ADR-0009`, implicação 3).

## O que pode viver aqui

Registro de log e correlação, tratamento de erros, tipos utilitários de base, autenticação e
autorização de borda, e carregamento de configuração (`ADR-0009 §4`).

## O que não pode

Regra de negócio, entidade de domínio, DTO de módulo, evento de módulo ou acesso a dados de
módulo (`ADR-0009 §5`). E `shared/` **nunca** importa de `modules/` (`ADR-0009 §7`) — a
dependência só aponta para dentro.

## O critério de admissão

Um símbolo só entra aqui se satisfizer **as duas** condições (`ADR-0009 §7`):

1. uso efetivo por dois ou mais módulos; **e**
2. ausência de semântica de negócio.

Semelhança sintática não basta: a extração precisa ser justificada por identidade de
responsabilidade (`ADR-0009 §8`). E se um símbolo daqui passar a variar por módulo, ele deve ser
removido e duplicado nos módulos que o usam (`ADR-0009 §9`).

Duplicação entre módulos é preferível a acoplamento (`ADR-0009 §2`). Não traga nada para cá só
para evitar repetição.
