import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as SecureStore from 'expo-secure-store';

import { odooJsonRpc } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Push notification registration (client + backend).
 *
 * Fixed 2026-10-02 (tracker #25/#31): the backend now has the route this file was written
 * against — POST /my/push_token/register {token, platform}, and a matching
 * /my/push_token/unregister {token} for logout — added to
 * yallashuq_seller/{controllers,models}/push_token.py in the backend repo (NOT YET
 * committed/pushed/deployed — same local-only state as this session's other backend edits; see
 * backend-fixes-needed.md). The token is now actually sent, not just captured and stored
 * locally. Provider: Expo's own push service (see project-status.md), so this registers for an
 * Expo push token, NOT Firebase/APNs directly.
 *
 * Still open, separately: nothing on the backend actually CALLS Expo's push API yet (no
 * yallashuq.notification trigger sends a push when it fires) — the backend can now store a
 * device's token, but nothing uses it to send anything yet. That's further backend work, not
 * done here, and not an app-side gap.
 * ---------------------------------------------------------------------------------------------
 */

const PUSH_TOKEN_STORAGE_KEY = 'yallashuq_expo_push_token';

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' } // user declined the OS permission prompt
  | { status: 'unsupported' } // simulator/emulator — push tokens aren't issued there
  | { status: 'error'; message: string };

// Android requires a notification channel to be set up before any notification can show with
// the right importance/sound. Harmless to call repeatedly.
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Asks the OS for notification permission (if not already granted or denied) and, if granted,
 * obtains this device's Expo push token. Safe to call multiple times — it won't re-prompt if the
 * person already answered.
 *
 * Call this (a) once at app launch when a session is already signed in, and (b) right after a
 * successful login/signup, so a freshly signed-in customer registers immediately.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  // Physical device only — simulators/emulators don't have a push service to register with.
  if (!Device.isDevice) {
    return { status: 'unsupported' };
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== 'granted') {
      return { status: 'denied' };
    }

    // The EAS project ID is how Expo's push service knows which app this token belongs to.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return {
        status: 'error',
        message: 'No EAS project ID found (Constants.expoConfig.extra.eas.projectId) — check app.json / eas.json.',
      };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
    await sendTokenToBackend(token);

    return { status: 'registered', token };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error registering for push notifications.',
    };
  }
}

/** The token last obtained on this device, if any (read from local storage, not re-requested). */
export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
}

type PushTokenRpcResult = { status: 'success' } | { status: 'error'; message: string };

async function sendTokenToBackend(token: string): Promise<void> {
  try {
    const result = await odooJsonRpc<PushTokenRpcResult>('/my/push_token/register', {
      token,
      platform: Platform.OS,
    });
    if (result.status !== 'success' && __DEV__) {
      console.log('[push] Backend rejected the push token:', result.message);
    }
  } catch (error) {
    // Registration failing is not fatal to login/app launch — the token stays in local storage
    // and the next registerForPushNotificationsAsync() call (next launch/login) retries it.
    if (__DEV__) {
      console.log('[push] Failed to register push token with the backend:', error);
    }
  }
}

/**
 * Tells the backend to stop sending pushes to this device's stored token, then clears it
 * locally. Call this on logout so a signed-out device doesn't keep getting another customer's
 * notifications once someone else signs in on it.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = await getStoredPushToken();
  if (token) {
    try {
      await odooJsonRpc<PushTokenRpcResult>('/my/push_token/unregister', { token });
    } catch (error) {
      if (__DEV__) {
        console.log('[push] Failed to unregister push token with the backend:', error);
      }
    }
  }
  await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
}
