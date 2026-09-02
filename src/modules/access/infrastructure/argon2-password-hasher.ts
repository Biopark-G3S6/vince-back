import { Algorithm, hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';

import type { PasswordHashingConfig } from '@shared/config/environment';

import { PasswordHasher } from '../domain/ports/password-hasher';

/**
 * Argon2id (decisão D2).
 *
 * Nenhum ADR fixa o algoritmo, o que faz disto decisão desta mudança. Argon2id é a
 * recomendação corrente para senha nova, e o parâmetro de memória é o que mantém alto o
 * custo do atacante — que dispõe de placas de vídeo, mas não de memória barata.
 *
 * A alternativa usual, `bcrypt`, tem limite de 72 bytes de entrada: a senha mais longa
 * seria truncada em silêncio, e caberia a alguém lembrar de pré-processá-la. É exatamente
 * o tipo de detalhe que não se lembra.
 *
 * **Trade-off aceito:** a verificação consome memória, o que faz da autenticação o
 * endpoint mais caro do sistema. Os parâmetros vêm de configuração para poderem ser
 * calibrados contra a máquina real, e não adivinhados.
 */
@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  /**
   * A derivação de referência, calculada **uma vez** na construção.
   *
   * O valor derivado é irrelevante — ninguém o confere de verdade. O que importa é que
   * conferir contra ele custe o mesmo que conferir contra a derivação de uma conta real.
   */
  private readonly reference: Promise<string>;

  constructor(private readonly config: PasswordHashingConfig) {
    super();
    this.reference = this.hash('reference-password-never-accepted');
  }

  async hash(password: string): Promise<string> {
    return hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: this.config.memoryCostKib,
      timeCost: this.config.timeCost,
      parallelism: this.config.parallelism,
    });
  }

  /**
   * Derivação ilegível é derivação que não confere. `verify` lança quando a cadeia não é
   * um hash Argon2 válido, e deixar essa exceção subir transformaria uma linha corrompida
   * em falha de `500` — e, pior, em um caminho de tempo distinto dos demais.
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await verify(hash, password);
    } catch {
      return false;
    }
  }

  async verifyAgainstReference(password: string): Promise<boolean> {
    return this.verify(await this.reference, password);
  }
}
