import { Module, type DynamicModule, type ModuleMetadata, type Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import { AuthConfig } from '../config/environment';
import { GlobalExceptionFilter } from '../errors/exception.filter';
import { ResponseEnvelopeInterceptor } from '../http/envelope.interceptor';
import { AccessGuard } from './access.guard';
import { AuthController } from './auth.controller';
import { AuthenticationService } from './authentication.service';
import { CredentialVerifier } from './credential-verifier';
import { CsrfGuard } from './csrf.guard';
import { IdentityResolver } from './identity';
import { SessionStore } from './session-store';

export interface AuthModuleOptions {
  readonly config: AuthConfig;
  readonly sessions: SessionStore;
  /**
   * Os módulos que respondem pelos ports, e os providers que os ligam (decisão D1).
   *
   * Chegam por parâmetro, e não por importação, porque `shared/` **nunca** importa de
   * `modules/` (`ADR-0009` §7). Quem liga o port à implementação é o composition root da
   * aplicação, que é o único que pode conhecer os dois lados.
   */
  readonly imports: ModuleMetadata['imports'];
  readonly ports: readonly Provider[];
}

/**
 * O registro do mecanismo transversal de autenticação e autorização de borda
 * (`ADR-0013` §17, `ADR-0014` §22).
 *
 * Além das rotas de sessão e identidade, monta o que passa a valer para **todo** endpoint
 * do sistema: o envelope de resposta, o tratador global de exceções, a guarda de acesso e
 * a proteção anti-CSRF. Nenhum é opcional por rota — e é essa a razão de estarem aqui e
 * não em cada módulo: o que se pode esquecer de aplicar, um dia se esquece.
 *
 * A ordem das guardas importa. A anti-CSRF vem primeiro porque decide sobre a **forma** da
 * requisição — método e token —, sem precisar saber quem é o usuário; recusar ali poupa
 * resolver a sessão de uma requisição já condenada.
 */
@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    const { config, sessions } = options;

    return {
      module: AuthModule,
      imports: options.imports,
      controllers: [AuthController],
      providers: [
        { provide: AuthConfig, useValue: config },
        { provide: SessionStore, useValue: sessions },
        ...options.ports,
        AuthenticationService,
        {
          provide: APP_GUARD,
          useFactory: () => new CsrfGuard(config.csrfSecret, config.session.cookieName),
        },
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector, store: SessionStore, identities: IdentityResolver) =>
            new AccessGuard(reflector, store, identities, config.session.cookieName),
          inject: [Reflector, SessionStore, IdentityResolver],
        },
        { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
      exports: [AuthConfig, SessionStore, CredentialVerifier, IdentityResolver],
    };
  }
}
