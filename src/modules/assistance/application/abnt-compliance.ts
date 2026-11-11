import type { JsonValue } from '@modules/article/contracts/article.dto';
import type { AssistanceIssueDto } from '../contracts/assistance.dto';

type JsonRecord = Record<string, unknown>;

/**
 * Compara medidas fornecidas pelo editor com regras verificáveis de apresentação ABNT.
 * As NBR 14724:2024, 10520:2023 e 6023:2025 são usadas para margens, paginação,
 * títulos, citações, referências, tamanho de fonte recomendado e espaçamentos. Recuo de
 * parágrafo e alinhamento do corpo são registrados, mas não recebem um valor prescritivo
 * porque a norma deixa o projeto gráfico a cargo do autor.
 */
export function checkAbntFormatting(formatProfile: JsonValue): AssistanceIssueDto[] {
  const issues: AssistanceIssueDto[] = [];
  const profile = asRecord(formatProfile);
  const has = (key: string) => Object.hasOwn(profile, key);
  const add = (
    code: string,
    path: string,
    evidence?: string,
    severity: AssistanceIssueDto['severity'] = 'ERROR',
  ) => {
    issues.push({
      code,
      category: 'FORMATTING',
      path,
      severity,
      ...(evidence ? { evidence } : {}),
    });
  };
  const missing = (path: string) =>
    add('FORMAT_PROFILE_MISSING', `formatProfile.${path}`, undefined, 'UNVERIFIED');
  const object = (key: string): JsonRecord | null => {
    if (!has(key)) {
      missing(key);
      return null;
    }
    const value = asRecord(profile[key]);
    if (Object.keys(value).length === 0) {
      missing(key);
      return null;
    }
    return value;
  };
  const numberAt = (
    record: JsonRecord,
    key: string,
    path: string,
    expected?: number,
    tolerance = 0.01,
  ): number | null => {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      missing(path);
      return null;
    }
    if (expected !== undefined && Math.abs(value - expected) > tolerance)
      add(
        'ABNT_VALUE_MISMATCH',
        `formatProfile.${path}`,
        `observed=${value}; expected=${expected}`,
      );
    return value;
  };
  const stringAt = (record: JsonRecord, key: string, path: string): string | null => {
    const value = record[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      missing(path);
      return null;
    }
    return value;
  };

  const norm = stringAt(profile, 'norm', 'norm');
  if (norm && norm.toUpperCase() !== 'ABNT')
    add('ABNT_VALUE_MISMATCH', 'formatProfile.norm', `observed=${norm}; expected=ABNT`);

  const margins = object('margins');
  if (margins) {
    numberAt(margins, 'topCm', 'margins.topCm', 3);
    numberAt(margins, 'bottomCm', 'margins.bottomCm', 2);
    if (margins.twoSided === true) {
      numberAt(margins, 'insideCm', 'margins.insideCm', 3);
      numberAt(margins, 'outsideCm', 'margins.outsideCm', 2);
    } else if (margins.twoSided === false) {
      numberAt(margins, 'leftCm', 'margins.leftCm', 3);
      numberAt(margins, 'rightCm', 'margins.rightCm', 2);
    } else missing('margins.twoSided');
    const pageSize = stringAt(margins, 'paperSize', 'margins.paperSize');
    if (pageSize && pageSize.toUpperCase() !== 'A4')
      add(
        'ABNT_VALUE_MISMATCH',
        'formatProfile.margins.paperSize',
        `observed=${pageSize}; expected=A4`,
      );
  }

  const font = object('font');
  let bodyFontSize: number | null = null;
  if (font) {
    stringAt(font, 'family', 'font.family');
    bodyFontSize = numberAt(font, 'bodySizePt', 'font.bodySizePt');
    const auxiliarySize = numberAt(font, 'auxiliarySizePt', 'font.auxiliarySizePt');
    if (bodyFontSize !== null && bodyFontSize !== 12)
      add(
        'ABNT_RECOMMENDED_VALUE_MISMATCH',
        'formatProfile.font.bodySizePt',
        `observed=${bodyFontSize}; recommended=12`,
        'RECOMMENDATION',
      );
    if (bodyFontSize !== null && auxiliarySize !== null && auxiliarySize >= bodyFontSize)
      add(
        'ABNT_VALUE_MISMATCH',
        'formatProfile.font.auxiliarySizePt',
        `observed=${auxiliarySize}; expected=smaller than body (${bodyFontSize})`,
      );
  }

  const lineSpacing = object('lineSpacing');
  if (lineSpacing) {
    numberAt(lineSpacing, 'body', 'lineSpacing.body', 1.5);
    numberAt(lineSpacing, 'references', 'lineSpacing.references', 1);
    numberAt(lineSpacing, 'referenceSeparation', 'lineSpacing.referenceSeparation', 1);
    numberAt(lineSpacing, 'captions', 'lineSpacing.captions', 1);
    numberAt(lineSpacing, 'longQuotation', 'lineSpacing.longQuotation', 1);
  }

  const firstLineIndent = profile.firstLineIndent;
  if (firstLineIndent === undefined) missing('firstLineIndent');
  else if (typeof firstLineIndent === 'number') {
    if (!Number.isFinite(firstLineIndent) || firstLineIndent < 0)
      add('ABNT_VALUE_INVALID', 'formatProfile.firstLineIndent', String(firstLineIndent));
  } else {
    const indent = asRecord(firstLineIndent);
    numberAt(indent, 'bodyCm', 'firstLineIndent.bodyCm');
  }

  const alignment = object('alignment');
  if (alignment) {
    for (const key of ['body', 'references', 'longQuotation']) {
      const value = stringAt(alignment, key, `alignment.${key}`);
      if (value && !['LEFT', 'RIGHT', 'CENTER', 'JUSTIFIED'].includes(value.toUpperCase()))
        add('ABNT_VALUE_INVALID', `formatProfile.alignment.${key}`, value);
      else if (key === 'references' && value && value.toUpperCase() !== 'LEFT')
        add('ABNT_VALUE_MISMATCH', 'formatProfile.alignment.references', 'expected=LEFT');
    }
  }

  const pageNumbering = object('pageNumbering');
  if (pageNumbering) {
    const visibleFrom = stringAt(pageNumbering, 'visibleFrom', 'pageNumbering.visibleFrom');
    if (visibleFrom && visibleFrom !== 'FIRST_TEXTUAL_PAGE')
      add(
        'ABNT_VALUE_MISMATCH',
        'formatProfile.pageNumbering.visibleFrom',
        `observed=${visibleFrom}; expected=FIRST_TEXTUAL_PAGE`,
      );
    const countedFrom = stringAt(pageNumbering, 'countedFrom', 'pageNumbering.countedFrom');
    if (countedFrom && countedFrom !== 'TITLE_PAGE')
      add(
        'ABNT_VALUE_MISMATCH',
        'formatProfile.pageNumbering.countedFrom',
        `observed=${countedFrom}; expected=TITLE_PAGE`,
      );
    const position = stringAt(pageNumbering, 'position', 'pageNumbering.position');
    if (position && !['TOP_RIGHT', 'RECTO_TOP_RIGHT_VERSO_TOP_LEFT'].includes(position))
      add(
        'ABNT_VALUE_MISMATCH',
        'formatProfile.pageNumbering.position',
        `observed=${position}; expected=TOP_RIGHT or RECTO_TOP_RIGHT_VERSO_TOP_LEFT`,
      );
  }

  checkHeadingStyles(profile.headingStyles, add, missing);
  checkCaptions(profile.captions, missing);
  checkLongQuotations(profile.longQuotation, bodyFontSize, add, missing, numberAt, stringAt);
  return issues;
}

