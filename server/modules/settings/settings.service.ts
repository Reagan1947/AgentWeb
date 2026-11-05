import type { NonoSettings } from '@/shared/types.js';
import { AppError, parseNonoSettingsUpdate, readNonoSettings } from '@/shared/utils.js';

type ApiKeyRow = Record<string, unknown> & { api_key: string };
type NotificationPreferences = Record<string, unknown> & {
  channels?: Record<string, unknown> & { webPush?: boolean };
};

type SettingsDependencies = {
  apiKeys: {
    list(userId: number): ApiKeyRow[];
    create(userId: number, keyName: string): unknown;
    remove(userId: number, keyId: number): boolean;
    toggle(userId: number, keyId: number, isActive: boolean): boolean;
  };
  credentials: {
    list(userId: number, credentialType: string | null): unknown[];
    create(
      userId: number,
      name: string,
      type: string,
      value: string,
      description: string | null,
    ): unknown;
    remove(userId: number, credentialId: number): boolean;
    toggle(userId: number, credentialId: number, isActive: boolean): boolean;
  };
  brokeredCredentials: {
    list(userId: number): Array<{
      id: number;
      name: string;
      note?: string | null;
      upstream: string;
      inject_header: string;
      credential_format: string;
      is_active: number;
      created_at: string;
    }>;
    create(input: {
      userId: number;
      name: string;
      note: string | null;
      upstream: string;
      injectHeader: string;
      credentialFormat: string;
      secret: string;
    }): { id: number; name: string };
    remove(userId: number, credentialId: number): boolean;
    toggle(userId: number, credentialId: number, isActive: boolean): boolean;
  };
  nonoAvailable(): boolean;
  nonoSupported(): boolean;
  nonoSettings: {
    read(userId: number): unknown;
    save(userId: number, settings: NonoSettings): void;
  };
  notifications: {
    getPreferences(userId: number): NotificationPreferences | undefined;
    updatePreferences(userId: number, preferences: NotificationPreferences): unknown;
    createEnabledEvent(): unknown;
    notifyUser(userId: number, event: unknown): void | Promise<void>;
  };
  pushSubscriptions: {
    save(userId: number, endpoint: string, p256dh: string, auth: string): void;
    remove(endpoint: string): void;
  };
  getVapidPublicKey(): string | null;
};

function requiredString(value: unknown, fieldName: string, code: string): string {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue) {
    throw new AppError(`${fieldName} is required`, { code, statusCode: 400 });
  }
  return normalizedValue;
}

const BROKERED_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const BROKERED_HEADER_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const BROKERED_FORMATS = new Set(['Bearer {}', '{}']);

function brokeredEnvNames(name: string): { tokenEnv: string; baseUrlEnv: string } {
  const prefix = name.toUpperCase();
  return { tokenEnv: `${prefix}_TOKEN`, baseUrlEnv: `${prefix}_BASE_URL` };
}

function normalizeUpstream(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('Upstream must be an https URL', {
      code: 'BROKERED_UPSTREAM_INVALID',
      statusCode: 400,
    });
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new AppError('Upstream must be an https URL without credentials or a query', {
      code: 'BROKERED_UPSTREAM_INVALID',
      statusCode: 400,
    });
  }
  const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  return `${url.origin}${pathname}`;
}

function assertFound(found: boolean, resourceName: string, code: string): void {
  if (!found) {
    throw new AppError(`${resourceName} not found`, { code, statusCode: 404 });
  }
}

