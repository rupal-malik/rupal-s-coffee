'use strict';
const { z } = require('zod');
const { MAX_QTY } = require('./pricing');

const OrderInput = z.object({
  items: z.array(z.object({
    sku: z.string().min(1).max(40),
    qty: z.number().int().min(1).max(MAX_QTY),
  })).min(1).max(10),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,16}$/, 'Enter a valid phone number'),
    address: z.string().trim().min(8).max(300),
  }),
  paymentMethod: z.enum(['cod', 'online_test']),
}).strict();

module.exports = { OrderInput };
