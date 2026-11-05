import { timingSafeEqual } from 'node:crypto';

import express from 'express';

import type { createMegaControlService } from './mega-control.service.js';

type MegaControlService = ReturnType<typeof createMegaControlService>;

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function tokensMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

/** Routes for signed-in users, behind the server's normal authentication. */
export function createMegaControlUserRouter(service: MegaControlService): express.Router {
  const router = express.Router();

  router.get('/status', async (_request, response, next) => {
    try {
      response.json({ success: true, ...(await service.getStatus()) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/restart', async (_request, response, next) => {
    try {
      const result = await service.restart();
      response.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Routes for the helper script that sandboxed agents run. Caddy forwards public traffic to this
 * port, which never arrives from loopback. Steel's Chrome shares this network namespace and does,
 * so the token is what stops a web page from reaching these routes.
 */
export function createMegaControlAgentRouter(service: MegaControlService, agentToken: string): express.Router {
  const router = express.Router();

  router.use((request, response, next) => {
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1] ?? '';
    if (!LOOPBACK_ADDRESSES.has(request.socket.remoteAddress ?? '') || !tokensMatch(token, agentToken)) {
      response.status(401).json({ success: false, error: 'Invalid MEGA control token.' });
      return;
    }
    next();
  });

  router.post('/ensure', async (_request, response, next) => {
    try {
      const result = await service.ensureRunning();
      response.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/restart', async (_request, response, next) => {
    try {
      const result = await service.restart();
      response.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