/** Creates settings workflows with repositories and notification effects injected. */
export function createSettingsService(dependencies: SettingsDependencies) {
  return {
    listApiKeys(userId: number) {
      const apiKeys = dependencies.apiKeys.list(userId).map((key) => ({
        ...key,
        api_key: `${key.api_key.substring(0, 10)}...`,
      }));
      return { apiKeys };
    },
    createApiKey(userId: number, keyNameInput: unknown) {
      const keyName = requiredString(keyNameInput, 'Key name', 'API_KEY_NAME_REQUIRED');
      return { success: true, apiKey: dependencies.apiKeys.create(userId, keyName) };
    },
    deleteApiKey(userId: number, keyId: number) {
      assertFound(dependencies.apiKeys.remove(userId, keyId), 'API key', 'API_KEY_NOT_FOUND');
      return { success: true };
    },
    toggleApiKey(userId: number, keyId: number, isActive: unknown) {
      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean', {
          code: 'INVALID_ACTIVE_STATE',
          statusCode: 400,
        });
      }
      assertFound(
        dependencies.apiKeys.toggle(userId, keyId, isActive),
        'API key',
        'API_KEY_NOT_FOUND',
      );
      return { success: true };
    },
    listCredentials(userId: number, credentialType: string | null) {
      return { credentials: dependencies.credentials.list(userId, credentialType) };
    },
    createCredential(userId: number, input: Record<string, unknown>) {
      const credentialName = requiredString(
        input.credentialName,
        'Credential name',
        'CREDENTIAL_NAME_REQUIRED',
      );
      const credentialType = requiredString(
        input.credentialType,
        'Credential type',
        'CREDENTIAL_TYPE_REQUIRED',
      );
      const credentialValue = requiredString(
        input.credentialValue,
        'Credential value',
        'CREDENTIAL_VALUE_REQUIRED',
      );
      const description = typeof input.description === 'string'
        ? input.description.trim() || null
        : null;
      return {
        success: true,
        credential: dependencies.credentials.create(
          userId,
          credentialName,
          credentialType,
          credentialValue,
          description,
        ),
      };
    },
    deleteCredential(userId: number, credentialId: number) {
      assertFound(
        dependencies.credentials.remove(userId, credentialId),
        'Credential',
        'CREDENTIAL_NOT_FOUND',
      );
      return { success: true };
    },
    listBrokeredCredentials(userId: number) {
      const credentials = dependencies.brokeredCredentials.list(userId).map((row) => {
        const isApi = row.upstream.trim().length > 0;
        const envNames = brokeredEnvNames(row.name);
        return {
          id: row.id,
          name: row.name,
          note: row.note?.trim() || null,
          upstream: row.upstream,
          injectHeader: row.inject_header,
          credentialFormat: row.credential_format,
          isActive: row.is_active === 1,
          createdAt: row.created_at,
          kind: isApi ? 'api' as const : 'secret' as const,
          tokenEnv: isApi ? envNames.tokenEnv : row.name.toUpperCase(),
          baseUrlEnv: isApi ? envNames.baseUrlEnv : '',
        };
      });
      return { credentials, nonoAvailable: dependencies.nonoAvailable() };
    },
    getNonoSettings(userId: number) {
      return {
        ...readNonoSettings(dependencies.nonoSettings.read(userId)),
        available: dependencies.nonoAvailable(),
        supported: dependencies.nonoSupported(),
      };
    },
    updateNonoSettings(userId: number, input: unknown) {
      const settings = parseNonoSettingsUpdate(input);
      dependencies.nonoSettings.save(userId, settings);
      return {
        ...settings,
        available: dependencies.nonoAvailable(),
        supported: dependencies.nonoSupported(),
      };
    },
    createBrokeredCredential(userId: number, input: Record<string, unknown>) {
      const name = requiredString(input.name, 'Name', 'BROKERED_NAME_REQUIRED');
      if (!BROKERED_NAME_PATTERN.test(name)) {
        throw new AppError('Name must be a lowercase identifier using letters, numbers, and underscores', {
          code: 'BROKERED_NAME_INVALID',
          statusCode: 400,
        });
      }
      const note = typeof input.note === 'string' ? input.note.trim() : '';
      if (note.length > 240) {
        throw new AppError('Note is too long', {
          code: 'BROKERED_NOTE_INVALID',
          statusCode: 400,
        });
      }
      const upstreamInput = typeof input.upstream === 'string' ? input.upstream.trim() : '';
      let upstream = '';
      let injectHeader = '';
      let credentialFormat = '';
      if (upstreamInput) {
        upstream = normalizeUpstream(upstreamInput);
        injectHeader = requiredString(input.injectHeader, 'Header', 'BROKERED_HEADER_REQUIRED');
        if (!BROKERED_HEADER_PATTERN.test(injectHeader)) {
          throw new AppError('Header name is invalid', {
            code: 'BROKERED_HEADER_INVALID',
            statusCode: 400,
          });
        }
        credentialFormat = requiredString(
          input.credentialFormat,
          'Credential format',
          'BROKERED_FORMAT_REQUIRED',
        );
        if (!BROKERED_FORMATS.has(credentialFormat)) {
          throw new AppError('Credential format must be "Bearer {}" or "{}"', {
            code: 'BROKERED_FORMAT_INVALID',
            statusCode: 400,
          });
        }
      }
      const secret = requiredString(input.secret, 'Secret', 'BROKERED_SECRET_REQUIRED');
      if (secret.length > 8192) {
        throw new AppError('Secret is too long', {
          code: 'BROKERED_SECRET_INVALID',
          statusCode: 400,
        });
      }
      try {
        const created = dependencies.brokeredCredentials.create({
          userId,
          name,
          note: note || null,
          upstream,
          injectHeader,
          credentialFormat,
          secret,
        });
        return { success: true, credential: { id: created.id, name: created.name } };
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
        if (code.includes('CONSTRAINT')) {
          throw new AppError('A credential with this name already exists', {
            code: 'BROKERED_CREDENTIAL_EXISTS',
            statusCode: 409,
          });
        }
        throw error;
      }
    },
    deleteBrokeredCredential(userId: number, credentialId: number) {
      assertFound(
        dependencies.brokeredCredentials.remove(userId, credentialId),
        'Brokered credential',
        'BROKERED_CREDENTIAL_NOT_FOUND',
      );
      return { success: true };
    },
    toggleBrokeredCredential(userId: number, credentialId: number, isActive: unknown) {
      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean', {
          code: 'INVALID_ACTIVE_STATE',
          statusCode: 400,
        });
      }
      assertFound(
        dependencies.brokeredCredentials.toggle(userId, credentialId, isActive),
        'Brokered credential',
        'BROKERED_CREDENTIAL_NOT_FOUND',
      );
      return { success: true };
    },
    toggleCredential(userId: number, credentialId: number, isActive: unknown) {
      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean', {
          code: 'INVALID_ACTIVE_STATE',
          statusCode: 400,
        });
      }
      assertFound(
        dependencies.credentials.toggle(userId, credentialId, isActive),
        'Credential',
        'CREDENTIAL_NOT_FOUND',
      );
      return { success: true };
    },
    getNotificationPreferences(userId: number) {
      return { success: true, preferences: dependencies.notifications.getPreferences(userId) };
    },
    updateNotificationPreferences(userId: number, preferences: NotificationPreferences) {
      return {
        success: true,
        preferences: dependencies.notifications.updatePreferences(userId, preferences),
      };
    },
    getVapidPublicKey() {
      return { publicKey: dependencies.getVapidPublicKey() };
    },
    subscribeToPush(userId: number, input: Record<string, unknown>) {
      const endpoint = requiredString(input.endpoint, 'Endpoint', 'PUSH_SUBSCRIPTION_REQUIRED');
      const keys = typeof input.keys === 'object' && input.keys !== null
        ? input.keys as Record<string, unknown>
        : {};
      const p256dh = requiredString(keys.p256dh, 'p256dh', 'PUSH_SUBSCRIPTION_REQUIRED');
      const auth = requiredString(keys.auth, 'auth', 'PUSH_SUBSCRIPTION_REQUIRED');
      dependencies.pushSubscriptions.save(userId, endpoint, p256dh, auth);

      const currentPreferences = dependencies.notifications.getPreferences(userId);
      if (!currentPreferences?.channels?.webPush) {
        dependencies.notifications.updatePreferences(userId, {
          ...currentPreferences,
          channels: { ...currentPreferences?.channels, webPush: true },
        });
      }
      const event = dependencies.notifications.createEnabledEvent();
      void dependencies.notifications.notifyUser(userId, event);
      return { success: true };
    },
    unsubscribeFromPush(userId: number, endpointInput: unknown) {
      const endpoint = requiredString(endpointInput, 'Endpoint', 'PUSH_ENDPOINT_REQUIRED');
      dependencies.pushSubscriptions.remove(endpoint);
      const currentPreferences = dependencies.notifications.getPreferences(userId);
      if (currentPreferences?.channels?.webPush) {
        dependencies.notifications.updatePreferences(userId, {
          ...currentPreferences,
          channels: { ...currentPreferences.channels, webPush: false },
        });
      }
      return { success: true };
    },
  };
}
