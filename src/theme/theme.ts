/**
 * YallaShuq design tokens — values confirmed from the live site source (see CLAUDE.md,
 * "Design System"). Do not add colors or fonts here that aren't confirmed there.
 */

export const Colors = {
  primaryOrange: '#f28316',
  lightOrange: '#ffb36b',
  /** Brand dark — also the default text color for all body text and headings. */
  dark: '#1b1208',

  // Confirmed from the live login page CSS (yallashuq.com/web/login).
  white: '#ffffff',
  mutedText: '#666666',
  placeholderIcon: '#999999',
  inputBorder: '#e5e5e5',
  inputBackground: '#fafafa',

  // Confirmed from the live customer signup page CSS (yallashuq.com/web/signup).
  phoneGroupBorder: '#e2e8f0',
  phoneCountryBackground: '#f8fafc',
  photoPreviewBackground: '#fff7ed',
  photoPreviewBorder: '#fed7aa',
  iconButtonBorder: '#d1d5db',
  helperText: '#6b7280',
  verifiedText: '#198754',
  /** Selected row in the country code dropdown. */
  activeRowBackground: '#fef2e6',
  /** Body text of the seller signup's Marketplace Commission Policy modal. */
  policyText: '#475569',

  // Confirmed from the live homepage CSS (yallashuq.com/, `.sm-*` classes).
  pageBackground: '#f0f2f5',
  sectionHeading: '#1a1a1a',
  /** Solid stand-in for the Flash Deals heading's text gradient (#c0305a → #e05080). */
  flashHeading: '#c0305a',
  subtleText: '#9a9a9a',
  categoryName: '#333333',
  ratingStar: '#FFD700',
  ratingValue: '#0F172A',
  aiBadgeText: '#fff2e4',
  aiBadgeDot: '#f4c34d',
  paginationText: '#334155',
  /** .sm-chip-mini text. */
  chipText: '#8a5b2c',
  /** .sm-load-more-btn text. */
  loadMoreText: '#a4510a',
  /** Product page "See all" reviews link (live inline style); also My Orders' "RATE NOW" outline. */
  reviewLink: '#4DA7AE',

  // Confirmed from the live /my/orders page (the "Return" button's inline style).
  returnButtonBackground: '#facc15',
  returnButtonBorder: '#eab308',
  returnButtonText: '#1f2937',

  // Confirmed from the live order review popup (#product_review_modal on /my/orders).
  /** Unselected star (selected ones use ratingStar). */
  starEmpty: '#cbd5e1',
  /** "Cancel" text (its border is phoneGroupBorder, #e2e8f0). */
  cancelText: '#64748b',

  // Confirmed from the live order support popup (#mishmesh_order_support_modal on /my/orders).
  /** Order number, "Direct Contact" accent and Submit button (not the brand #f28316). */
  supportOrange: '#f3861c',

  // Confirmed from the live site's stylesheet (web.assets_frontend: --secondary / --success, same
  // on yallashuq.com and staging, checked 2026-09-28): the Bootstrap badge colors of the
  // /my/returns status pills. Badge text is white (#FFF), weight 600.
  /** "bg-secondary" pill: the return's progress, e.g. "Received & Verified". */
  badgeSecondary: '#2D3142',
  /** "bg-success" pill: the seller's decision, e.g. "Seller Accepted". */
  badgeSuccess: '#28a745',

  // PENDING CONFIRMATION: the login page source has no styled error/success message, so these
  // are taken from another component on the live site (the seller status bar's
  // rejected/approved states). Confirm before relying on them.
  errorBackground: '#fee2e2',
  errorBorder: '#fca5a5',
  errorText: '#b91c1c',
  successBackground: '#dcfce7',
  successBorder: '#86efac',
  successText: '#166534',
} as const;

/** CSS: linear-gradient(135deg, #1b1208 0%, #f28316 55%, #ffb36b 100%) */
export const BrandGradient = {
  angle: 135,
  colors: [Colors.dark, Colors.primaryOrange, Colors.lightOrange],
  locations: [0, 0.55, 1],
} as const;

/** Gradients from the live homepage CSS (yallashuq.com/, `.sm-*` classes), in stop order. */
export const HomeGradients = {
  /** .sm-hero: linear-gradient(120deg, #4a1f06 0%, #8a3a0a 28%, #e86d0a 62%, #ff9120 100%) */
  hero: { colors: ['#4a1f06', '#8a3a0a', '#e86d0a', '#ff9120'], locations: [0, 0.28, 0.62, 1] },
  /** .sm-ai-badge (180deg) */
  aiBadge: { colors: ['#6f4128', '#5b341f'], locations: [0, 1] },
  /** .sm-service:nth-child(1..3) (135deg) */
  freeShipping: { colors: ['#1a6fc4', '#2d9cdb', '#56b8f5'], locations: [0, 0.6, 1] },
  warranty: { colors: ['#0f7a55', '#1aac77', '#36d399'], locations: [0, 0.6, 1] },
  giftCards: { colors: ['#6d28d9', '#7c3aed', '#a78bfa'], locations: [0, 0.55, 1] },
  /** .sm-flash-section (135deg) */
  flashDeals: { colors: ['#fff0f5', '#fde8f0', '#fdd6e8'], locations: [0, 0.6, 1] },
  /** .sm-tag (135deg) */
  productTag: { colors: ['#ff8a15', '#f26316'], locations: [0, 1] },
  /** Discounted product tag ("SALE -N%") from the live card script (135deg). */
  saleTag: { colors: ['#d9534f', '#b03030'], locations: [0, 1] },
  /** .sm-add and .sm-pagination .is-active (135deg) */
  orangeButton: { colors: ['#f28316', '#e06a00'], locations: [0, 1] },
} as const;

/**
 * Font family names. These must match the keys registered in `FontSources` (./fonts.ts).
 *
 * Primary = the live site's 'Playfair Display Custom': the standard Playfair Display (v1.203,
 * Google Fonts), which the site serves itself in exactly four weights —
 * /yallashuq_seller/static/src/fonts/PlayfairDisplay-{Regular,Medium,SemiBold,Bold}.ttf (checked
 * 2026-09-28). Each weight is its own family here so every platform uses the real file instead of
 * a faked bold. The site's CSS also asks for weight 800; browsers show that with Bold, so do we.
 *
 * Secondary = 'Archivo' (small/muted text, e.g. review labels). The live site names it but never
 * loads it, so visitors see the system sans-serif there. Earlier (2026-09-28) it was kept
 * unregistered to match that; the client then asked for the real font (same day), so Archivo
 * Regular + Bold (SIL OFL, from Google Fonts; license in assets/fonts/Archivo-OFL.txt) are
 * bundled — Bold for the review popup's feedback label.
 */
export const FontFamily = {
  primary: 'PlayfairDisplay-Regular',
  primaryMedium: 'PlayfairDisplay-Medium',
  primarySemiBold: 'PlayfairDisplay-SemiBold',
  primaryBold: 'PlayfairDisplay-Bold',
  /** Regular italic, from Google Fonts (the live site ships no italic) — empty-field placeholders. */
  primaryItalic: 'PlayfairDisplay-Italic',
  secondary: 'Archivo-Regular',
  secondaryBold: 'Archivo-Bold',
} as const;
