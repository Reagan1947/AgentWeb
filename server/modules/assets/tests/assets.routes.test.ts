import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { assetsRoutes } from '@/modules/assets/index.js';

const CHINESE_FILENAME = '季度汇报.pptx';

function multipartFile(filename: string, content: Buffer, mimeType: string) {
  const boundary = '----CloudCliFilenameTest';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    body: Buffer.concat([head, content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

test('chat file upload keeps a UTF-8 filename for chat history', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'cloudcli-assets-'));
  const previousHome = process.env.HOME;
  process.env.HOME = home;

  const app = express();
  app.use('/api/assets', assetsRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address() as AddressInfo;
    const payload = multipartFile(
      CHINESE_FILENAME,
      Buffer.from('ppt'),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    const response = await fetch(`http://127.0.0.1:${address.port}/api/assets/files`, {
      method: 'POST',
      headers: { 'Content-Type': payload.contentType },
      body: payload.body,
    });

    assert.equal(response.status, 200);
    const body = await response.json() as { attachments: Array<{ name: string }> };
    assert.equal(body.attachments[0]?.name, CHINESE_FILENAME);
    assert.notEqual(
      body.attachments[0]?.name,
      Buffer.from(CHINESE_FILENAME, 'utf8').toString('latin1'),
    );
  } finally {
    process.env.HOME = previousHome;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(home, { recursive: true, force: true });
  }
});
