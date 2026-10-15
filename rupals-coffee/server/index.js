'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app');
const { openDb } = require('./db');
const { createPayments } = require('./payments');

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'orders.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = openDb(dbPath);
const app = createApp({ db, payments: createPayments(), etaText: process.env.ETA_TEXT || '2 to 4 days' });
const server = app.listen(port, () => console.log(`Rupal's Coffee on http://localhost:${port}`));

function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
