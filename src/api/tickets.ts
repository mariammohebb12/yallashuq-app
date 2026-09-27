import { fetchPortalCounter, type CounterResult } from './counters';

/*
 * ---------------------------------------------------------------------------------------------
 * Helpdesk tickets (the live /my/tickets page).
 *
 * REAL, BUT COUNT ONLY: the standard portal route /my/counters returns the signed-in customer's
 * `ticket_count` as JSON (checked on staging 2026-09-27: {"ticket_count": 0}, matching the page's
 * "There are currently no Ticket for your account."). The tickets themselves are only in the
 * server-rendered /my/tickets page — no JSON route returns them (JSON call to /my/tickets → 400;
 * /api/tickets, /my/tickets_json, … → 404). Requested in
 * docs/backend-requests/010-helpdesk-tickets-list-json.md.
 * ---------------------------------------------------------------------------------------------
 */

export type TicketCountResult = CounterResult;

export function fetchTicketCount(): Promise<TicketCountResult> {
  return fetchPortalCounter('ticket_count');
}
