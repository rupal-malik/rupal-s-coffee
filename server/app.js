'use strict';
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const { ZodError } = require('zod');

const catalogDefault = require('./catalog.json');
const { OrderInput } = require('./validate');
const { UnknownSkuError, FREE_SHIPPING_OVER, SHIPPING } = require('./pricing');
const { createOrder, publicOrder } = require('./orders');
const { PaymentError } = require('./payments');

function createApp({ db, payments, catalog = catalogDefault, publicDir = path.join(__dirname, '..', 'public'), ordersPerMinute = 30, etaText = '2 to 4 days' }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // inline style="" attributes on SVG
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  }));
  app.use(compression());
  app.use(express.json({ limit: '10kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.get('/products', (_req, res) => res.json({
    currency: 'INR', shipping: { flatPaise: SHIPPING, freeOverPaise: FREE_SHIPPING_OVER }, etaText, products: catalog,
  }));

  const limiter = rateLimit({ windowMs: 60_000, limit: ordersPerMinute, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many orders. Try again in a minute.' } });
  api.post('/orders', limiter, async (req, res) => {
    const input = OrderInput.parse(req.body);
    const idemKey = req.get('Idempotency-Key')?.slice(0, 80) || undefined;
    const { order, replay } = await createOrder({ input, idemKey }, { db, payments, catalog });
    res.status(replay ? 200 : 201).json({ order: publicOrder(order), etaText, replay });
  });
  api.get('/orders/:id', (req, res) => {
    const order = db.findById(String(req.params.id).toUpperCase());
    if (!order) return res.status(404).json({ error: 'not_found', message: 'No order with that number.' });
    res.json({ order: publicOrder(order) });
  });
  api.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use('/api', api);

  const longCache = { maxAge: '365d', immutable: true };
  app.use('/fonts', express.static(path.join(publicDir, 'fonts'), longCache));
  app.use('/vendor', express.static(path.join(publicDir, 'vendor'), longCache));
  app.use(express.static(publicDir, { maxAge: '1h' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(422).json({ error: 'validation', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    if (err instanceof UnknownSkuError) return res.status(422).json({ error: 'unknown_product', message: err.message });
    if (err instanceof PaymentError) return res.status(402).json({ error: 'payment_failed', message: err.message });
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'bad_request', message: 'Invalid request body.' });
    console.error(err);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong on our side.' });
  });
  return app;
}

module.exports = { createApp };
