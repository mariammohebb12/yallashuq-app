import type { File as ExpoFile } from 'expo-file-system';

import {
  extractAlert,
  extractForm,
  extractHiddenFields,
  extractSelectOptions,
  htmlToText,
  tagAttribute,
} from './html-form';
import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc, odooRequest } from './odoo-client';

/*
 * Customer signup against yallashuq_seller/controllers/sign_up_controller.py.
 *
 * - OTP send/verify and the states list are JSON-RPC routes (real JSON, called exactly like the
 *   live site's signup script does).
 * - The signup itself is TEMPORARY / WORKAROUND FOR MISSING JSON ENDPOINT: /web/signup is an HTML
 *   form route, so (as for login) we GET the page for its hidden fields (CSRF token, …) and the
 *   real country lists, POST the form as multipart/form-data, and read the result from the
 *   redirect or the rendered page (see html-form.ts, CLAUDE.md "Known Blockers").
 *
 * OTP verification is stored server-side in the session, so every call here must go through the
 * same session — odooRequest's cookie jar takes care of that.
 */

export type SignupType = 'customer' | 'seller';

function signupPath(type: SignupType): string {
  return `/web/signup?signup_type=${type}`;
}
const SIGNUP_FORM_CLASS = 'oe_signup_form';

export type DialCode = { key: string; name: string; code: string; flagUrl: string };
export type CountryOption = { id: string; name: string };
export type StateOption = { id: string; name: string };

export type SignupForm = {
  /** Hidden inputs of the web form (csrf_token, signup_type, country_code, …), sent back as-is. */
  hiddenFields: Record<string, string>;
  /** Phone country-code list rendered by the backend. */
  dialCodes: DialCode[];
  /** The form's default phone country code (hidden `country_code`, e.g. "971"). */
  defaultDialCode: string;
  /** Address countries with their Odoo ids (`country_id`). */
  countries: CountryOption[];
  /** Seller form only: product categories with their Odoo ids (`preferred_category_id`). */
  categories: CountryOption[];
};

/** Loads the signup page: starts/reuses the session and returns the form's data. */
export async function loadSignupForm(
  type: SignupType = 'customer'
): Promise<SignupForm | { error: string }> {
  try {
    const page = await odooRequest(signupPath(type), { followRedirects: true });
    const form = extractForm(await page.text(), SIGNUP_FORM_CLASS);
    if (!form) {
      return { error: UNEXPECTED_RESPONSE_MESSAGE };
    }
    const hiddenFields = extractHiddenFields(form);
    if (!hiddenFields.csrf_token) {
      return { error: UNEXPECTED_RESPONSE_MESSAGE };
    }
    return {
      hiddenFields,
      dialCodes: extractDialCodes(form),
      defaultDialCode: hiddenFields.country_code ?? '',
      countries: extractSelectOptions(form, 'country_id').map((o) => ({
        id: o.value,
        name: o.label,
      })),
      categories: extractSelectOptions(form, 'preferred_category_id').map((o) => ({
        id: o.value,
        name: o.label,
      })),
    };
  } catch {
    return { error: NETWORK_ERROR_MESSAGE };
  }
}

/**
 * The live phone dropdown items:
 * <div class="ysq-country-item" data-code="971" data-flag-url="…/ae.png"><img/><span>Name</span>…
 */
