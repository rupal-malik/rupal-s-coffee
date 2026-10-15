/* Shop dialog: pick products, enter delivery details, place the order, hand over to the delivery scene. */
(function () {
  var R = window.Rupal;
  var dlg = document.getElementById('shopDialog');
  if (!dlg || !dlg.showModal) return;

  var form = document.getElementById('checkoutForm');
  var list = document.getElementById('productList');
  var summary = document.getElementById('summary');
  var errBox = document.getElementById('formError');
  var placeBtn = document.getElementById('placeBtn');
  var cfg = null, qty = {}, idemKey = null, loading = null;

  function uid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(16).slice(2); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function renderProducts() {
    list.querySelectorAll('.prow').forEach(function (n) { n.remove(); });
    cfg.products.forEach(function (p) {
      var row = el('div', 'prow');
      var info = el('div', 'pinfo');
      var name = el('strong', null, p.name); name.appendChild(el('span', 'psize', ' ' + p.size));
      info.appendChild(name); info.appendChild(el('span', 'pblurb', p.blurb));
      var price = el('span', 'pprice', R.money(p.pricePaise));
      var step = el('div', 'step');
      var minus = el('button', 'stepbtn', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'Fewer ' + p.name + ' ' + p.size);
      var out = el('output', 'stepval', String(qty[p.sku] || 0)); out.setAttribute('aria-live', 'polite');
      var plus = el('button', 'stepbtn', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'More ' + p.name + ' ' + p.size);
      function set(n) { qty[p.sku] = Math.max(0, Math.min(20, n)); out.textContent = String(qty[p.sku]); renderSummary(); }
      minus.addEventListener('click', function () { set((qty[p.sku] || 0) - 1); });
      plus.addEventListener('click', function () { set((qty[p.sku] || 0) + 1); });
      step.appendChild(minus); step.appendChild(out); step.appendChild(plus);
      row.appendChild(info); row.appendChild(price); row.appendChild(step);
      list.appendChild(row);
    });
  }

  function renderSummary() {
    var e = R.estimate(cfg, qty);
    summary.textContent = '';
    function line(label, value, cls) { var r = el('div', 'srow' + (cls ? ' ' + cls : '')); r.appendChild(el('span', null, label)); r.appendChild(el('span', null, value)); summary.appendChild(r); }
    line('Subtotal', R.money(e.subtotal));
    line('Delivery', e.count === 0 ? '-' : e.shipping === 0 ? 'Free' : R.money(e.shipping));
    line('Total', R.money(e.total), 'stotal');
    if (e.count > 0 && e.shipping > 0) summary.appendChild(el('p', 'shint', 'Add ' + R.money(cfg.shipping.freeOverPaise - e.subtotal) + ' more for free delivery.'));
    placeBtn.disabled = e.count === 0;
    placeBtn.textContent = e.count === 0 ? 'Pick something first' : 'Place order · ' + R.money(e.total);
  }

  function showError(msg) { errBox.textContent = msg || ''; }

  function load() {
    if (cfg) return Promise.resolve();
    if (!loading) loading = R.api.products().then(function (c) {
      cfg = c; qty = {}; qty[c.products[0].sku] = 1; renderProducts(); renderSummary();
    }).catch(function () { loading = null; throw new Error('load'); });
    return loading;
  }

  function open() {
    showError('');
    document.getElementById('demoNote').hidden = !R.api.demo;
    if (!dlg.open) dlg.showModal();
    load().catch(function () { showError('The shop could not load. Check your connection and try again.'); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-open-shop]');
    if (t) { e.preventDefault(); open(); }
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    if (!cfg || !form.reportValidity()) return;
    var items = Object.keys(qty).filter(function (k) { return qty[k] > 0; }).map(function (k) { return { sku: k, qty: qty[k] }; });
    if (!items.length) return;
    var fd = new FormData(form);
    var payload = {
      items: items,
      customer: { name: String(fd.get('name')).trim(), phone: String(fd.get('phone')).trim(), address: String(fd.get('address')).trim() },
      paymentMethod: String(fd.get('payment')),
    };
    idemKey = idemKey || uid();
    placeBtn.disabled = true; placeBtn.textContent = 'Placing order…';
    R.api.createOrder(payload, idemKey).then(function (res) {
      idemKey = null;
      dlg.close();
      R.delivery.play({ order: res.order, etaText: res.etaText, name: payload.customer.name });
      qty = {}; qty[cfg.products[0].sku] = 1; renderProducts(); renderSummary();
    }).catch(function (err) {
      var body = err.body, msg = err.message;
      if (body && body.issues && body.issues.length) msg = body.issues[0].path.replace(/^customer\./, '') + ': ' + body.issues[0].message;
      if (err.status === undefined) msg = 'Could not reach the shop. Your order was not placed.';
      showError(msg); renderSummary();
    });
  });
})();
