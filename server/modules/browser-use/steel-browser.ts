/**
 * Talks to a Steel browser API and opens the Playwright connection behind an
 * agent session. The browser-use service uses these helpers so agent tools keep
 * their current names while the Browser tab can embed Steel's live view.
 */

const STEEL_PROBE_TIMEOUT_MS = 800;
const STEEL_REQUEST_TIMEOUT_MS = 15_000;

/** Address tried when Browser settings have never stored a Steel URL. */
export const DEFAULT_STEEL_BASE_URL = 'http://127.0.0.1:3000';

type SteelProbe = {
  reachable: boolean;
  authenticated: boolean;
};

type SteelSession = {
  id: string;
  websocketUrl: string;
  debugUrl: string;
};

type FetchLike = typeof fetch;

export type LaunchedBrowser = {
  provider: 'steel' | 'playwright';
  browser?: any;
  context?: any;
  page: any;
  debugUrl: string | null;
  steelSessionId: string | null;
  steelBaseUrl: string | null;
  /**
   * True when the Steel server drives one shared Chrome (self-hosted Steel).
   * Creating another session there replaces the running one, so the
   * browser-use service must not open a second concurrent session on it.
   */
  steelExclusive: boolean;
};

type LaunchAgentBrowserInput = {
  playwright: any;
  steelBaseUrl: string;
  steelApiKey: string;
  profilePath: string | null;
  viewport: { width: number; height: number };
  allowLocalFallback: boolean;
  fetchImpl?: FetchLike;
};

class SteelRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SteelRequestError';
    this.status = status;
  }
}

function isSteelAuthError(error: unknown): boolean {
  return error instanceof SteelRequestError && (error.status === 401 || error.status === 403);
}

function steelEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function steelHeaders(apiKey: string, json = false): Record<string, string> {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(apiKey ? { 'steel-api-key': apiKey } : {}),
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 300);
  return trimmed || `Steel request failed (${response.status}).`;
}

/**
 * Used by the browser-use service when saving the Steel address. Empty means
 * local Playwright only. A stored value must be an http(s) URL without embedded credentials.
 */
export function normalizeSteelBaseUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Steel address must be an http or https URL.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Steel address must be an http or https URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Steel address must be an http or https URL.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Put the Steel API key in its own field, not in the address.');
  }

  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

/**
 * Used by the browser-use service while reading saved settings. A missing value
 * keeps the default local Steel address; an invalid stored value falls back to
 * that default instead of breaking status and session reads.
 */
export function readSteelBaseUrl(value: unknown, present: boolean): string {
  if (!present) {
    return DEFAULT_STEEL_BASE_URL;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }

  try {
    return normalizeSteelBaseUrl(value);
  } catch {
    return DEFAULT_STEEL_BASE_URL;
  }
}

/** Used by the browser-use service when saving the optional Steel API key. */
export function normalizeSteelApiKey(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Steel API key must be text.');
  }

  const trimmed = value.trim();
  if (trimmed.length > 512) {
    throw new Error('Steel API key is too long.');
  }

  return trimmed;
}

/** Used by the browser-use service while reading a previously stored Steel API key. */
export function readSteelApiKey(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 512);
}

/**
 * Used by the browser-use service to decide whether the next agent session can
 * open Steel. Network failures and non-auth HTTP errors count as unreachable so
 * session creation can fall back to local Playwright without waiting on create.
 */
export async function probeSteel(
  baseUrl: string,
  options: { apiKey?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<SteelProbe> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(steelEndpoint(baseUrl, '/v1/sessions'), {
      method: 'GET',
      headers: steelHeaders(options.apiKey || ''),
      signal: AbortSignal.timeout(options.timeoutMs ?? STEEL_PROBE_TIMEOUT_MS),
    });

    if (response.status === 401 || response.status === 403) {
      return { reachable: true, authenticated: false };
    }

    if (response.ok) {
      return { reachable: true, authenticated: true };
    }

    return { reachable: false, authenticated: false };
  } catch {
    return { reachable: false, authenticated: false };
  }
}

function readSessionPayload(value: unknown): SteelSession {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nested = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : null;
  const source = nested && typeof nested.id === 'string' ? nested : record;
  const id = typeof source.id === 'string' ? source.id : '';
  const websocketUrl = typeof source.websocketUrl === 'string' ? source.websocketUrl : '';
  const debugUrl = typeof source.debugUrl === 'string' && source.debugUrl
    ? source.debugUrl
    : typeof source.sessionViewerUrl === 'string'
      ? source.sessionViewerUrl
      : '';

  if (!id || !websocketUrl || !debugUrl) {
    throw new Error('Steel did not return a session id, websocket URL, and live view URL.');
  }

  return { id, websocketUrl, debugUrl };
}

/**
 * Adds the Browser tab's interactive controls to a Steel live view URL.
 * launchAgentBrowser stores the result; a non-http URL is rejected first.
 */
function withLiveViewParams(debugUrl: string): string {
  const url = new URL(debugUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Steel returned a live view URL that is not http or https.');
  }

  if (!url.searchParams.has('interactive')) {
    url.searchParams.set('interactive', 'true');
  }

  if (!url.searchParams.has('showControls')) {
    url.searchParams.set('showControls', 'true');
  }

  return url.toString();
}

