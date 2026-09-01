import { ROLE } from './role-catalog';

/**
 * A conta inicial de administrador de sistema (URS §1.4.1, item 1).
 *
 * Sem ela não existe ninguém a quem atribuir o primeiro vínculo, e o sistema recém-
 * instalado não teria por onde começar. Não há autocadastro que a produza, aqui nem em
 * lugar algum: papel administrativo não se concede a si mesmo.
 *
 * **Nasce sem credencial.** A senha é dado de autenticação e nasce em
 * `add-session-authentication`; entre esta vertical e a próxima, o sistema tem um
 * administrador que não entra. Semear senha por variável de ambiente poria segredo no
 * caminho da carga inicial sem necessidade.
 *
 * **Nasce sem vínculo institucional.** O administrador de sistema atua sobre todas as
 * instituições (URS §1.4, §1.4.1 item 3), e prendê-lo a uma o tornaria incapaz de criar
 * a primeira.
 *
 * O e-mail é o que torna a carga idempotente: ele é o identificador único global
 * (RF-ACS-001 RN1), e reencontrá-lo é como a reexecução sabe que não deve criar a
 * segunda conta.
 */
export const INITIAL_SYSTEM_ADMIN = {
  email: 'admin@vinceart.local',
  /**
   * Valor de dado, não texto de interface: é o conteúdo inicial de uma coluna que o
   * próprio titular altera por RF-ACS-005. `ADR-0026` §8 veda literal destinado à
   * exibição, e este não é exibido pelo sistema — é gravado e devolvido como dado.
   */
  name: 'System Administrator',
  roleCode: ROLE.SYSTEM_ADMIN,
} as const;
