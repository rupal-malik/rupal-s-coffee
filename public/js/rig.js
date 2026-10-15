/* Shared helpers. A "rig" turns x / y / rotation / scale values into one SVG transform about a pivot,
   so GSAP can tween a plain object and we write the transform attribute ourselves. */
(function () {
  var R = (window.Rupal = window.Rupal || {});
  R.rig = function (target, px, py) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    var o = { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
    function ap() {
      el.setAttribute('transform', 'translate(' + o.x + ' ' + o.y + ') translate(' + px + ' ' + py + ') rotate(' + o.r + ') scale(' + o.sx + ' ' + o.sy + ') translate(' + (-px) + ' ' + (-py) + ')');
    }
    ap();
    return { o: o, ap: ap };
  };
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  R.reduceMotion = function () { return mq.matches; };
})();
