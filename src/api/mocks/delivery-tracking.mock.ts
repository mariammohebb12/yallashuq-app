import type { OrderTracking } from '../delivery-tracking';

/*
 * ⚠️ TEMPORARY MOCK TRACKING — NOT REAL, DO NOT SHIP ⚠️
 * Only used as a labelled fallback while /api/delivery/track isn't the new version on the server
 * (staging still runs the old fake stub, checked 2026-09-30) — see src/api/delivery-tracking.ts.
 * Delete once the real route is verified end-to-end everywhere.
 *
 * Every value is made up, including the status codes. Two legs, to show a multi-leg
 * (e.g. cross-border) shipment.
 */
export function mockTracking(): OrderTracking {
  return {
    status: { code: 'sample_in_transit', label: 'Sample in transit' },
    notYetShipped: false,
    trackingNumber: 'SAMPLE-TRACKING-0001',
    provider: 'Sample Carrier',
    lastUpdatedFormatted: '09/29/2026 14:30',
    legs: [
      {
        id: -1,
        name: 'Sample leg 1 (mock data)',
        status: { code: 'sample_completed', label: 'Sample completed' },
        trackingNumber: 'SAMPLE-LEG-0001',
        provider: 'Sample Carrier',
        lastUpdatedFormatted: '09/28/2026 09:00',
        completedAtFormatted: '09/28/2026 09:00',
      },
      {
        id: -2,
        name: 'Sample leg 2 (mock data)',
        status: { code: 'sample_in_transit', label: 'Sample in transit' },
        trackingNumber: null,
        provider: null,
        lastUpdatedFormatted: '09/29/2026 14:30',
        completedAtFormatted: null,
      },
    ],
  };
}
