/**
 * HTTP integration tests for POST /api/calculate-rewards.
 * Run: npm run test:api
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../app');

let server;
let baseUrl;

function request(method, path, body) {
  const payload = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, body: json, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const validBase = {
  principal: 1000,
  apy: 5,
  duration: 365,
  durationUnit: 'days',
  compoundingFrequency: 'daily',
};

test('POST valid daily calculation returns 200', async () => {
  const res = await request('POST', '/api/calculate-rewards', validBase);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.projectedBalance > 1000);
  assert.ok(Array.isArray(res.body.data.chartData));
});

test('POST valid for all compounding frequencies', async () => {
  for (const compoundingFrequency of ['daily', 'weekly', 'monthly', 'annually']) {
    const res = await request('POST', '/api/calculate-rewards', {
      ...validBase,
      duration: 1,
      durationUnit: 'years',
      compoundingFrequency,
    });
    assert.equal(res.status, 200, compoundingFrequency);
    assert.equal(res.body.success, true, compoundingFrequency);
  }
});

test('missing fields return 400', async () => {
  for (const key of ['principal', 'apy', 'duration', 'durationUnit', 'compoundingFrequency']) {
    const body = { ...validBase };
    delete body[key];
    const res = await request('POST', '/api/calculate-rewards', body);
    assert.equal(res.status, 400, key);
    assert.equal(res.body.success, false, key);
    assert.ok(typeof res.body.message === 'string', key);
  }
});

test('principal 0 and negative return 400', async () => {
  for (const principal of [0, -10]) {
    const res = await request('POST', '/api/calculate-rewards', {
      ...validBase,
      principal,
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /principal/i);
  }
});

test('negative APY returns 400; zero APY returns 200', async () => {
  const neg = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    apy: -1,
  });
  assert.equal(neg.status, 400);

  const zero = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    apy: 0,
  });
  assert.equal(zero.status, 200);
  assert.equal(zero.body.data.totalRewards, 0);
});

test('null and empty string required fields return 400', async () => {
  const withNull = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    principal: null,
  });
  assert.equal(withNull.status, 400);

  const withEmpty = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    durationUnit: '',
  });
  assert.equal(withEmpty.status, 400);
});

test('numeric strings are coerced and accepted', async () => {
  const res = await request('POST', '/api/calculate-rewards', {
    principal: '1000',
    apy: '5',
    duration: '1',
    durationUnit: 'years',
    compoundingFrequency: 'monthly',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('invalid durationUnit and compoundingFrequency return 400', async () => {
  const unit = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    durationUnit: 'weeks',
  });
  assert.equal(unit.status, 400);

  const freq = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    compoundingFrequency: 'hourly',
  });
  assert.equal(freq.status, 400);
});

test('fractional duration and tokenPrice edge cases', async () => {
  const frac = await request('POST', '/api/calculate-rewards', {
    principal: 1000,
    apy: 8,
    duration: 1.5,
    durationUnit: 'years',
    compoundingFrequency: 'monthly',
  });
  assert.equal(frac.status, 200);

  const zeroPrice = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    tokenPrice: 0,
  });
  assert.equal(zeroPrice.status, 200);
  assert.equal(zeroPrice.body.data.projectedBalanceUsd, 0);

  const negPrice = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    tokenPrice: -1,
  });
  assert.equal(negPrice.status, 400);
});

test('NaN / Infinity style payloads return 400', async () => {
  const nanRes = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    principal: 'NaN',
  });
  assert.equal(nanRes.status, 400);

  const infRes = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    apy: 'Infinity',
  });
  assert.equal(infRes.status, 400);
});

test('extra unexpected properties are ignored on valid requests', async () => {
  const res = await request('POST', '/api/calculate-rewards', {
    ...validBase,
    unexpected: 'hello',
    foo: 123,
  });
  assert.equal(res.status, 200);
});

test('overflow-inducing inputs return 400 not 500', async () => {
  const res = await request('POST', '/api/calculate-rewards', {
    principal: 1e15,
    apy: 1000,
    duration: 100,
    durationUnit: 'years',
    compoundingFrequency: 'daily',
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(!String(res.body.message).includes('stack'));
});

test('invalid JSON body returns 400', async () => {
  const res = await new Promise((resolve, reject) => {
    const url = new URL('/api/calculate-rewards', baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (response) => {
        let raw = '';
        response.on('data', (c) => {
          raw += c;
        });
        response.on('end', () => {
          resolve({ status: response.statusCode, body: raw });
        });
      }
    );
    req.on('error', reject);
    req.write('{not-json');
    req.end();
  });
  assert.equal(res.status, 400);
});

test('CORS preflight responds 204', async () => {
  const res = await new Promise((resolve, reject) => {
    const url = new URL('/api/calculate-rewards', baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'OPTIONS',
      },
      (response) => {
        resolve({
          status: response.statusCode,
          headers: response.headers,
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(res.status, 204);
  assert.ok(res.headers['access-control-allow-origin']);
});

test('unexpected errors return generic 500 and the server keeps serving', async () => {
  const express = require('express');
  const errorHandler = require('../../middleware/errorHandler');
  const faulty = express();
  faulty.get('/boom', () => {
    throw new Error('secret internal detail at /srv/db.js:42');
  });
  faulty.use(errorHandler);

  const faultyServer = http.createServer(faulty);
  await new Promise((resolve) => faultyServer.listen(0, '127.0.0.1', resolve));
  const { port } = faultyServer.address();
  const originalError = console.error;
  console.error = () => {};
  try {
    const get = () =>
      new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${port}/boom`, (res) => {
            let raw = '';
            res.on('data', (c) => {
              raw += c;
            });
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
          })
          .on('error', reject);
      });
    const first = await get();
    assert.equal(first.status, 500);
    assert.deepEqual(first.body, { success: false, message: 'Internal Server Error' });
    assert.ok(!JSON.stringify(first.body).includes('secret'));
    const second = await get();
    assert.equal(second.status, 500);
  } finally {
    console.error = originalError;
    await new Promise((resolve) => faultyServer.close(resolve));
  }
});

test('health check works after error cases (server still up)', async () => {
  const res = await request('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});
