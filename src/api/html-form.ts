/*
 * TEMPORARY / WORKAROUND FOR MISSING JSON ENDPOINTS — HTML scraping helpers.
 *
 * Login (/web/login) and signup (/web/signup) only exist as browser HTML form routes. These
 * helpers read what a browser would: the form's hidden fields (CSRF token etc.), its <select>
 * options, and the alert message Odoo renders on errors. They break if the web templates change;
 * delete them once the backend offers JSON endpoints (see CLAUDE.md, "Known Blockers").
 */

/** The HTML of the first <form> whose class list contains `formClass`, if any. */
export function extractForm(html: string, formClass: string): string | undefined {
  const formStart = html.search(new RegExp(`<form\\b[^>]*\\bclass=["'][^"']*\\b${formClass}\\b`, 'i'));
  const formEnd = formStart === -1 ? -1 : html.indexOf('</form>', formStart);
  return formStart !== -1 && formEnd !== -1 ? html.slice(formStart, formEnd) : undefined;
}

/** Reads an attribute value from a single tag. */
export function tagAttribute(tag: string, name: string): string | undefined {
  // Whitespace before the name so e.g. `data-name=` isn't mistaken for `name=`.
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  const value = match ? (match[1] ?? match[2]) : undefined;
  return value === undefined ? undefined : decodeEntities(value);
}

/** Every `<input type="hidden">` in the form, name → value (missing value = ''). */
export function extractHiddenFields(form: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [input] of form.matchAll(/<input\b[^>]*>/gi)) {
    const name = tagAttribute(input, 'name');
    if (tagAttribute(input, 'type')?.toLowerCase() === 'hidden' && name) {
      fields[name] = tagAttribute(input, 'value') ?? '';
    }
  }
  return fields;
}

/** The non-empty `<option value="…">label</option>` entries of `<select name="…">`. */
export function extractSelectOptions(
  form: string,
  selectName: string
): { value: string; label: string }[] {
  const select = form.match(
    new RegExp(`<select\\b[^>]*\\sname=["']${selectName}["'][^>]*>([\\s\\S]*?)</select>`, 'i')
  )?.[1];
  if (!select) {
    return [];
  }
  const options: { value: string; label: string }[] = [];
  for (const match of select.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const value = tagAttribute(match[1], 'value');
    const label = htmlToText(match[2]);
    if (value && label) {
      options.push({ value, label });
    }
  }
  return options;
}

export type Alert = { level: 'danger' | 'success' | 'info' | 'warning'; message: string };

/**
 * Finds the first Bootstrap alert (`class="alert alert-<level>"`, how Odoo's auth templates
 * render `error` and `message`) — inside the form first, then anywhere on the page.
 */
export function extractAlert(html: string, formClass: string): Alert | undefined {
  const form = extractForm(html, formClass);
  return (form && findAlert(form)) || findAlert(html);
}

function findAlert(html: string): Alert | undefined {
  const pattern = /<(p|div)\b[^>]*\bclass=["']([^"']*)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(pattern)) {
    const classes = match[2].split(/\s+/);
    if (!classes.includes('alert')) {
      continue;
    }
    const level = (['danger', 'success', 'info', 'warning'] as const).find((l) =>
      classes.includes(`alert-${l}`)
    );
    const message = htmlToText(match[3]);
    if (level && message) {
      return { level, message };
    }
  }
  return undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
