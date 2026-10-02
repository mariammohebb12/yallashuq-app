import i18n from '@/i18n';

/*
 * Shared money/date formatting, locale-aware (frontend sweep, 2026-10-02 — confirmed with
 * Mariam that the app should NOT just copy the live website's one-format-for-everyone
 * MM/DD/YYYY + plain grouping, which is what every screen's own local formatDate/formatMoney
 * used to hardcode). Digits are forced to Western (0-9) via the `-u-nu-latn` locale extension
 * on ar/he, so numbers stay unambiguous next to IDs, order numbers etc. — only the date field
 * order/separator and number grouping convention change per language, not the digits
 * themselves. Currency is unaffected: the app only ever shows real amounts in ILS (₪) or
 * passes through another currency's own code, per the existing contract on every screen.
 */

function localeTag(): string {
  const base = (i18n.language || 'en').split('-')[0];
  switch (base) {
    case 'ar':
      return 'ar-u-nu-latn';
    case 'he':
      return 'he-IL-u-nu-latn';
    case 'ru':
      return 'ru-RU';
    default:
      return 'en-US';
  }
}

function groupedNumber(amount: number): string {
  return new Intl.NumberFormat(localeTag(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

/** A plain locale-grouped number with 2 decimals, no currency symbol or sign handling. */
export function formatNumber(amount: number): string {
  return groupedNumber(amount ?? 0);
}

/** "₪ 1,234.50" (locale-grouped) for ILS/no currency; "1,234.50 USD" for anything else. */
export function formatMoney(amount: number, currency?: string | false): string {
  const value = groupedNumber(amount ?? 0);
  const sign = (amount ?? 0) < 0 ? '- ' : '';
  if (!currency || String(currency).toUpperCase() === 'ILS') {
    return `${sign}₪ ${value}`;
  }
  return `${sign}${value} ${currency}`;
}

/** Odoo datetimes are UTC ("YYYY-MM-DD HH:MM:SS" or ISO); parsed to the device's local time. */
function parseOdooValue(value: string): Date | null {
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const date = new Date(value.replace(' ', 'T') + (hasZone ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A plain "YYYY-MM-DD" date or an Odoo UTC datetime, shown in the current language's own date
 * order and separator (was hardcoded MM/DD/YYYY for every language). Anything else is shown
 * as sent, same fallback as before.
 */
export function formatDate(value: string | false | undefined | null): string {
  if (!value) {
    return '';
  }
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = plain
    ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]))
    : parseOdooValue(value);
  if (!date) {
    return value;
  }
  return new Intl.DateTimeFormat(localeTag(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** 24-hour time (no AM/PM strings to translate), same digits convention as formatDate. */
export function formatTime(
  value: string | false | undefined | null,
  withSeconds = false
): string {
  if (!value) {
    return '';
  }
  const date = parseOdooValue(value);
  if (!date) {
    return '';
  }
  return new Intl.DateTimeFormat(localeTag(), {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(date);
}

/** Odoo UTC datetime → "<locale date> <locale 24h time>"; anything unparseable is shown as sent. */
export function formatDateTime(value: string | false | undefined | null): string {
  if (!value) {
    return '';
  }
  const date = parseOdooValue(value);
  if (!date) {
    return value;
  }
  return `${formatDate(value)} ${formatTime(value)}`;
}
