/* Delivery scene: after an order is placed, a scooter rider brings the bag across the village and hands it over.
   One GSAP timeline drives everything; on-screen state is derived from the timeline time, so seeking is safe. */
(function () {
  var R = window.Rupal;
  var root = document.getElementById('delivery');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var TOTAL = 9.0, STEPS = [0, 1.0, 1.8, 7.4], LABELS = ['Order confirmed', 'Rider picked up your bag', 'On the way', 'Delivered'];
  var DIST = { far: 260, mid: 640, near: 990 }, HOUSE_START = 1500;

  /* ---- scenery, generated once with a seeded random so every run looks the same ---- */
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function add(parent, tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; }
  var INK = '#2b1810';

  function buildScenery() {
    var rand = rng(7), i, x;
    var far = $('dFar');
    [['#bfe0a8', 236, 0], ['#a9d79a', 262, 1]].forEach(function (cfg) {
      var d = 'M-600 330';
      for (x = -600; x <= DIST.far + 1500; x += 20) d += ' L' + x + ' ' + (cfg[1] + 26 * Math.sin(x / 120 + cfg[2] * 2) + 12 * Math.sin(x / 41 + cfg[2]));
      d += ' L' + (DIST.far + 1500) + ' 330Z';
      add(far, 'path', { d: d, fill: cfg[0], stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' });
    });
    var mid = $('dMid'), bodies = ['#fff3dc', '#f9dcb4', '#e8f0d0'], roofs = ['#e0703a', '#c9573a', '#a4592c'];
    for (x = -500; x < DIST.mid + 1400; x += 150 + rand() * 90) {
      var w = 84 + rand() * 40, h = 56 + rand() * 26, b = bodies[Math.floor(rand() * 3)], r = roofs[Math.floor(rand() * 3)];
      var g = add(mid, 'g', { transform: 'translate(' + x.toFixed(1) + ' 322)' });
      add(g, 'rect', { x: 0, y: -h, width: w, height: h, fill: b, stroke: INK, 'stroke-width': 4 });
      add(g, 'polygon', { points: '-8,' + -h + ' ' + (w / 2) + ',' + (-h - 38) + ' ' + (w + 8) + ',' + -h, fill: r, stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' });
      add(g, 'rect', { x: w / 2 - 8, y: -30, width: 16, height: 30, fill: '#7a4326', stroke: INK, 'stroke-width': 3 });
      add(g, 'rect', { x: 10, y: -h + 14, width: 18, height: 16, fill: '#bfe6f2', stroke: INK, 'stroke-width': 3 });
      if (rand() > .45) {
        var tx = w + 26 + rand() * 20, tg = add(mid, 'g', { transform: 'translate(' + (x + tx).toFixed(1) + ' 322)' });
        add(tg, 'rect', { x: -4, y: -34, width: 8, height: 34, fill: '#7a4326', stroke: INK, 'stroke-width': 3 });
        add(tg, 'circle', { cx: 0, cy: -52, r: 24 + rand() * 8, fill: '#4f9a5a', stroke: INK, 'stroke-width': 4 });
      }
    }
    var near = $('dNear');
    for (x = -500; x < DIST.near + 1500; x += 240 + rand() * 120) {
      var lg = add(near, 'g', { transform: 'translate(' + x.toFixed(1) + ' 322)' });
      add(lg, 'path', { d: 'M0 0V-96Q0 -108 12 -108H22', fill: 'none', stroke: INK, 'stroke-width': 9, 'stroke-linecap': 'round' });
      add(lg, 'path', { d: 'M0 0V-96Q0 -108 12 -108H22', fill: 'none', stroke: '#6d5a52', 'stroke-width': 4, 'stroke-linecap': 'round' });
      add(lg, 'ellipse', { cx: 24, cy: -104, rx: 9, ry: 6, fill: '#ffe58a', stroke: INK, 'stroke-width': 3 });
      var bx = 70 + rand() * 60;
      add(lg, 'ellipse', { cx: bx, cy: -8, rx: 22 + rand() * 10, ry: 14, fill: '#6fae5f', stroke: INK, 'stroke-width': 3.5 });
    }
  }
  buildScenery();

  /* ---- rigs ---- */
  var rig = R.rig;
  var scoot = rig('#dScooter', 0, 0), tilt = rig('#dTilt', 72, 0), arm = rig('#dArm', -10, -142), bag = rig('#dBag', 0, 0),
      house = rig('#dHouse', 0, 0), door = rig('#dDoor', 74, -43), cust = rig('#dCust', 95, 0);
  var far = $('dFar'), mid = $('dMid'), near = $('dNear'), dash = $('dDash'), clouds = $('dClouds');
  var world = { v: 0 }, tl = null, order = null, lastFocus = null, state = { step: -1, done: false };
  var track = $('track').children;

  function applyWorld() {
    var v = world.v;
    far.setAttribute('transform', 'translate(' + (-DIST.far * v) + ' 0)');
    mid.setAttribute('transform', 'translate(' + (-DIST.mid * v) + ' 0)');
    near.setAttribute('transform', 'translate(' + (-DIST.near * v) + ' 0)');
    clouds.setAttribute('transform', 'translate(' + (-90 * v) + ' 0)');
    dash.setAttribute('stroke-dashoffset', DIST.near * v);
    house.o.x = HOUSE_START - DIST.near * v; house.ap();
  }

  function reset() {
    world.v = 0; applyWorld();
    scoot.o.x = -240; scoot.ap();
    tilt.o.r = 0; tilt.ap(); arm.o.r = 0; arm.ap();
    bag.o.x = 0; bag.o.y = 0; bag.o.r = 0; bag.ap();
    door.o.sx = 1; door.ap(); cust.o.sx = cust.o.sy = 0; cust.ap();
    $('dBag').style.opacity = 0; $('dPeek').style.opacity = 1; $('dSpeed').style.opacity = 0;
    root.querySelectorAll('.h').forEach(function (h) { h.style.opacity = 0; h.style.transform = ''; });
    state = { step: -1, done: false };
    root.classList.remove('is-stopped'); root.dataset.state = 'running';
  }

  function onTick() {
    var t = tl.time(), s = 0, i;
    for (i = 0; i < STEPS.length; i++) if (t >= STEPS[i]) s = i;
    if (s !== state.step) {
      state.step = s;
      for (i = 0; i < track.length; i++) track[i].className = i < s ? 'past' : i === s ? 'on' : '';
      $('delLive').textContent = LABELS[s];
    }
    root.classList.toggle('is-stopped', t >= 5.9);
    var done = t >= 8.0;
    if (done !== state.done) { state.done = done; root.dataset.state = done ? 'done' : 'running'; if (done) $('delDone').focus({ preventScroll: true }); }
  }

  function T(g, vars, pos) { vars.onUpdate = g.ap; return tl.to(g.o, vars, pos); }

  function build() {
    if (tl) tl.kill();
    reset();
    tl = gsap.timeline({ paused: true, onUpdate: onTick });
    T(scoot, { x: 300, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to('#dSpeed', { opacity: 1, duration: .3 }, .2);
    tl.to(world, { v: 1, duration: 4.6, ease: 'power1.out', onUpdate: applyWorld }, .4);
    tl.to('#dSpeed', { opacity: 0, duration: 1.2 }, 3.6);
    T(scoot, { x: 430, duration: .9, ease: 'power2.out' }, 5.0);
    T(tilt, { r: 3, duration: .2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 5.7);
    T(arm, { r: -70, duration: .35, ease: 'back.out(2)' }, 6.2);
    tl.set('#dPeek', { opacity: 0 }, 6.45).set('#dBag', { opacity: 1 }, 6.45);
    T(bag, { x: 204, duration: .8, ease: 'none' }, 6.45);
    T(bag, { y: -110, duration: .4, ease: 'power2.out' }, 6.45);
    T(bag, { y: 64, duration: .4, ease: 'power2.in' }, 6.85);
    T(bag, { r: 360, duration: .8, ease: 'none' }, 6.45);
    T(arm, { r: 0, duration: .4, ease: 'power2.inOut' }, 6.9);
    T(door, { sx: .12, duration: .5, ease: 'power2.inOut' }, 7.3);
    T(cust, { sx: 1, sy: 1, duration: .45, ease: 'back.out(2)' }, 7.6);
    tl.fromTo('.h', { y: 0, opacity: 0 }, { y: -44, opacity: 1, duration: .5, stagger: .14, ease: 'power1.out' }, 7.9);
    tl.to('.h', { opacity: 0, duration: .4, stagger: .1 }, 8.5);
    tl.to({}, { duration: .01 }, TOTAL);
    tl.eventCallback('onComplete', onTick);
    return tl;
  }

  /* ---- open / close ---- */
  var blockers = [];
  function setBlocked(on) {
    if (on) { blockers = [document.querySelector('main'), document.querySelector('header.top')].filter(Boolean); blockers.forEach(function (n) { n.inert = true; }); document.documentElement.style.overflow = 'hidden'; }
    else { blockers.forEach(function (n) { n.inert = false; }); blockers = []; document.documentElement.style.overflow = ''; }
  }

  function fillCard(o) {
    var money = R.money(o.order.total), how = o.order.payment.method === 'cod' ? 'Pay cash on delivery' : 'Paid online (test mode)';
    var first = (o.name || '').split(' ')[0];
    $('delTitle').textContent = first ? 'Thank you, ' + first + '!' : 'Thank you!';
    $('delMsg').textContent = 'Order ' + o.order.id + ' is confirmed. That ride is a preview of the journey. Estimated delivery: ' + (o.etaText || 'soon') + '. Total ' + money + '. ' + how + '.';
  }

  function play(o) {
    order = o; lastFocus = document.activeElement;
    fillCard(o);
    root.hidden = false; setBlocked(true);
    if (!window.gsap) { reset(); root.dataset.state = 'done'; for (var i = 0; i < track.length; i++) track[i].className = i < 3 ? 'past' : 'on'; $('delDone').focus(); return; }
    build();
    if (R.reduceMotion()) { tl.progress(1); onTick(); return; }
    $('delSkip').focus({ preventScroll: true });
    tl.play(0);
  }

  function close() {
    if (tl) tl.pause();
    root.hidden = true; setBlocked(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  $('delSkip').addEventListener('click', function () { if (tl) { tl.progress(1); onTick(); } });
  $('delDone').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || root.hidden) return;
    if (root.dataset.state === 'done') close(); else if (tl) { tl.progress(1); onTick(); }
  });

  R.delivery = { play: play, close: close, seek: function (t) { if (!tl) return; tl.pause(); tl.time(t); onTick(); }, get timeline() { return tl; }, TOTAL: TOTAL };
})();
