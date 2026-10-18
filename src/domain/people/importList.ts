import { normalizeName } from '../text';

export interface ImportRow {
  name: string;
  tags: string[];
}

export interface ImportResult {
  rows: ImportRow[];
  duplicates: string[]; // ja existents o repetits dins la llista
}

/**
 * Accepta text enganxat de l'Excel (columnes separades per tabulador) o CSV amb ; o ,
 * Columna 1: nom. Columna 2 (opcional): etiquetes separades per | o espais/comes dins la cel·la.
 * Si la primera línia sembla una capçalera ("nom"), s'ignora.
 */
export function parseImportList(text: string, existingNames: readonly string[] = []): ImportResult {
  const seen = new Set(existingNames.map(normalizeName));
  const rows: ImportRow[] = [];
  const duplicates: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
    const cells = sep ? line.split(sep).map((c) => c.trim()) : [line];
    const name = cells[0].replace(/^"|"$/g, '').trim();
    if (!name) return;
    if (i === 0 && /^(nom|name|persona)$/i.test(name)) return;
    const key = normalizeName(name);
    if (seen.has(key)) {
      duplicates.push(name);
      return;
    }
    seen.add(key);
    const tags = (cells[1] ?? '')
      .split(/[|,]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    rows.push({ name, tags: [...new Set(tags)] });
  });
  return { rows, duplicates };
}

/** "vegà, no beu" → ["vegà","no beu"] */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
}
