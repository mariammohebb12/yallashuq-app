import { extractAlert, extractHiddenFields } from './html-form';
import { NETWORK_ERROR_MESSAGE } from './messages';
import { odooRequest } from './odoo-client';

/*
 * Contact Us: the live /contactus form, submitted the way a browser does.
 *
 * TEMPORARY / WORKAROUND FOR A MISSING JSON ENDPOINT (same approach as login/signup, see
 * html-form.ts). The live form is a plain HTML POST (no JS) to /contactus/submit with a
 * csrf_token and the fields name, email, phone, subject, message_text. Checked on staging
 * 2026-09-27 (one real test message sent):
 * - valid → 303 redirect to /contactus?submitted=1 (the page then shows the success alert — but
 *   that alert appears for ANY visit to ?submitted=1, so success is judged by the redirect only)
 * - missing name/email/message → 200, the form again with an alert-danger
 *   ("Name, email, and message are required.")
 * - JSON or no csrf_token → 400
 * Where the backend stores the message (lead, email, …) can't be seen from outside.
 * Replace with the JSON route in docs/backend-requests/008-contact-us-json.md once it exists.
 */

const CONTACT_PAGE = '/contactus';
const SUBMIT_PATH = '/contactus/submit';

export type ContactMessage = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

export type ContactResult = { ok: true } | { ok: false; message: string };

/** The live form has no class, so it's found by its action. */
function extractContactForm(html: string): string | undefined {
  const start = html.search(/<form\b[^>]*\baction=["']\/contactus\/submit["']/i);
  const end = start === -1 ? -1 : html.indexOf('</form>', start);
  return start !== -1 && end !== -1 ? html.slice(start, end) : undefined;
}

export async function sendContactMessage(input: ContactMessage): Promise<ContactResult> {
  try {
    // Fresh csrf_token for this session (the cookie jar keeps the session the same).
    const page = await odooRequest(CONTACT_PAGE, { followRedirects: true });
    const form = extractContactForm(await page.text());
    const hidden = form ? extractHiddenFields(form) : {};
    if (!hidden.csrf_token) {
      return { ok: false, message: NETWORK_ERROR_MESSAGE };
    }

    const response = await odooRequest(SUBMIT_PATH, {
      method: 'POST',
      form: {
        ...hidden,
        name: input.name,
        email: input.email,
        phone: input.phone,
        subject: input.subject,
        message_text: input.message,
      },
    });
    if (response.location && /[?&]submitted=1\b/.test(response.location)) {
      return { ok: true };
    }
    if (response.status === 200) {
      const alert = extractAlert(await response.text(), 'ysq-contact');
      if (alert?.level === 'danger') {
        return { ok: false, message: alert.message };
      }
    }
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}
