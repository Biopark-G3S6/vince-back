/**
 * Os limites da credencial que a **borda** precisa conhecer.
 *
 * Só o que a borda usa mora aqui. A política de senha — comprimento mínimo e máximo, e o
 * que mais vier a valer — é do módulo `access`, que é dono da credencial (`ADR-0027` §5),
 * e `ADR-0009` §5 proíbe dado de módulo em `shared/`. O que sobra para este arquivo é o
 * limite do e-mail, que a borda aplica para não levar ao módulo uma cadeia de megabytes.
 */
export const EMAIL_MAX_LENGTH = 254;