function checkHeadingStyles(
  value: unknown,
  add: (
    code: string,
    path: string,
    evidence?: string,
    severity?: AssistanceIssueDto['severity'],
  ) => void,
  missing: (path: string) => void,
): void {
  if (!Array.isArray(value)) {
    missing('headingStyles');
    return;
  }
  value.forEach((entry, index) => {
    const heading = asRecord(entry);
    const path = `headingStyles[${index}]`;
    const role = typeof heading.role === 'string' ? heading.role : 'SECTION';
    const titleAlignment = typeof heading.alignment === 'string' ? heading.alignment : null;
    if (typeof heading.path !== 'string' || heading.path.trim().length === 0)
      missing(`${path}.path`);
    if (role === 'SECTION') {
      if (heading.numbered !== true)
        add('ABNT_VALUE_MISMATCH', `formatProfile.${path}.numbered`, 'expected=true');
      if (titleAlignment === null) missing(`${path}.alignment`);
      else if (titleAlignment.toUpperCase() !== 'LEFT')
        add('ABNT_VALUE_MISMATCH', `formatProfile.${path}.alignment`, 'expected=LEFT');
      if (typeof heading.level !== 'number' || heading.level < 1 || heading.level > 6)
        missing(`${path}.level`);
    } else if (role === 'UNNUMBERED') {
      if (titleAlignment === null) missing(`${path}.alignment`);
      else if (titleAlignment.toUpperCase() !== 'CENTER')
        add('ABNT_VALUE_MISMATCH', `formatProfile.${path}.alignment`, 'expected=CENTER');
    } else add('HEADING_ROLE_UNVERIFIED', `formatProfile.${path}.role`, role, 'UNVERIFIED');
  });
}