async function createSteelSession(
  baseUrl: string,
  options: {
    apiKey: string;
    viewport: { width: number; height: number };
    fetchImpl: FetchLike;
  },
): Promise<SteelSession> {
  const response = await options.fetchImpl(steelEndpoint(baseUrl, '/v1/sessions'), {
    method: 'POST',
    headers: steelHeaders(options.apiKey, true),
    body: JSON.stringify({
      dimensions: {
        width: options.viewport.width,
        height: options.viewport.height,
      },
    }),
    signal: AbortSignal.timeout(STEEL_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new SteelRequestError(response.status, await readErrorMessage(response));
  }

  return readSessionPayload(await response.json());
}

/**
 * Used by the browser-use service when a session stops, and by session launch
 * when connecting Playwright to a new Steel session fails. Current Steel releases
 * with POST; older self-hosted builds only accept DELETE.
 */
export async function releaseSteelSession(
  baseUrl: string,
  sessionId: string,
  options: { apiKey?: string; fetchImpl?: FetchLike } = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = steelHeaders(options.apiKey || '');
  const releaseResponse = await fetchImpl(
    steelEndpoint(baseUrl, `/v1/sessions/${encodeURIComponent(sessionId)}/release`),
    {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(STEEL_REQUEST_TIMEOUT_MS),
    },
  );

  if (releaseResponse.ok) {
    return;
  }

  if (releaseResponse.status !== 404 && releaseResponse.status !== 405) {
    throw new SteelRequestError(releaseResponse.status, await readErrorMessage(releaseResponse));
  }

  const deleteResponse = await fetchImpl(
    steelEndpoint(baseUrl, `/v1/sessions/${encodeURIComponent(sessionId)}`),
    {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(STEEL_REQUEST_TIMEOUT_MS),
    },
  );

  if (deleteResponse.ok || deleteResponse.status === 404) {
    return;
  }

  throw new SteelRequestError(deleteResponse.status, await readErrorMessage(deleteResponse));
}

async function launchLocalBrowser(
  playwright: any,
  profilePath: string | null,
  viewport: { width: number; height: number },
): Promise<LaunchedBrowser> {
  const launchOptions = {
    headless: true,
    args: ['--disable-dev-shm-usage'],
  };
  const contextOptions = {
    viewport,
    serviceWorkers: 'block',
  };

  if (profilePath) {
    const context = await playwright.chromium.launchPersistentContext(profilePath, {
      ...launchOptions,
      ...contextOptions,
    });
    const page = context.pages()[0] || await context.newPage();
    return {
      provider: 'playwright',
      context,
      page,
      debugUrl: null,
      steelSessionId: null,
      steelBaseUrl: null,
      steelExclusive: false,
    };
  }

  const browser = await playwright.chromium.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  return {
    provider: 'playwright',
    browser,
    context,
    page,
    debugUrl: null,
    steelSessionId: null,
    steelBaseUrl: null,
    steelExclusive: false,
  };
}

/**
 * Used by the browser-use service to open the browser for one agent session.
 * A named local profile stays on Playwright. Otherwise Steel is used when a
 * base URL is provided, and local Chromium is the fallback when Steel cannot
 * be reached and that fallback is allowed.
 */
export async function launchAgentBrowser(input: LaunchAgentBrowserInput): Promise<LaunchedBrowser> {
  if (!input.playwright?.chromium) {
    throw new Error('Playwright is not installed.');
  }

  if (input.profilePath) {
    return launchLocalBrowser(input.playwright, input.profilePath, input.viewport);
  }

  if (input.steelBaseUrl) {
    const fetchImpl = input.fetchImpl ?? fetch;
    let createdId: string | null = null;
    try {
      const steel = await createSteelSession(input.steelBaseUrl, {
        apiKey: input.steelApiKey,
        viewport: input.viewport,
        fetchImpl,
      });
      createdId = steel.id;
      const debugUrl = withLiveViewParams(steel.debugUrl);
      const browser = await input.playwright.chromium.connectOverCDP(steel.websocketUrl);
      const context = browser.contexts?.()[0];
      if (!context) {
        throw new Error('Steel session did not expose a browser context.');
      }

      const page = context.pages()[0] || await context.newPage();
      return {
        provider: 'steel',
        browser,
        context,
        page,
        debugUrl,
        steelSessionId: steel.id,
        steelBaseUrl: input.steelBaseUrl,
        // Steel Cloud puts the session id in the connect URL; self-hosted Steel
        // returns the same bare websocket for every session.
        steelExclusive: !steel.websocketUrl.includes(steel.id),
      };
    } catch (error) {
      if (createdId) {
        await releaseSteelSession(input.steelBaseUrl, createdId, {
          apiKey: input.steelApiKey,
          fetchImpl,
        }).catch(() => undefined);
      }

      if (!input.allowLocalFallback || isSteelAuthError(error)) {
        throw error;
      }

      console.warn(
        '[Browser] Steel session failed, using local Playwright:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!input.allowLocalFallback) {
    throw new Error('Steel is not available, and local Chromium is not installed.');
  }

  return launchLocalBrowser(input.playwright, null, input.viewport);
}
