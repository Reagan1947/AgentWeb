import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error -- jsonwebtoken ships no type declarations.
import jwt from 'jsonwebtoken';

import { createProxySession } from '../proxy-session.js';

function issue(session: ReturnType<typeof createProxySession>, cookie?: string): string[] {
  const headers: string[] = [];
  session.issueIfNeeded(cookie, { append: (_name: string, value: unknown) => headers.push(String(value)) } as never, 7);
  return headers;
}

const cookiePair = (header: string) => header.split(';')[0];

test('proxy session cookie verifies, is scoped to the domain, and is not re-issued while fresh', () => {
  const session = createProxySession({ jwtSecret: 'secret', cookieDomain: 'example.com' });
  const [header] = issue(session);
  assert.match(header, /Domain=example\.com; Path=\/; HttpOnly; Secure; SameSite=Lax/);
  const cookie = `other=1; ${cookiePair(header)}`;
  assert.equal(session.verifiedUserId(cookie), 7);
  assert.deepEqual(issue(session, cookie), []);
});

test('proxy session rejects missing cookies, other secrets, and API tokens', () => {
  const session = createProxySession({ jwtSecret: 'secret', cookieDomain: 'example.com' });
  const other = createProxySession({ jwtSecret: 'different', cookieDomain: 'example.com' });
  assert.equal(session.verifiedUserId(undefined), null);
  assert.equal(session.verifiedUserId(cookiePair(issue(other)[0])), null);
  const apiToken = jwt.sign({ userId: 7 }, 'secret');
  assert.equal(session.verifiedUserId(`agentweb_proxy_session=${apiToken}`), null);
});

test('proxy session cookie cannot be used as an API token', () => {
  const session = createProxySession({ jwtSecret: 'secret', cookieDomain: 'example.com' });
  const token = cookiePair(issue(session)[0]).split('=')[1];
  assert.throws(() => jwt.verify(token, 'secret'));
});

test('proxy session fails closed without a cookie domain', () => {
  const configured = createProxySession({ jwtSecret: 'secret', cookieDomain: 'example.com' });
  const cookie = cookiePair(issue(configured)[0]);
  const session = createProxySession({ jwtSecret: 'secret', cookieDomain: undefined });
  assert.deepEqual(issue(session), []);
  assert.equal(session.verifiedUserId(cookie), null);
});
