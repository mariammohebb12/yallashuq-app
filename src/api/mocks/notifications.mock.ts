import { mapNotification, type AppNotification } from '../notifications';

/*
 * ⚠️ TEMPORARY MOCK NOTIFICATIONS — NOT REAL, DO NOT SHIP ⚠️
 * Only used where /my/notifications/json is missing (a 404, e.g. staging); delete once it's
 * deployed everywhere. Shaped exactly like the route's rows (src/api/notifications.ts) and run
 * through the same mapper. Titles say they're samples; no real order/return is linked.
 */
export function mockNotifications(): AppNotification[] {
  return [
    {
      id: -1,
      title: 'Sample notification (mock data)',
      body: 'Notifications are not available on this server yet. This is not a real message.',
      type: 'general',
      is_read: false,
      created_at: '2026-10-01T09:00:00',
      res_model: false as const,
      res_id: false as const,
    },
    {
      id: -2,
      title: 'Sample read notification (mock data)',
      body: 'Read notifications look like this.',
      type: 'order',
      is_read: true,
      created_at: '2026-09-30T15:30:00',
      res_model: false as const,
      res_id: false as const,
    },
  ].map(mapNotification);
}
