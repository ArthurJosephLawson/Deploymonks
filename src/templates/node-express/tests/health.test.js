import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import app from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('{{PROJECT_NAME}}', () => {
  it('serves the root metadata route', async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.project, '{{PROJECT_NAME}}');
  });

  it('answers the health check', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptimeSeconds, 'number');
  });

  it('exposes runtime info', async () => {
    const response = await fetch(`${baseUrl}/api/info`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.author, '{{AUTHOR_NAME}}');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, 'Not Found');
  });
});
