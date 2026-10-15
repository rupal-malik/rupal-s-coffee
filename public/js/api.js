/* Thin client for the orders API. In the single-file demo build there is no server, so
   window.__RUPAL_DEMO__ is set and orders are created in memory instead (nothing is saved). */
(function () {
  var R = (window.Rupal = window.Rupal || {});
  var DEMO = !!window.__RUPAL_DEMO__;

  function fetchJson(url, init) {
    return fetch(url, init).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok) {
          var err = new Error((body && body.message) || 'Request failed (' + res.status + ')');
          err.status = res.status; err.body = body; throw err;
        }
        return body;
      });
    });
  }

  /* Display-only estimate. The server prices every order again and its numbers win. */
  R.estimate = function (cfg, qtyBySku) {
    var subtotal = 0, count = 0;
    cfg.products.forEach(function (p) { var q = qtyBySku[p.sku] || 0; subtotal += q * p.pricePaise; count += q; });
    var shipping = count === 0 ? 0 : subtotal >= cfg.shipping.freeOverPaise ? 0 : cfg.shipping.flatPaise;
    return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping, count: count };
  };

  R.money = function (paise) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(paise / 100);
  };

  function demoOrder(payload) {
    var cfg = window.__RUPAL_CATALOG__;
    var lines = payload.items.map(function (it) {
      var p = cfg.products.filter(function (x) { return x.sku === it.sku; })[0];
      return { sku: it.sku, name: p.name, size: p.size, qty: it.qty, unitPaise: p.pricePaise, linePaise: p.pricePaise * it.qty };
    });
    var q = {}; payload.items.forEach(function (i) { q[i.sku] = i.qty; });
    var est = R.estimate(cfg, q);
    var chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ', id = 'RC-';
    for (var i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({ order: { id: id, status: 'placed', items: lines, subtotal: est.subtotal, shipping: est.shipping, total: est.total, payment: { method: payload.paymentMethod, status: payload.paymentMethod === 'cod' ? 'pending_cod' : 'paid_test' } }, etaText: cfg.etaText, replay: false });
      }, 500);
    });
  }

  R.api = {
    demo: DEMO,
    products: function () { return DEMO ? Promise.resolve(window.__RUPAL_CATALOG__) : fetchJson('/api/products'); },
    createOrder: function (payload, idemKey) {
      if (DEMO) return demoOrder(payload);
      return fetchJson('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey }, body: JSON.stringify(payload) });
    },
  };
})();
