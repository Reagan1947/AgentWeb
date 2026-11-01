import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_STEEL_BASE_URL,
  launchAgentBrowser,
  normalizeSteelApiKey,
  normalizeSteelBaseUrl,
  probeSteel,
  readSteelBaseUrl,
  releaseSteelSession,
} from '@/modules/browser-use/steel-browser.js';

const viewport = { width: 1440, height: 900 };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('steel address normalization accepts the local default and rejects credentials', () => {
  assert.equal(normalizeSteelBaseUrl(' http://127.0.0.1:3000/ '), 'http://127.0.0.1:3000');
  assert.equal(normalizeSteelBaseUrl(''), '');
  assert.equal(readSteelBaseUrl(undefined, false), DEFAULT_STEEL_BASE_URL);
  assert.equal(readSteelBaseUrl('', true), '');
  assert.equal(normalizeSteelApiKey('  secret  '), 'secret');
  assert.throws(() => normalizeSteelBaseUrl('ftp://steel.local'), /http or https/);
  assert.throws(() => normalizeSteelBaseUrl('http://user:pass@127.0.0.1:3000'), /API key/);
});

test('steel probe distinguishes an unreachable process from a rejected key', async () => {
  const down = await probeSteel('http://127.0.0.1:3000', {
    fetchImpl: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  });
  assert.deepEqual(down, { reachable: false, authenticated: false });

  const rejected = await probeSteel('http://127.0.0.1:3000', {
    apiKey: 'nope',
    fetchImpl: async (_url, init) => {
      assert.equal(new Headers(init?.headers).get('steel-api-key'), 'nope');
      return jsonResponse(401, { message: 'unauthorized' });
    },
  });
  assert.deepEqual(rejected, { reachable: true, authenticated: false });
});

test('launching through Steel stores the live view and connects over CDP', async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    assert.equal(init?.method, 'POST');
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.dimensions, viewport);
    return jsonResponse(200, {
      id: 'steel-1',
      websocketUrl: 'ws://127.0.0.1:3000/devtools/browser/steel-1',
      debugUrl: 'http://127.0.0.1:3000/v1/sessions/debug/steel-1',
    });
  };
  const page = { url: () => 'about:blank' };
  const launched = await launchAgentBrowser({
    playwright: {
      chromium: {
        connectOverCDP: async (websocketUrl: string) => {
          assert.equal(websocketUrl, 'ws://127.0.0.1:3000/devtools/browser/steel-1');
          return {
            contexts: () => [{ pages: () => [page] }],
          };
        },
        launch: async () => {
          throw new Error('local launch should not run');
        },
      },
    },
    steelBaseUrl: 'http://127.0.0.1:3000',
    steelApiKey: '',
    profilePath: null,
    viewport,
    allowLocalFallback: true,
    fetchImpl,
  });

  assert.equal(launched.provider, 'steel');
  assert.equal(launched.steelSessionId, 'steel-1');
  assert.equal(launched.page, page);
  assert.match(launched.debugUrl || '', /interactive=true/);
  assert.match(launched.debugUrl || '', /showControls=true/);
  assert.equal(calls.length, 1);
  assert.equal('websocketUrl' in launched, false);
  assert.equal(launched.steelExclusive, false);
});

test('self-hosted Steel that shares one websocket across sessions is marked exclusive', async () => {
  const launched = await launchAgentBrowser({
    playwright: {
      chromium: {
        connectOverCDP: async () => ({
          contexts: () => [{ pages: () => [{ url: () => 'about:blank' }] }],
        }),
      },
    },
    steelBaseUrl: 'http://127.0.0.1:3000',
    steelApiKey: '',
    profilePath: null,
    viewport,
    allowLocalFallback: true,
    fetchImpl: async () => jsonResponse(200, {
      id: '8604b5d9-43be-4a33-8d23-ab65f25e26e6',
      websocketUrl: 'ws://127.0.0.1:3000/',
      debugUrl: 'http://127.0.0.1:3000/v1/sessions/debug',
    }),
  });

  assert.equal(launched.provider, 'steel');
  assert.equal(launched.steelExclusive, true);
});

test('a failed Steel connection falls back to local Playwright and releases the Steel session', async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    if (init?.method === 'POST' && String(url).endsWith('/v1/sessions')) {
      return jsonResponse(200, {
        id: 'steel-2',
        websocketUrl: 'ws://127.0.0.1:3000/devtools/browser/steel-2',
        debugUrl: 'http://127.0.0.1:3000/v1/sessions/debug/steel-2',
      });
    }
    if (init?.method === 'POST' && String(url).endsWith('/release')) {
      return jsonResponse(404, { message: 'use delete' });
    }
    if (init?.method === 'DELETE') {
      return jsonResponse(200, { ok: true });
    }
    return jsonResponse(500, { message: 'unexpected' });
  };
  let localLaunched = false;
  const launched = await launchAgentBrowser({
    playwright: {
      chromium: {
        connectOverCDP: async () => {
          throw new Error('cdp refused');
        },
        launch: async () => {
          localLaunched = true;
          return {
            newContext: async () => ({
              newPage: async () => ({ url: () => 'about:blank' }),
            }),
          };
        },
      },
    },
    steelBaseUrl: 'http://127.0.0.1:3000',
    steelApiKey: '',
    profilePath: null,
    viewport,
    allowLocalFallback: true,
    fetchImpl,
  });

  assert.equal(localLaunched, true);
  assert.equal(launched.provider, 'playwright');
  assert.equal(launched.debugUrl, null);
  assert.ok(calls.some((call) => call.startsWith('DELETE ')));
});

test('a rejected Steel API key does not open local Chromium', async () => {
  let localLaunched = false;
  await assert.rejects(
    () => launchAgentBrowser({
      playwright: {
        chromium: {
          launch: async () => {
            localLaunched = true;
            return {};
          },
        },
      },
      steelBaseUrl: 'http://127.0.0.1:3000',
      steelApiKey: 'bad',
      profilePath: null,
      viewport,
      allowLocalFallback: true,
      fetchImpl: async () => jsonResponse(401, { message: 'unauthorized' }),
    }),
    /unauthorized/,
  );
  assert.equal(localLaunched, false);
});

test('a named profile stays on the local persistent context', async () => {
  let persistentPath = '';
  const launched = await launchAgentBrowser({
    playwright: {
      chromium: {
        launchPersistentContext: async (profilePath: string) => {
          persistentPath = profilePath;
          return { pages: () => [{ url: () => 'about:blank' }] };
        },
        connectOverCDP: async () => {
          throw new Error('steel should not be used for a local profile');
        },
      },
    },
    steelBaseUrl: 'http://127.0.0.1:3000',
    steelApiKey: '',
    profilePath: '/tmp/cloudcli-profile',
    viewport,
    allowLocalFallback: true,
    fetchImpl: async () => {
      throw new Error('steel should not be called for a local profile');
    },
  });

  assert.equal(persistentPath, '/tmp/cloudcli-profile');
  assert.equal(launched.provider, 'playwright');
  assert.equal(launched.debugUrl, null);
});

test('releasing a current Steel session stops after the release endpoint succeeds', async () => {
  const calls: string[] = [];
  await releaseSteelSession('http://127.0.0.1:3000/', 'steel-3', {
    apiKey: 'key',
    fetchImpl: async (url, init) => {
      calls.push(`${init?.method} ${url}`);
      assert.equal(new Headers(init?.headers).get('steel-api-key'), 'key');
      return jsonResponse(200, { ok: true });
    },
  });
  assert.deepEqual(calls, ['POST http://127.0.0.1:3000/v1/sessions/steel-3/release']);
});