function checkCaptions(value: unknown, missing: (path: string) => void): void {
  if (!Array.isArray(value)) {
    missing('captions');
    return;
  }
  value.forEach((entry, index) => {
    const caption = asRecord(entry);
    const path = `captions[${index}]`;
    for (const field of ['path', 'kind', 'number', 'title', 'source'])
      if (typeof caption[field] !== 'string' || caption[field].trim().length === 0)
        missing(`${path}.${field}`);
  });
}

function checkLongQuotations(
  value: unknown,
  bodyFontSize: number | null,
  add: (
    code: string,
    path: string,
    evidence?: string,
    severity?: AssistanceIssueDto['severity'],
  ) => void,
  missing: (path: string) => void,
  numberAt: (
    record: JsonRecord,
    key: string,
    path: string,
    expected?: number,
    tolerance?: number,
  ) => number | null,
  stringAt: (record: JsonRecord, key: string, path: string) => string | null,
): void {
  if (!Array.isArray(value)) {
    missing('longQuotation');
    return;
  }
  value.forEach((entry, index) => {
    const quotation = asRecord(entry);
    const path = `longQuotation[${index}]`;
    stringAt(quotation, 'path', `${path}.path`);
    const lines = numberAt(quotation, 'lineCount', `${path}.lineCount`);
    if (lines !== null && lines <= 3) return;
    const indent = numberAt(quotation, 'leftIndentCm', `${path}.leftIndentCm`);
    const spacing = numberAt(quotation, 'lineSpacing', `${path}.lineSpacing`, 1);
    const fontSize = numberAt(quotation, 'fontSizePt', `${path}.fontSizePt`);
    if (fontSize !== null && bodyFontSize !== null && fontSize >= bodyFontSize)
      add(
        'ABNT_VALUE_MISMATCH',
        `formatProfile.${path}.fontSizePt`,
        `observed=${fontSize}; expected=smaller than body (${bodyFontSize})`,
      );
    if (indent !== null && indent !== 4)
      add(
        'ABNT_RECOMMENDED_VALUE_MISMATCH',
        `formatProfile.${path}.leftIndentCm`,
        `observed=${indent}; recommended=4`,
        'RECOMMENDATION',
      );
    void spacing;
  });
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}
