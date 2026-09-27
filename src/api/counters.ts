import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc } from './odoo-client';

/*
 * The standard Odoo portal route POST /my/counters ({counters: [...]}) → {<name>: number}.
 * Real JSON. Only use counters checked against their page on staging: ticket_count and
 * quotation_count matched (2026-09-27); order_count did NOT (said 1 with 13 orders, see #005).
 */

export type CounterResult = { ok: true; count: number } | { ok: false; message: string };

export async function fetchPortalCounter(
  name: 'ticket_count' | 'quotation_count'
): Promise<CounterResult> {
  try {
    const result = await odooJsonRpc<Record<string, unknown>>('/my/counters', {
      counters: [name],
    });
    const count = result?.[name];
    if (typeof count !== 'number') {
      return { ok: false, message: UNEXPECTED_RESPONSE_MESSAGE };
    }
    return { ok: true, count };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}
