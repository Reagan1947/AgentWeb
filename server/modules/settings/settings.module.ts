import {
  apiKeysDb,
  brokeredCredentialsDb,
  credentialsDb,
  notificationPreferencesDb,
  pushSubscriptionsDb,
  userPreferencesDb,
} from '@/modules/database/index.js';
import { findExecutableOnPath, NONO_SETTINGS_PREFERENCE_KEY } from '@/shared/utils.js';
import {
  createNotificationEvent,
  getPublicKey,
  notifyUserIfEnabled,
} from '@/modules/notifications/index.js';

import { createSettingsRouter } from './settings.routes.js';
import { createSettingsService } from './settings.service.js';

const settingsService = createSettingsService({
  apiKeys: {
    list: (userId) => apiKeysDb.getApiKeys(userId),
    create: (userId, keyName) => apiKeysDb.createApiKey(userId, keyName),
    remove: (userId, keyId) => apiKeysDb.deleteApiKey(userId, keyId),
    toggle: (userId, keyId, isActive) => apiKeysDb.toggleApiKey(userId, keyId, isActive),
  },
  credentials: {
    list: (userId, type) => credentialsDb.getCredentials(userId, type),
    create: (userId, name, type, value, description) =>
      credentialsDb.createCredential(userId, name, type, value, description),
    remove: (userId, credentialId) => credentialsDb.deleteCredential(userId, credentialId),
    toggle: (userId, credentialId, isActive) =>
      credentialsDb.toggleCredential(userId, credentialId, isActive),
  },
  brokeredCredentials: {
    list: (userId) => brokeredCredentialsDb.listPublic(userId),
    create: (input) => brokeredCredentialsDb.create(input),
    remove: (userId, credentialId) => brokeredCredentialsDb.delete(userId, credentialId),
    toggle: (userId, credentialId, isActive) =>
      brokeredCredentialsDb.toggle(userId, credentialId, isActive),
  },
  nonoAvailable: () => findExecutableOnPath('nono') !== null,
  nonoSupported: () => process.platform !== 'win32',
  nonoSettings: {
    read: (userId) => userPreferencesDb.getPreferences(userId)[NONO_SETTINGS_PREFERENCE_KEY],
    save: (userId, settings) => userPreferencesDb.savePreferences(userId, {
      [NONO_SETTINGS_PREFERENCE_KEY]: settings,
    }),
  },
  notifications: {
    getPreferences: (userId) => notificationPreferencesDb.getPreferences(userId),
    updatePreferences: (userId, preferences) =>
      notificationPreferencesDb.updatePreferences(userId, preferences),
    createEnabledEvent: () => createNotificationEvent({
      provider: 'system', kind: 'info', code: 'push.enabled',
      meta: { message: 'Push notifications are now enabled!' }, severity: 'info',
    }),
    notifyUser: (userId, event) => notifyUserIfEnabled({ userId, event }),
  },
  pushSubscriptions: {
    save: (userId, endpoint, p256dh, auth) =>
      pushSubscriptionsDb.saveSubscription(userId, endpoint, p256dh, auth),
    remove: (endpoint) => pushSubscriptionsDb.removeSubscription(endpoint),
  },
  getVapidPublicKey: getPublicKey,
});

/** Settings router assembled for the authenticated server mount. */
export const settingsRoutes = createSettingsRouter(settingsService);
