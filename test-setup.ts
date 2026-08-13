/**
 * Preparação do ambiente de teste (ADR-0024 §11 a §15).
 *
 * Cada processo paralelo opera em schema próprio, identificado por VITEST_POOL_ID (§11).
 * As tabelas são truncadas entre testes (§12).
 *
 * Transação revertida NÃO é usada como isolamento (§13): o caso de uso abre a própria
 * transação (ADR-0019 §1), o que produziria aninhamento e commit efetivo.
 *
 * Repositórios são exercitados contra PostgreSQL e Redis reais (§9); substituto em
 * memória é proibido (§10) porque não reproduz transação, índice nem dialeto.
 */

const poolId = process.env.VITEST_POOL_ID ?? '1';

process.env.TEST_SCHEMA_SUFFIX = `_test_${poolId}`;

// TODO: ao introduzir o primeiro módulo com persistência, implementar aqui:
//   beforeAll  criar os schemas do processo e aplicar as migrações
//   beforeEach truncar as tabelas dos schemas do processo
//   afterAll   remover os schemas do processo
