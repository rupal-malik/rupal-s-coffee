'use strict';
const { DatabaseSync } = require('node:sqlite'); // built into Node >= 22.5 (experimental)

function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      idem_key TEXT UNIQUE,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      payment_ref TEXT,
      customer_json TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      shipping INTEGER NOT NULL,
      total INTEGER NOT NULL
    );
  `);
  const insert = db.prepare(`INSERT INTO orders
    (id, idem_key, created_at, status, payment_method, payment_status, payment_ref, customer_json, items_json, subtotal, shipping, total)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const byId = db.prepare('SELECT * FROM orders WHERE id = ?');
  const byKey = db.prepare('SELECT * FROM orders WHERE idem_key = ?');

  const hydrate = (r) => r && ({
    id: r.id, createdAt: r.created_at, status: r.status,
    payment: { method: r.payment_method, status: r.payment_status, reference: r.payment_ref },
    customer: JSON.parse(r.customer_json), items: JSON.parse(r.items_json),
    subtotal: r.subtotal, shipping: r.shipping, total: r.total,
  });

  return {
    raw: db,
    insertOrder(o) {
      insert.run(o.id, o.idemKey ?? null, o.createdAt, o.status, o.payment.method, o.payment.status, o.payment.reference ?? null,
        JSON.stringify(o.customer), JSON.stringify(o.items), o.subtotal, o.shipping, o.total);
    },
    findById: (id) => hydrate(byId.get(id)),
    findByIdemKey: (key) => hydrate(byKey.get(key)),
    close: () => db.close(),
  };
}

module.exports = { openDb };
