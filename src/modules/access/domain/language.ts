/**
 * Os idiomas que o sistema suporta — declaração única (`ADR-0026` §3).
 *
 * `pt-BR` é o idioma padrão e o único publicado no lançamento. Acrescentar idioma é
 * trabalho de catálogo e NÃO deve exigir alteração de código de feature (§4): esta
 * lista é o ponto em que ele entra do lado do backend.
 *
 * A preferência ausente é estado válido e NÃO recebe valor padrão gravado no perfil:
 * na ausência, `ADR-0026` §26 manda inferir do cabeçalho do navegador, o que é decisão
 * do cliente a cada requisição, não fato a persistir.
 */

export const DEFAULT_LANGUAGE = 'pt-BR';

export const SUPPORTED_LANGUAGES: readonly string[] = [DEFAULT_LANGUAGE];

export function isSupportedLanguage(tag: string): boolean {
  return SUPPORTED_LANGUAGES.includes(tag);
}
