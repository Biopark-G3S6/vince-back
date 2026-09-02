import type { CookieOptions, Request, Response } from 'express';

import { API_PATH_PREFIX } from '../config/environment';

/**
 * O transporte da credencial em cookie (`ADR-0013` §8, §9).
 *
 * Os quatro atributos são exigidos, e nenhum é condicional ao ambiente:
 *
 *   `HttpOnly`  script algum lê a credencial — nem o do sítio, nem o injetado nele
 *   `Secure`    só trafega sob TLS. Navegador atual trata `http://localhost` como
 *               contexto seguro, de modo que o desenvolvimento local não precisa de
 *               exceção — e uma exceção por ambiente é como um cookie sem `Secure`
 *               acaba em produção
 *   `SameSite`  `lax` é a metade da proteção anti-CSRF de §14; a outra é o token
 *   `Path`      restrito ao prefixo da API, e não `/`: o cookie não acompanha requisição
 *               a caminho que não é da API
 */
function baseOptions(maxAgeSeconds: number): CookieOptions {
  return {
    secure: true,
    sameSite: 'lax',
    path: API_PATH_PREFIX,
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setSessionCookie(
  response: Response,
  name: string,
  sessionId: string,
  maxAgeSeconds: number,
): void {
  response.cookie(name, sessionId, { ...baseOptions(maxAgeSeconds), httpOnly: true });
}

/**
 * O token anti-CSRF vai em cookie **legível por script**: o cliente precisa lê-lo para
 * devolvê-lo em cabeçalho, e é essa dupla via que o sítio atacante não consegue percorrer.
 */
export function setCsrfCookie(
  response: Response,
  name: string,
  token: string,
  maxAgeSeconds: number,
): void {
  response.cookie(name, token, { ...baseOptions(maxAgeSeconds), httpOnly: false });
}

/**
 * Descarta a credencial no cliente (RF-ACS-002). Os atributos precisam coincidir com os
 * da gravação — `Path` e `SameSite` divergentes deixariam o cookie de pé.
 */
export function clearAuthCookies(response: Response, sessionName: string, csrfName: string): void {
  const options: CookieOptions = { secure: true, sameSite: 'lax', path: API_PATH_PREFIX };

  response.clearCookie(sessionName, { ...options, httpOnly: true });
  response.clearCookie(csrfName, { ...options, httpOnly: false });
}

/** O identificador de sessão que a requisição porta, ou `null`. */
export function readSessionId(request: Request, cookieName: string): string | null {
  const cookies: unknown = (request as { cookies?: unknown }).cookies;

  if (typeof cookies !== 'object' || cookies === null) {
    return null;
  }

  const value: unknown = (cookies as Record<string, unknown>)[cookieName];

  return typeof value === 'string' && value.length > 0 ? value : null;
}