function extractDialCodes(form: string): DialCode[] {
  const items: DialCode[] = [];
  const pattern = /(<div\b[^>]*\bclass=["']ysq-country-item["'][^>]*>)([\s\S]*?)<\/div>/gi;
  for (const [, openTag, inner] of form.matchAll(pattern)) {
    const code = tagAttribute(openTag, 'data-code');
    const flagUrl = tagAttribute(openTag, 'data-flag-url');
    const name = inner.match(/<span\b[^>]*\bflex-grow-1\b[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    if (code && flagUrl && name) {
      // Several countries share a code (+1, +7, …), so key by the flag file too.
      items.push({ key: `${flagUrl}|${code}`, name: htmlToText(name), code, flagUrl });
    }
  }
  return items;
}

export async function loadStates(countryId: string): Promise<StateOption[]> {
  const result = await odooJsonRpc<{ states?: { id: number; name: string }[] }>(
    '/web/signup/states',
    { country_id: Number(countryId) || 0 }
  );
  return (result?.states ?? []).map((s) => ({ id: String(s.id), name: s.name }));
}

/** `{status: "success" | "error", message}` as returned by the OTP routes. */
export type OtpResult = { ok: true; message?: string } | { ok: false; message: string };

async function otpCall(path: string, params: object, fallback: string): Promise<OtpResult> {
  try {
    const result = await odooJsonRpc<{ status?: string; message?: string } | null>(path, params);
    if (result?.status === 'success') {
      return { ok: true, message: result.message };
    }
    return { ok: false, message: result?.message || fallback };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}

// Fallback messages are the live signup script's own ('Error sending OTP', 'Invalid code').
export function sendEmailOtp(email: string) {
  return otpCall('/web/signup/email/send_otp', { login_email: email }, 'Error sending OTP');
}

export function verifyEmailOtp(email: string, otp: string) {
  return otpCall('/web/signup/email/verify_otp', { login_email: email, otp }, 'Invalid code');
}

/*
 * KNOWN CURRENT LIMITATION: WhatsApp OTP sending is not yet configured on the backend (as of
 * Sept 2026). This means /web/signup/whatsapp/send_otp may fail or send nothing right now, which
 * blocks phone verification, which blocks all signup — this is a backend/infra gap outside the
 * mobile app, not a bug here. The code is built to work correctly the moment WhatsApp gets
 * configured server-side; no app changes should be needed when that happens.
 * (Observed on staging: {status: "error", message: "Failed to send WhatsApp message. Please check
 * the number or try again later."})
 */
export function sendWhatsappOtp(phone: string, countryCode: string) {
  return otpCall(
    '/web/signup/whatsapp/send_otp',
    { phone, country_code: countryCode },
    'Error sending OTP'
  );
}

/** The backend remembers which number the code was sent to (session), so only the code is sent. */
export function verifyWhatsappOtp(otp: string) {
  return otpCall('/web/signup/whatsapp/verify_otp', { otp }, 'Invalid code');
}

export type SignupFields = {
  name: string;
  /** Email (optional) — the web form's field is named `login`. */
  login: string;
  phone: string;
  countryCode: string;
  /** YYYY-MM-DD, as an HTML date input sends it. */
  dob: string;
  street: string;
  street2: string;
  city: string;
  stateId: string;
  countryId: string;
  zip: string;
  bankAccountNo: string;
  bankIfsc: string;
  password: string;
  confirmPassword: string;
  /**
   * Values for the hidden `email_verified` / `phone_verified` inputs, exactly as the backend's own
   * frontend fills them (yallashuq_seller/static/src/js/signup_validation.js, served in
   * web.assets_frontend_lazy): after a successful verify_otp, `email_verified` = the email
   * address and `phone_verified` = country code + phone digits, no "+" (e.g. "971501234567");
   * '' when not verified. The backend also checks verification in the session.
   */
  emailVerified: string;
  phoneVerified: string;
};

/** Extra fields of the seller form (signup_type=seller). */
export type SellerSignupFields = {
  companyName: string;
  /** `preferred_category_id` (Odoo id from the seller page's Category select). */
  categoryId: string;
  taxId: string;
  /** `personal_id_doc`: image or PDF, required. */
  idDocument: ExpoFile;
  /** The web form's `accept_terms` checkbox (no value attribute, so browsers send "on"). */
  acceptTerms: boolean;
};

export type SignupResult =
  | { kind: 'success'; redirect: string }
  | { kind: 'error'; message: string }
  | { kind: 'info'; message: string };

export async function submitSignup(
  hiddenFields: Record<string, string>,
  fields: SignupFields,
  profileImage?: ExpoFile,
  /** Pass for a seller signup; omit for a customer signup. */
  seller?: SellerSignupFields
): Promise<SignupResult> {
  const type: SignupType = seller ? 'seller' : 'customer';
  const values: Record<string, string> = {
    // Hidden fields first (csrf_token, signup_type, …), then everything the user entered.
    ...hiddenFields,
    signup_type: type,
    name: fields.name,
    login: fields.login,
    phone: fields.phone,
    country_code: fields.countryCode,
    dob: fields.dob,
    street: fields.street,
    street2: fields.street2,
    city: fields.city,
    state_id: fields.stateId,
    country_id: fields.countryId,
    zip: fields.zip,
    bank_account_no: fields.bankAccountNo,
    bank_ifsc: fields.bankIfsc,
    password: fields.password,
    confirm_password: fields.confirmPassword,
    email_verified: fields.emailVerified,
    phone_verified: fields.phoneVerified,
  };
  if (seller) {
    values.company_name = seller.companyName;
    values.preferred_category_id = seller.categoryId;
    values.tax_id = seller.taxId;
    if (seller.acceptTerms) {
      values.accept_terms = 'on';
    }
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value);
  }
  if (seller) {
    // Same expo-file-system File upload as profile_image (verified on the simulator).
    formData.append('personal_id_doc', seller.idDocument as unknown as Blob);
  }
  if (profileImage) {
    // expo/fetch uploads expo-file-system File objects (it does not support {uri} parts).
    formData.append('profile_image', profileImage as unknown as Blob);
  }

  try {
    const response = await odooRequest(signupPath(type), { method: 'POST', formData });
    if (response.location) {
      // Redirected back to the signup page = not signed up.
      if (new URL(response.location).pathname.startsWith('/web/signup')) {
        return { kind: 'error', message: UNEXPECTED_RESPONSE_MESSAGE };
      }
      return { kind: 'success', redirect: response.location };
    }
    const alert = extractAlert(await response.text(), SIGNUP_FORM_CLASS);
    if (alert) {
      return alert.level === 'danger'
        ? { kind: 'error', message: alert.message }
        : { kind: 'info', message: alert.message };
    }
    return { kind: 'error', message: UNEXPECTED_RESPONSE_MESSAGE };
  } catch {
    return { kind: 'error', message: NETWORK_ERROR_MESSAGE };
  }
}
