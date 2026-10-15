'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');
const { openDb } = require('../server/db');
const { createPayments, PaymentError } = require('../server/payments');
const { priceOrder } = require('../server/pricing');
const catalog = require('../server/catalog.json');

const customer = { name: 'Asha Rao', phone: '+91 98765 43210', address: '12 Lake Road, Pune 411001' };
const goodOrder = (over = {}) => ({ items: [{ sku: 'RC-SIG-250', qty: 2 }], customer, paymentMethod: 'cod', ...over });

async function boot(opts = {}) {
  const db = openDb(':memory:');
  const app = createApp({ db, payments: createPayments(opts.payments), ordersPerMinute: opts.ordersPerMinute ?? 1000 });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, init = {}) => {
    const res = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) }, body: init.body && JSON.stringify(init.body) });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  return { db, call, base, close: () => new Promise((r) => server.close(() => { db.close(); r(); })) };
}

test('pricing: totals come from the catalog and shipping is free over the threshold', () => {
  const small = priceOrder([{ sku: 'RC-SIG-250', qty: 1 }], catalog);
  assert.equal(small.subtotal, 49900); assert.equal(small.shipping, 4900); assert.equal(small.total, 54800);
  const justUnder = priceOrder([{ sku: 'RC-SIG-250', qty: 2 }], catalog);
  assert.equal(justUnder.subtotal, 99800); assert.equal(justUnder.shipping, 4900);
  const big = priceOrder([{ sku: 'RC-SIG-250', qty: 3 }], catalog);
  assert.equal(big.shipping, 0); assert.equal(big.total, 149700);
  const merged = priceOrder([{ sku: 'RC-FIL-100', qty: 1 }, { sku: 'RC-FIL-100', qty: 2 }], catalog);
  assert.equal(merged.lines.length, 1); assert.equal(merged.lines[0].qty, 3);
});

test('GET /api/products returns the catalog in paise', async () => {
  const t = await boot();
  const r = await t.call('/api/products');
  assert.equal(r.status, 200); assert.equal(r.body.currency, 'INR'); assert.equal(r.body.products.length, 3);
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  await t.close();
});

test('POST /api/orders prices on the server and ignores client prices', async () => {
  const t = await boot();
  const r = await t.call('/api/orders', { method: 'POST', body: goodOrder({ items: [{ sku: 'RC-SIG-250', qty: 1 }] }) });
  assert.equal(r.status, 201);
  assert.match(r.body.order.id, /^RC-[A-Z0-9]{8}$/);
  assert.equal(r.body.order.total, 54800);
  assert.equal(r.body.order.payment.status, 'pending_cod');
  const bad = await t.call('/api/orders', { method: 'POST', body: { ...goodOrder(), price: 1, total: 1 } });
  assert.equal(bad.status, 422, 'unknown fields are rejected');
  await t.close();
});

test('POST /api/orders validates input', async () => {
  const t = await boot();
  const post = (body) => t.call('/api/orders', { method: 'POST', body });
  assert.equal((await post(goodOrder({ items: [] }))).status, 422);
  assert.equal((await post(goodOrder({ items: [{ sku: 'RC-SIG-250', qty: 0 }] }))).status, 422);
  assert.equal((await post(goodOrder({ items: [{ sku: 'RC-SIG-250', qty: 21 }] }))).status, 422);
  assert.equal((await post(goodOrder({ customer: { ...customer, phone: 'abc' } }))).status, 422);
  assert.equal((await post(goodOrder({ paymentMethod: 'bitcoin' }))).status, 422);
  const unknown = await post(goodOrder({ items: [{ sku: 'NOPE', qty: 1 }] }));
  assert.equal(unknown.status, 422); assert.equal(unknown.body.error, 'unknown_product');
  await t.close();
});

test('idempotency key: a retry returns the same order and creates one row', async () => {
  const t = await boot();
  const opts = { method: 'POST', body: goodOrder(), headers: { 'Idempotency-Key': 'abc-123' } };
  const a = await t.call('/api/orders', opts);
  const b = await t.call('/api/orders', opts);
  assert.equal(a.status, 201); assert.equal(b.status, 200);
  assert.equal(a.body.order.id, b.body.order.id); assert.equal(b.body.replay, true);
  assert.equal(t.db.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
  await t.close();
});

test('order lookup hides address and phone', async () => {
  const t = await boot();
  const { body } = await t.call('/api/orders', { method: 'POST', body: goodOrder({ paymentMethod: 'online_test' }) });
  const got = await t.call('/api/orders/' + body.order.id.toLowerCase());
  assert.equal(got.status, 200); assert.equal(got.body.order.payment.status, 'paid_test');
  assert.equal(JSON.stringify(got.body).includes('Lake Road'), false);
  assert.equal(JSON.stringify(got.body).includes('98765'), false);
  assert.equal((await t.call('/api/orders/RC-NOTREAL1')).status, 404);
  await t.close();
});

test('a failed payment returns 402 and stores no order', async () => {
  const failing = { online_test: { authorize: async () => { throw new PaymentError('Card declined'); } } };
  const t = await boot({ payments: failing });
  const r = await t.call('/api/orders', { method: 'POST', body: goodOrder({ paymentMethod: 'online_test' }) });
  assert.equal(r.status, 402); assert.equal(r.body.error, 'payment_failed');
  assert.equal(t.db.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  await t.close();
});

test('order endpoint is rate limited', async () => {
  const t = await boot({ ordersPerMinute: 2 });
  const post = () => t.call('/api/orders', { method: 'POST', body: goodOrder() });
  assert.equal((await post()).status, 201); assert.equal((await post()).status, 201);
  assert.equal((await post()).status, 429);
  await t.close();
});

test('malformed JSON gets a 400, unknown API paths a 404', async () => {
  const t = await boot();
  assert.equal((await t.call('/api/health')).status, 200);
  assert.equal((await t.call('/api/nope')).status, 404);
  const raw = await fetch(t.base + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
  assert.equal(raw.status, 400);
  await t.close();
});
