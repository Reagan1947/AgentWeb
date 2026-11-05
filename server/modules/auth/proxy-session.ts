import { createHmac } from 'node:crypto';

// @ts-expect-error -- jsonwebtoken ships no type declarations.
import jwt from 'jsonwebtoken';

import type { Response } from 'express';

const COOKIE_NAME = 'agentweb_proxy_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const JWT_SCOPE = 'reverse-proxy';

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

/**
 * Cookie that lets a reverse proxy check an AgentWeb sign-in before serving a
 * service with no login of its own, such as Steel's live view. Browser sign-in
 * tokens live in localStorage, which a proxy cannot read.
 *
 * It is signed with a key derived from the JWT secret, so it cannot be used as an
 * API token. Without a cookie domain nothing is issued and every check fails.
 * Used by the Auth middleware to issue it and by the Auth routes to check and clear it.
 */
export function createProxySession(input: { jwtSecret: string; cookieDomain: string | undefined }) {
  const signingKey = createHmac('sha256', input.jwtSecret).update('agentweb-proxy-session').digest('hex');
  const domain = input.cookieDomain?.trim();
  const attributes = `Domain=${domain}; Path=/; HttpOnly; Secure; SameSite=Lax`;

  const readClaims = (cookieHeader: string | undefined): { userId: number; exp: number } | null => {
    const token = readCookie(cookieHeader, COOKIE_NAME);
    if (!domain || !token) {
      return null;
    }
    try {
      const claims = jwt.verify(token, signingKey) as { userId?: unknown; scope?: unknown; exp?: unknown };
      return claims.scope === JWT_SCOPE && typeof claims.userId === 'number' && typeof claims.exp === 'number'
        ? { userId: claims.userId, exp: claims.exp }
        : null;
    } catch {
      return null;
    }
  };

  return {
    /** Sets the cookie when it is missing or past half its lifetime. */
    issueIfNeeded(cookieHeader: string | undefined, response: Pick<Response, 'append'>, userId: number): void {
      if (!domain) {
        return;
      }
      const claims = readClaims(cookieHeader);
      if (claims && claims.exp - Date.now() / 1000 > SESSION_TTL_SECONDS / 2) {
        return;
      }
      const token = jwt.sign({ userId, scope: JWT_SCOPE }, signingKey, { expiresIn: SESSION_TTL_SECONDS });
      response.append('Set-Cookie', `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_SECONDS}; ${attributes}`);
    },

    /** The signed-in user id, or null when the cookie is missing, expired, or forged. */
    verifiedUserId(cookieHeader: string | undefined): number | null {
      return readClaims(cookieHeader)?.userId ?? null;
    },

    clear(response: Pick<Response, 'append'>): void {
      if (domain) {
        response.append('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; ${attributes}`);
      }
    },
  };
}
