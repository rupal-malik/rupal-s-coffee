'use strict';
// Payment providers share one tiny interface: authorize({ amount, orderId }) -> { status, reference }.
// Swap MockOnlineProvider for a real gateway (Stripe, Razorpay) without touching the order service.
const crypto = require('node:crypto');

class PaymentError extends Error {
  constructor(message) { super(message); this.name = 'PaymentError'; }
}

class CodProvider {
  async authorize() { return { status: 'pending_cod', reference: null }; }
}

class MockOnlineProvider {
  async authorize({ amount }) {
    if (!Number.isInteger(amount) || amount <= 0) throw new PaymentError('Invalid amount');
    return { status: 'paid_test', reference: 'mock_' + crypto.randomBytes(6).toString('hex') };
  }
}

function createPayments(overrides = {}) {
  return { cod: new CodProvider(), online_test: new MockOnlineProvider(), ...overrides };
}

module.exports = { createPayments, PaymentError, CodProvider, MockOnlineProvider };
