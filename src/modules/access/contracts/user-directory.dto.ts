import type { Page, PageRequest } from '@shared/http/pagination';

/**
 * Uma pessoa no diretório. `email` e `roleCodes` só constam para quem pode designar
 * pessoas; na resolução de nomes, ficam ausentes.
 */
export interface DirectoryUserDto {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly active?: boolean;
  readonly roleCodes?: readonly string[];
}

export interface SearchDirectoryQuery {
  readonly actorId: string;
  readonly request: PageRequest;
  readonly search?: string;
  readonly role?: string;
  readonly active?: boolean;
  readonly ids?: readonly string[];
  readonly institutionId?: string;
}

export type DirectoryPage = Page<DirectoryUserDto>;
