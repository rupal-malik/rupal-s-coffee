'use strict';
const crypto = require('node:crypto');
const { priceOrder } = require('./pricing');

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no look-alike characters
function newOrderId() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return 'RC-' + s;
}

// Creates an order. Retrying with the same idempotency key returns the original order instead of charging twice.
async function createOrder({ input, idemKey }, { db, payments, catalog, now = Date.now }) {
  if (idemKey) {
    const existing = db.findByIdemKey(idemKey);
    if (existing) return { order: existing, replay: true };
  }
  const priced = priceOrder(input.items, catalog);
  const id = newOrderId();
  const provider = payments[input.paymentMethod];
  const payment = await provider.authorize({ amount: priced.total, orderId: id });

  const order = {
    id, idemKey, createdAt: now(), status: 'placed',
    payment: { method: input.paymentMethod, status: payment.status, reference: payment.reference },
    customer: input.customer, items: priced.lines,
    subtotal: priced.subtotal, shipping: priced.shipping, total: priced.total,
  };
  try {
    db.insertOrder(order);
  } catch (err) {
    // A concurrent request with the same idempotency key won the race.
    const winner = idemKey && db.findByIdemKey(idemKey);
    if (winner) return { order: winner, replay: true };
    throw err;
  }
  return { order, replay: false };
}

// Public view: never expose address or phone through the order lookup endpoint.
function publicOrder(o) {
  return { id: o.id, status: o.status, createdAt: o.createdAt, items: o.items, subtotal: o.subtotal, shipping: o.shipping, total: o.total, payment: { method: o.payment.method, status: o.payment.status } };
}

module.exports = { createOrder, publicOrder, newOrderId };
