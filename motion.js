/* ==========================================================================
   Baseline hero — motion behaviour
   Plain JS, no motion library: CSS keyframes (motion.css) + one rAF loop.

   - cursorSpotlight(hero, layer)    pointer-driven grid spotlight
   - scrollReveal(el, onProgress)    0 → 1 progress for an element ("useScrollReveal")
   - createMockup(root)              mockup controller with a single `active` boolean
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     1b. Dither text reveal — every letter flickers through random quarter-
     block glyphs, then resolves left → right. Timings live in motion.css.
     ------------------------------------------------------------------------ */
  var DITHER_GLYPHS = '▖▗▘▙▚▛▜▝▞▟';

  function cssMs(name) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  }

  // Wrap every non-space character in a span, keeping existing elements
  // (e.g. the blinking period) in place around them.
  function randomGlyph() {
    return DITHER_GLYPHS[Math.floor(Math.random() * DITHER_GLYPHS.length)];
  }

  // Wrap every non-space character in a span, keeping existing elements
  // (e.g. the blinking period) in place around them.
  // `skip` (optional selector) leaves matching elements untouched — e.g. a
  // number that counts up on its own.
  function splitChars(node, out, hidden, skip) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!skip || !child.matches(skip)) splitChars(child, out, hidden, skip);
        return;
      }
      if (child.nodeType !== Node.TEXT_NODE) return;
      var frag = document.createDocumentFragment();
      Array.from(child.textContent).forEach(function (ch) {
        if (/\s/.test(ch)) {
          frag.appendChild(document.createTextNode(ch));
          return;
        }
        var span = document.createElement('span');
        span.className = hidden ? 'dither-ch is-hidden' : 'dither-ch';
        span.textContent = ch;
        frag.appendChild(span);
        out.push(span);
      });
      child.replaceWith(frag);
    });
  }

  // Scramble a list of character spans through block glyphs, then resolve
  // them in order. item.to (optional) is the character it resolves to.
  function scramble(items, opts) {
    var start = null;
    var lastShuffle = -Infinity;
    items.forEach(function (it) { it.state = it.el.classList.contains('is-hidden') ? 0 : 1; });

    function frame(now) {
      if (start === null) start = now;
      var t = now - start - (opts.delay || 0);
      if (t < 0) { requestAnimationFrame(frame); return; }

      var shuffle = now - lastShuffle >= opts.tick;
      if (shuffle) lastShuffle = now;
      var done = true;

      items.forEach(function (it, i) {
        if (t >= opts.hold + i * opts.step) {
          if (it.state !== 2) {
            if (it.to != null) it.el.textContent = it.to;
            it.el.classList.remove('is-hidden', 'is-scrambling');
            it.el.removeAttribute('data-glyph');
            it.state = 2;
          }
          return;
        }
        done = false;
        if (it.state !== 2 && !it.el.classList.contains('is-scrambling')) {
          it.el.classList.remove('is-hidden');
          it.el.classList.add('is-scrambling');
        }
        if (shuffle) it.el.setAttribute('data-glyph', randomGlyph());
      });

      if (!done) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Split el into hidden character spans (kept readable via aria-label) and
  // return the scramble items; reveal them later with scramble().
  function prepareDither(el, skip) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    var chars = [];
    splitChars(el, chars, true, skip);
    el.classList.add('is-dithered');
    return chars.map(function (span) { return { el: span }; });
  }

  // Hero H1 timing; delay can be overridden (Trust badges stagger per stat).
  function ditherOpts(delay) {
    return {
      delay: delay == null ? cssMs('--dither-delay') : delay,
      hold: cssMs('--dither-hold'),
      step: cssMs('--dither-step'),
      tick: cssMs('--dither-tick')
    };
  }

  function ditherReveal(el) {
    if (reduceMotion || !el) return;
    scramble(prepareDither(el), ditherOpts());
  }

  /* ------------------------------------------------------------------------
     2b. Live status pill — the numbers keep updating like real telemetry.
     Only the digits that change scramble, so the sentence stays put; the
     values keep the same character count, so the pill never changes width.
     ------------------------------------------------------------------------ */
  function liveStatus(pill) {
    if (reduceMotion || !pill) return function () {};

    var metrics = [
      { // edge nodes reporting: a small random walk around 2,418
        el: pill.querySelector('[data-live="nodes"]'),
        value: 2418, min: 2380, max: 2460,
        next: function (v) { return v + Math.round(Math.random() * 16) - 7; },
        format: function (v) { return v.toLocaleString('en-US'); }
      },
      { // p99 alert latency in tenths of a second: 1.5s – 2.1s
        el: pill.querySelector('[data-live="latency"]'),
        value: 18, min: 15, max: 21,
        next: function (v) { return v + Math.round(Math.random() * 2) - 1; },
        format: function (v) { return (v / 10).toFixed(1); }
      }
    ].filter(function (m) { return m.el; });

    metrics.forEach(function (m) {
      m.chars = [];
      splitChars(m.el, m.chars, false);
    });

    function update() {
      var items = [];
      metrics.forEach(function (m) {
        m.value = Math.min(m.max, Math.max(m.min, m.next(m.value)));
        var text = m.format(m.value);
        m.chars.forEach(function (span, i) {
          if (span.textContent !== text[i]) items.push({ el: span, to: text[i] });
        });
      });
      if (items.length) {
        scramble(items, {
          hold: cssMs('--dither-hold') * 0.7,
          step: cssMs('--dither-step') * 2,
          tick: cssMs('--dither-tick')
        });
      }
    }

    var timer = setInterval(update, cssMs('--live-interval'));
    return function () { clearInterval(timer); };
  }

  /* ------------------------------------------------------------------------
     3. Cursor spotlight — mouse only, written straight to the element's style.
     ------------------------------------------------------------------------ */
  function cursorSpotlight(hero, layer) {
    if (reduceMotion || !hero || !layer) return function () {};

    function onMove(e) {
      if (e.pointerType !== 'mouse') return;
      var r = layer.getBoundingClientRect();   // the layer may overhang its section
      layer.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      layer.style.setProperty('--my', (e.clientY - r.top) + 'px');
      layer.style.opacity = '1';
    }
    function onLeave() {
      layer.style.opacity = '0';
    }

    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return function () {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    };
  }

  /* ------------------------------------------------------------------------
     6. scrollReveal — the "useScrollReveal" hook.
     p = 0 when the element's top edge sits at the bottom of the viewport,
     p = 1 when it has climbed to 12% from the top.
     onProgress(p, inView) — inView is false once the element is fully off-screen.
     ------------------------------------------------------------------------ */
  function scrollReveal(el, onProgress) {
    if (reduceMotion) {
      onProgress(1, true);
      return function () {};
    }

    var pending = false;

    function update() {
      pending = false;
      var vh = window.innerHeight;
      var rect = el.getBoundingClientRect();
      var p = (vh - rect.top) / (vh * 0.88);
      onProgress(Math.min(1, Math.max(0, p)), rect.bottom > 0 && rect.top < vh);
    }
    function schedule() {
      if (pending) return;               // never queue a second frame
      pending = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();                            // correct on load / mid-page refresh

    return function () {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }

  /* ------------------------------------------------------------------------
     7. Mockup — everything fires off one boolean, and it loops on scroll:
     crossing ACTIVATE_AT on the way down plays the panel. Scrolling back
     below RESET_AT, or scrolling it fully off-screen in either direction,
     rewinds it so it replays on the next pass. The gap between the two
     thresholds stops it flickering when the reader parks near the edge.
     On tall viewports the mockup already sits near or above RESET_AT with the
     page scrolled to the top, so the rewind point moves up to halfway between
     that resting progress and ACTIVATE_AT, keeping it reachable.
     ------------------------------------------------------------------------ */
  var ACTIVATE_AT = 0.5;
  var RESET_AT = 0.4;
  var FEED_INTERVAL = 3600;
  var COUNT_DURATION = 1400;
  var easeOutQuart = function (t) { return 1 - Math.pow(1 - t, 4); };

  // Sample events cycled into the live feed.
  var FEED_POOL = [
    { server: 'edge-usw2-07', title: 'Packet loss above threshold',      meta: '4.2% loss on eth1 · 5 min window · INC-2049',        owner: 'Maya Chen',  status: 'critical' },
    { server: 'app-euw1-05',  title: 'Certificate renewed automatically', meta: 'TLS cert valid to 2027.01 · ACME challenge passed',   owner: 'Leo Kim',    status: 'healthy'  },
    { server: 'net-aps1-01',  title: 'BGP session re-established',        meta: 'Peer 10.4.0.1 · flap recovered in 2.1s',            owner: 'Priya Shah', status: 'healthy'  },
    { server: 'db-euw1-02',   title: 'Disk I/O latency spike',            meta: 'p99 write 48 ms · volume nvme1 · INC-2050',         owner: 'Noah Patel', status: 'critical' },
    { server: 'app-use1-04',  title: 'Canary deployment promoted',        meta: 'Release 4.18.2 · error rate 0.02% · 3 / 3 checks',  owner: 'Ava Brooks', status: 'healthy'  },
    { server: 'edge-use1-11', title: 'Config drift remediated',           meta: 'sshd_config restored · policy BASE-12',             owner: 'Noah Patel', status: 'healthy'  }
  ];
  // Fixed millisecond offsets so timestamps look organic but stay deterministic.
  var FEED_JITTER = [217, 64, 391, 158, 302, 45, 233, 118];

  function parseClock(text) {
    var m = text.trim().match(/^(\d+):(\d+):(\d+)\.(\d+)$/);
    return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4];
  }
  function formatClock(ms) {
    var pad = function (n, w) { return String(n).padStart(w, '0'); };
    var h = Math.floor(ms / 3600000) % 24;
    var mi = Math.floor(ms / 60000) % 60;
    var s = Math.floor(ms / 1000) % 60;
    return pad(h, 2) + ':' + pad(mi, 2) + ':' + pad(s, 2) + '.' + pad(ms % 1000, 3);
  }

  function formatMetric(el, value) {
    var decimals = (el.dataset.to.split('.')[1] || '').length;
    return value.toFixed(decimals) + '%';
  }

  // Returns a cancel function so a rewind can stop a count mid-flight.
  function countUp(el) {
    var from = parseFloat(el.dataset.from);
    var to = parseFloat(el.dataset.to);
    var start = null;
    var raf = 0;

    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / COUNT_DURATION);
      var value = t < 1 ? from + (to - from) * easeOutQuart(t) : to;
      el.textContent = formatMetric(el, value);
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }

  function flashId(row) {
    var id = row.querySelector('.sid');
    if (id) id.classList.add('flash');
  }
  function isAlert(row) {
    return !!row.querySelector('.badge.critical');
  }

  function createMockup(root) {
    var feed = root.querySelector('.feed');
    var header = feed.querySelector('.trow.th');
    var totalEl = root.querySelector('#feed-total');
    var pagesEl = root.querySelector('#feed-pages');
    var countEl = root.querySelector('#uptime-value');

    var rows = function () { return feed.querySelectorAll('.trow.td'); };
    var cap = rows().length;                        // keep the original length
    var template = rows()[0].cloneNode(true);
    var baseTime = parseClock(rows()[0].querySelector('.c-time').textContent);
    var total = parseInt(totalEl.textContent.replace(/,/g, ''), 10);
    var seq = 0;
    var active = false;
    var timer = null;
    var stopCount = function () {};

    // Stable unique ids for every row, newest first.
    rows().forEach(function (row, i) { row.dataset.id = 'evt-' + (total - i); });

    // Count-up starts from its lower value; the real value stays in the
    // markup so the page is complete without JS or under reduced motion.
    if (!reduceMotion) countEl.textContent = formatMetric(countEl, parseFloat(countEl.dataset.from));

    function addRow() {
      var item = FEED_POOL[seq % FEED_POOL.length];
      var at = baseTime + (seq + 1) * FEED_INTERVAL + FEED_JITTER[seq % FEED_JITTER.length];
      seq += 1;
      total += 1;

      var row = template.cloneNode(true);
      row.dataset.id = 'evt-' + total;
      row.querySelector('.c-time').textContent = formatClock(at);
      row.querySelector('.sid').textContent = item.server;
      row.querySelector('.event-title').textContent = item.title;
      row.querySelector('.event-meta').textContent = item.meta;
      row.querySelector('.c-owner').textContent = item.owner;
      var badge = row.querySelector('.badge');
      badge.className = 'badge ' + item.status;
      badge.textContent = item.status === 'critical' ? 'Critical' : 'Healthy';
      row.classList.add('is-new');

      header.insertAdjacentElement('afterend', row);
      var all = rows();
      for (var i = cap; i < all.length; i++) all[i].remove();   // oldest drops off

      if (isAlert(row)) flashId(row);
      totalEl.textContent = total.toLocaleString('en-US');
      pagesEl.textContent = String(Math.ceil(total / cap));
    }

    function play() {
      root.classList.add('is-active');           // bars, arc (CSS transitions)
      if (reduceMotion) return;                   // final state, no feed, no count

      stopCount = countUp(countEl);
      rows().forEach(function (row) { if (isAlert(row)) flashId(row); });
      timer = setInterval(addRow, FEED_INTERVAL);
    }

    // Rewind to the resting state so the next pass replays everything.
    // The feed keeps the rows it has received; it just pauses.
    function rewind() {
      root.classList.remove('is-active');        // bars + arc ease back down
      stopCount();
      if (timer) clearInterval(timer);
      timer = null;
      countEl.textContent = formatMetric(countEl, parseFloat(countEl.dataset.from));
      root.querySelectorAll('.sid.flash').forEach(function (el) { el.classList.remove('flash'); });
    }

    function setActive(next) {
      if (next === active) return;
      active = next;
      if (active) play();
      else if (!reduceMotion) rewind();          // reduced motion: stays final
    }

    function destroy() {
      stopCount();
      if (timer) clearInterval(timer);
      timer = null;
    }

    return { setActive: setActive, destroy: destroy };
  }

  /* ------------------------------------------------------------------------
     Integrations · inView — the "useInView" hook. Calls back once, the first
     time the element is `threshold` visible, then disconnects for good.
     ------------------------------------------------------------------------ */
  function inView(el, threshold, onEnter) {
    if (!el) return function () {};
    if (!('IntersectionObserver' in window)) {
      onEnter();
      return function () {};
    }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        onEnter();
      }
    }, { threshold: threshold });
    io.observe(el);
    return function () { io.disconnect(); };
  }

  /* ------------------------------------------------------------------------
     Integrations · logo carousel — rAF loop (not a CSS keyframe) so it can
     glide to a stop. x, velocity and the paused flag live in closures.
     ------------------------------------------------------------------------ */
  var COPY_MIN_WIDTH = 2560;     // each copy must out-span a 2560px screen

  function logoCarousel(row) {
    if (!row) return function () {};

    var topSpeed = cssMs('--carousel-speed') * (reduceMotion ? 1 / 3 : 1);
    var easeRate = cssMs('--carousel-ease');
    var items = Array.prototype.slice.call(row.children);

    // Keep the design's rhythm: the gap the 1280px space-between row had.
    var sum = items.reduce(function (w, li) { return w + li.getBoundingClientRect().width; }, 0);
    var gap = Math.max(40, Math.round((1280 - sum) / (items.length - 1)));

    // marquee (focus ring) > mask (clip + edge fade) > track (moves)
    var marquee = document.createElement('div');
    marquee.className = 'logo-marquee ' + Array.prototype.filter.call(row.classList, function (c) {
      return c.indexOf('reveal') === 0;               // carry the rise hooks over
    }).join(' ');
    marquee.tabIndex = 0;
    marquee.setAttribute('role', 'region');
    marquee.setAttribute('aria-label', 'Integrations');
    marquee.style.setProperty('--logo-gap', gap + 'px');

    var mask = document.createElement('div');
    mask.className = 'logo-mask';
    var track = document.createElement('div');
    track.className = 'logo-track';

    // Copy 1: the real list, repeated (aria-hidden repeats) until > 2560px.
    var copyA = document.createElement('ul');
    copyA.className = 'logo-copy';
    copyA.setAttribute('role', 'list');
    items.forEach(function (li) { copyA.appendChild(li); });
    var setWidth = sum + gap * items.length;
    var repeats = Math.max(1, Math.ceil(COPY_MIN_WIDTH / setWidth));
    for (var r = 1; r < repeats; r++) {
      items.forEach(function (li) {
        var clone = li.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        copyA.appendChild(clone);
      });
    }
    // Copy 2: identical, hidden from assistive tech. Wrapping at half the
    // track width lands copy 2 exactly where copy 1 started — no seam.
    var copyB = copyA.cloneNode(true);
    copyB.setAttribute('aria-hidden', 'true');
    copyB.removeAttribute('role');

    track.appendChild(copyA);
    track.appendChild(copyB);
    mask.appendChild(track);
    marquee.appendChild(mask);
    row.replaceWith(marquee);

    // Pause sources (any one pauses): mouse over, finger down, keyboard focus.
    var hovering = false, pressing = false, focused = false;
    var paused = function () { return hovering || pressing || focused; };

    marquee.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovering = true; });
    marquee.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hovering = false; });
    marquee.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') pressing = true; });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      window.addEventListener(type, function (e) { if (e.pointerType !== 'mouse') pressing = false; });
    });
    // Keyboard focus only: a tap on touch screens also focuses the marquee,
    // which used to leave it paused until you tapped somewhere else.
    marquee.addEventListener('focusin', function () { focused = marquee.matches(':focus-visible'); });
    marquee.addEventListener('focusout', function () { focused = false; });

    var x = 0;
    var v = topSpeed;
    var last = null;
    var raf = 0;

    function frame(now) {
      // Allow long frames (low-power phones throttle rAF): the old 50ms cap
      // made the belt crawl at a fraction of its speed on slow frame rates.
      // 1s still bounds the catch-up after the tab was hidden.
      var dt = last === null ? 0 : Math.min(1, (now - last) / 1000);
      last = now;
      var target = paused() ? 0 : topSpeed;
      v += (target - v) * Math.min(1, dt * easeRate);  // ~300ms glide down / up
      var half = track.scrollWidth / 2;
      if (half > 0) x = (x + v * dt) % half;
      track.style.transform = 'translate3d(' + (-x) + 'px, 0, 0)';
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return function () { cancelAnimationFrame(raf); };
  }

  /* ------------------------------------------------------------------------
     Features — one requestAnimationFrame engine, no CSS keyframes.
     ------------------------------------------------------------------------ */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var clamp01 = function (k) { return Math.max(0, Math.min(1, k)); };
  var easeInOutQuad = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(2 - 2 * k, 2) / 2; };

  // Fade + rise a set of elements in from JS (so the page still reads if JS fails).
  function riseIn(items, duration, shift, onDone) {
    var start = performance.now();
    function frame(now) {
      var done = true;
      items.forEach(function (it) {
        var k = clamp01((now - start - (it.delay || 0)) / duration);
        var e = easeOutQuart(k);
        it.el.style.opacity = k < 1 ? e : '';
        it.el.style.transform = k < 1 ? 'translate3d(0, ' + (shift * (1 - e)) + 'px, 0)' : '';
        if (k < 1) done = false;
      });
      if (!done) requestAnimationFrame(frame);
      else if (onDone) onDone();
    }
    requestAnimationFrame(frame);
  }
  var easeOutQuart = function (k) { return 1 - Math.pow(1 - k, 4); };

  /* 1. useReveal — children with data-reveal="<delay ms>" rise in once the
     section is 15% visible (or `threshold`); onActive fires at that moment. */
  function useReveal(root, onActive, threshold) {
    var items = Array.prototype.slice.call(root.querySelectorAll('[data-reveal]')).map(function (el) {
      return { el: el, delay: parseFloat(el.getAttribute('data-reveal')) || 0 };
    });
    if (reduceMotion) { onActive(); return function () {}; }
    var shift = cssMs('--feature-reveal-shift');
    items.forEach(function (it) {
      it.el.style.opacity = '0';
      it.el.style.transform = 'translate3d(0, ' + shift + 'px, 0)';
    });
    return inView(root, threshold || cssMs('--feature-reveal-threshold'), function () {
      riseIn(items, cssMs('--feature-reveal-duration'), shift);
      onActive();
    });
  }

  /* 2. Illustration engine — reads data-float / data-pulse / data-glow /
     data-draw / data-highlight from the SVG, runs one rAF loop, and writes
     straight to SVG attributes. Returns stop(), which also resets the art. */
  function runScene(svg) {
    var created = [];
    var touched = [];
    var list = function (sel) { return Array.prototype.slice.call(svg.querySelectorAll(sel)); };
    var nums = function (el, attr) { return el.getAttribute(attr).split(',').map(parseFloat); };

    // data-highlight="period,a,b" → a 10% ink band behind an isometric row.
    list('[data-highlight]').forEach(function (row) {
      var b = row.getBBox();
      var slope = 0.5774, band = 18;                 // rows run at the clipboard's 30° angle
      var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      var y = function (x) { return cy + slope * (x - cx); };
      var x0 = b.x - 4, x1 = b.x + b.width + 4;
      var poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', [
        x0 + ',' + (y(x0) - band / 2), x1 + ',' + (y(x1) - band / 2),
        x1 + ',' + (y(x1) + band / 2), x0 + ',' + (y(x0) + band / 2)
      ].join(' '));
      poly.setAttribute('fill', '#000');
      poly.setAttribute('fill-opacity', '0.1');
      poly.setAttribute('data-glow', row.getAttribute('data-highlight') + ',0');
      row.parentNode.insertBefore(poly, row);
      created.push(poly);
    });

    var floats = list('[data-float]').map(function (el) {
      var v = nums(el, 'data-float');
      touched.push([el, 'transform']);
      return { el: el, phase: v[0], amp: v[1] };
    });

    var pulses = list('[data-pulse]').map(function (el) {
      var parts = el.getAttribute('data-pulse').split(',');
      var path = svg.querySelector('#' + parts[0]);
      var dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('r', '3.5');
      dot.setAttribute('fill', '#000');               // accent: none, monochrome → ink
      dot.setAttribute('opacity', '0');
      path.parentNode.insertBefore(dot, path.nextSibling);   // inherits the wire's float
      created.push(dot);
      return { dot: dot, path: path, len: path.getTotalLength(), period: +parts[1], a: +parts[2], b: +parts[3], reverse: parts[4] === 'reverse' };
    });

    var glows = list('[data-glow]').map(function (el) {
      var v = nums(el, 'data-glow');
      touched.push([el, 'opacity']);
      return { el: el, period: v[0], a: v[1], b: v[2], base: v[3] };
    });

    var draws = list('[data-draw]').map(function (el) {
      var len = el.getTotalLength();
      el.setAttribute('stroke-dasharray', len);
      touched.push([el, 'stroke-dasharray'], [el, 'stroke-dashoffset']);
      return { el: el, len: len };
    });

    var start = null;
    var raf = 0;
    function frame(now) {
      if (start === null) start = now;
      var t = (now - start) / 1000;

      floats.forEach(function (f) {
        f.el.setAttribute('transform', 'translate(0 ' + (Math.sin(t * 1.4 + f.phase) * f.amp).toFixed(3) + ')');
      });

      pulses.forEach(function (p) {
        var f = (t / p.period) % 1;
        if (f < p.a || f > p.b) { p.dot.setAttribute('opacity', '0'); return; }
        var k = (f - p.a) / (p.b - p.a);
        var e = easeInOutQuad(k);
        var pt = p.path.getPointAtLength((p.reverse ? 1 - e : e) * p.len);
        p.dot.setAttribute('cx', pt.x.toFixed(2));
        p.dot.setAttribute('cy', pt.y.toFixed(2));
        p.dot.setAttribute('opacity', Math.min(1, k * 8, (1 - k) * 8).toFixed(3));
      });

      glows.forEach(function (g) {
        var f = (t / g.period) % 1;
        var ramp = 0;
        if (f >= g.a && f <= g.b) ramp = Math.min(1, (f - g.a) / 0.04, (g.b - f) / 0.04);
        g.el.setAttribute('opacity', (g.base + (1 - g.base) * ramp).toFixed(3));
      });

      draws.forEach(function (d) {
        d.el.setAttribute('stroke-dashoffset', d.len * (1 - Math.min(1, t / 1.6)));
      });

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return function stop() {
      cancelAnimationFrame(raf);
      created.forEach(function (n) { n.remove(); });
      touched.forEach(function (pair) { pair[0].removeAttribute(pair[1]); });   // back to the finished art
    };
  }

  // Fetch an illustration once and inline it so its parts can be driven.
  function loadFeatureArt(art) {
    if (art._svg) return Promise.resolve(art._svg);
    return fetch(art.getAttribute('data-svg'))
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        if (doc.querySelector('parsererror')) return Promise.reject();
        var svg = doc.documentElement;
        svg.setAttribute('aria-hidden', 'true');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg = document.importNode(svg, true);
        art.replaceChildren(svg);
        art._svg = svg;
        return svg;
      })
      .catch(function () { return null; });   // keep the static <img> fallback
  }

  /* Scroll-linked feature cards — replicates vectura.framer.website.
     Measured there at 1440×900, converted to the card's unscaled layout box,
     and expressed as fractions of viewport height:
       enter  card top    1.006vh → 0.134vh   opacity 0 → 1, scale 0.9 → 1
       leave  card bottom 0.416vh → -0.302vh  opacity 1 → 0, scale 1 → 0.9
     Smoothed two ways: progress is eased with smoothstep (soft start/stop at
     both ends of each transition), and rendered values glide toward the
     scroll target with a ~120ms time constant, so wheel steps blend.
     The nav item whose card top has passed mid-viewport is active.        */
  var CARD_ENTER = [1.006, 0.134];
  var CARD_LEAVE = [0.416, -0.302];
  var CARD_MIN_SCALE = 0.9;
  var CARD_GLIDE = 0.12;            // seconds — catch-up time constant
  var smoothstep = function (k) { return k * k * (3 - 2 * k); };

  function featuresSection(section) {
    if (!section) return function () {};
    var tabs = Array.prototype.slice.call(section.querySelectorAll('.feature-tab'));
    var cards = tabs.map(function (t) { return document.getElementById(t.getAttribute('data-target')); });
    var revealed = false;
    var scenes = cards.map(function () { return null; });   // stop() per running card scene
    var tokens = cards.map(function () { return 0; });

    function setScene(i, on) {
      if (reduceMotion || !revealed) on = false;
      if (on === !!scenes[i]) return;
      if (!on) {
        if (typeof scenes[i] === 'function') scenes[i]();
        scenes[i] = null;
        tokens[i]++;
        return;
      }
      scenes[i] = true;                                    // loading
      var token = ++tokens[i];
      loadFeatureArt(cards[i].querySelector('.feature-art')).then(function (svg) {
        if (token !== tokens[i]) return;
        scenes[i] = svg ? runScene(svg) : null;
      });
    }

    // Active = last card whose top has passed mid-screen: drives the desktop
    // tabs and, on stacked layouts, each card's title arrow (.is-active).
    function setActive(index) {
      tabs.forEach(function (t, i) {
        if (i === index) t.setAttribute('aria-current', 'true');
        else t.removeAttribute('aria-current');
      });
      cards.forEach(function (c, i) { c.classList.toggle('is-active', i === index); });
    }

    var target = cards.map(function () { return 1; });
    var current = cards.map(function () { return null; });   // null → snap on first measure
    var gliding = false, last = null;

    // Read scroll position → target progress per card (+ nav + scenes).
    function measure() {
      var vh = window.innerHeight;
      var active = -1;
      cards.forEach(function (card, i) {
        // Unscaled layout box (the card scales about its centre).
        var r = card.getBoundingClientRect();
        var h = card.offsetHeight;
        var top = r.top - (h - r.height) / 2;
        var bottom = top + h;
        if (top <= vh / 2) active = i;
        var pIn = clamp01((CARD_ENTER[0] * vh - top) / ((CARD_ENTER[0] - CARD_ENTER[1]) * vh));
        var pOut = clamp01((bottom - CARD_LEAVE[1] * vh) / ((CARD_LEAVE[0] - CARD_LEAVE[1]) * vh));
        target[i] = smoothstep(Math.min(pIn, pOut));
        if (current[i] === null) current[i] = target[i];
        setScene(i, target[i] > 0 || current[i] > 0.001); // only animate cards you can see
      });
      setActive(active);
    }

    function render(i) {
      var o = current[i];
      var card = cards[i];
      card.style.opacity = o < 0.9995 ? o.toFixed(4) : '';
      card.style.transform = o < 0.9995 ? 'scale(' + (CARD_MIN_SCALE + (1 - CARD_MIN_SCALE) * o).toFixed(4) + ')' : '';
    }

    // Glide rendered values toward their targets; stops itself when settled.
    function glide(now) {
      var dt = last === null ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
      last = now;
      var k = 1 - Math.exp(-dt / CARD_GLIDE);
      var moving = false;
      cards.forEach(function (card, i) {
        var d = target[i] - current[i];
        current[i] = Math.abs(d) < 0.0005 ? target[i] : current[i] + d * k;
        if (current[i] !== target[i]) moving = true;
        render(i);
      });
      if (moving) requestAnimationFrame(glide);
      else { gliding = false; last = null; }
    }

    var pending = false;
    function update() {
      pending = false;
      measure();
      if (reduceMotion) return;
      if (!gliding) { gliding = true; requestAnimationFrame(glide); }
    }
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    }

    // Nav click → bring that card to its fully-revealed position.
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        var r = cards[i].getBoundingClientRect();
        var top = r.top - (cards[i].offsetHeight - r.height) / 2;
        var y = top + window.scrollY - CARD_ENTER[1] * window.innerHeight;
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();

    var stopReveal = useReveal(section, function () {
      revealed = true;
      update();
    });

    return function () {
      stopReveal();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cards.forEach(function (c, i) { setScene(i, false); });
    };
  }

  /* ------------------------------------------------------------------------
     Wire-up
     ------------------------------------------------------------------------ */
  var hero = document.querySelector('.hero');
  var stage = document.getElementById('mockup-stage');
  var reveal = document.getElementById('mockup-reveal');
  var mockup = createMockup(document.getElementById('mockup'));

  ditherReveal(document.querySelector('.hero-title[data-dither]'));
  var stopLive = liveStatus(document.querySelector('.pill'));
  rollText(document.querySelectorAll('.site-nav .topnav-links a'));
  var stopMenu = navMenu(document.querySelector('.site-nav'));

  /* ------------------------------------------------------------------------
     How it works — the icon loop is CSS (motion.css); this toggles
     .is-animating per card (hover on mouse devices, on-screen on touch) and
     splits the title into words for the heading reveal.
     ------------------------------------------------------------------------ */
  function splitWords(node, out) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType !== 3) { splitWords(child, out); return; }
      var frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var span = document.createElement('span');
        span.className = 'hiw-word';
        span.textContent = part;
        span.style.setProperty('--i', out.length);
        out.push(span);
        frag.appendChild(span);
      });
      child.replaceWith(frag);
    });
    return out;
  }

  // Heading reveal: split the title, then blur-rise the words once the
  // heading is --hiw-head-threshold visible (shared by How it works / Why).
  function wordReveal(head) {
    var words = splitWords(head.querySelector('h2'), []);
    head.style.setProperty('--words', words.length);
    head.classList.add('is-split');
    return inView(head, cssMs('--hiw-head-threshold'), function () {
      head.classList.add('is-revealed');
    });
  }

  function howItWorks(section) {
    if (!section) return function () {};
    var head = section.querySelector('.hiw-head');
    var stopReveal = useReveal(section, function () {});
    if (reduceMotion) return stopReveal;

    var stopHead = wordReveal(head);

    // Icon loop: mouse → plays on the hovered card; touch → every card
    // plays while the section is on screen.
    var steps = Array.prototype.slice.call(section.querySelectorAll('.hiw-step'));
    var setAnimating = function (on) {
      steps.forEach(function (step) { step.classList.toggle('is-animating', on); });
    };
    var hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    var io = null;
    function onEnter(e) { if (e.pointerType === 'mouse') e.currentTarget.classList.add('is-animating'); }
    function onLeave(e) { e.currentTarget.classList.remove('is-animating'); }
    function wire() {
      if (io) { io.disconnect(); io = null; }
      setAnimating(false);
      if (hoverMq.matches) return;
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) { setAnimating(entries[0].isIntersecting); });
        io.observe(section);
      } else {
        setAnimating(true);
      }
    }
    steps.forEach(function (step) {
      step.addEventListener('pointerenter', onEnter);
      step.addEventListener('pointerleave', onLeave);
    });
    if (hoverMq.addEventListener) hoverMq.addEventListener('change', wire);
    wire();

    return function () {
      stopReveal();
      stopHead();
      if (io) io.disconnect();
      if (hoverMq.removeEventListener) hoverMq.removeEventListener('change', wire);
      steps.forEach(function (step) {
        step.removeEventListener('pointerenter', onEnter);
        step.removeEventListener('pointerleave', onLeave);
      });
    };
  }

  /* ------------------------------------------------------------------------
     Trust badges — rAF only. At 30% visible each stat's text dither-reveals
     like the hero H1 (staggered per stat); one shared progress p (usePlay,
     1600ms easeOutQuart) drives all four count-ups and accent bars, so they
     finish together. Runs once.
     ------------------------------------------------------------------------ */
  // usePlay — call play() when `run` flips true: tweens p 0 → 1 over ms
  // (easeOutQuart) and hands each frame's p to onFrame. Returns { play, stop }.
  function usePlay(ms, onFrame) {
    var raf = 0;
    return {
      play: function () {
        var start = performance.now();
        (function frame(now) {
          var k = Math.min(1, (now - start) / ms);
          onFrame(easeOutQuart(k));
          if (k < 1) raf = requestAnimationFrame(frame);
        })(start);
      },
      stop: function () { cancelAnimationFrame(raf); }
    };
  }

  function trustBadges(section) {
    if (!section) return function () {};
    var stats = Array.prototype.slice.call(section.querySelectorAll('.trust-stat'));
    var counts = Array.prototype.slice.call(section.querySelectorAll('[data-count]'));
    var bars = Array.prototype.slice.call(section.querySelectorAll('.trust-bar'));

    // value = target × p, en-US, always at the target's fixed decimals.
    function render(p) {
      counts.forEach(function (el) {
        var d = parseInt(el.dataset.decimals, 10) || 0;
        el.textContent = (parseFloat(el.dataset.count) * p).toLocaleString('en-US', {
          minimumFractionDigits: d, maximumFractionDigits: d
        });
      });
      bars.forEach(function (bar) { bar.style.transform = 'scaleX(' + p + ')'; });
    }

    if (reduceMotion) { render(1); return function () {}; }

    // Text reveal = the hero H1 dither: each stat's value affixes, label and
    // note are split into hidden glyph cells now (the counting number is
    // skipped — usePlay drives it) and scramble → resolve on reveal.
    var groups = stats.map(function (stat) {
      return {
        delay: parseFloat(stat.dataset.dither) || 0,
        lines: ['.trust-value', '.trust-label', '.trust-note'].map(function (sel) {
          return prepareDither(stat.querySelector(sel), '[data-count]');
        })
      };
    });

    // Lock each number at its final width (once the webfont is in), so the
    // fewer digits early in the count never pull the suffix left.
    var locked = false;
    function lock() {
      if (locked) return;
      locked = true;
      counts.forEach(function (el) { el.style.minWidth = el.getBoundingClientRect().width + 'px'; });
      render(0);
    }
    bars.forEach(function (bar) { bar.style.transform = 'scaleX(0)'; });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(lock);

    var player = usePlay(cssMs('--trust-play-duration'), render);
    var stopInView = inView(section, cssMs('--trust-reveal-threshold'), function () {
      lock();
      player.play();
      groups.forEach(function (g) {
        g.lines.forEach(function (items) { scramble(items, ditherOpts(g.delay)); });
      });
    });

    return function () {
      player.stop();
      stopInView();
    };
  }

  /* ------------------------------------------------------------------------
     Testimonials — topic wheel + quote card carousel. Each wheel item sits
     at its circular offset d ∈ [-3, 2] from the active topic (CSS turns --d
     into translateY); an item that wraps round jumps with no transition while
     hidden, then fades back. Autoplay advances every 5s while on screen and
     not hovered / focused; a manual pick restarts the 5s count.
     ------------------------------------------------------------------------ */
  function testimonials(section) {
    if (!section) return function () {};
    var items = Array.prototype.slice.call(section.querySelectorAll('.tm-wheel li'));
    var topics = items.map(function (li) { return li.querySelector('.tm-topic'); });
    var slides = Array.prototype.slice.call(section.querySelectorAll('.tm-slide'));
    var countNow = section.querySelector('.tm-count-now');
    var n = items.length;
    var active = 0;
    var offsets = [];
    var leaveTimer = 0;

    function place() {
      items.forEach(function (li, i) {
        var d = ((i - active) % n + n) % n;
        if (d > 2) d -= n;
        if (offsets[i] != null && Math.abs(d - offsets[i]) > 1 && !reduceMotion) {
          li.classList.add('is-wrapping');
          li.style.setProperty('--d', d);
          void li.offsetWidth;               // commit the jump before fading back in
          requestAnimationFrame(function () { li.classList.remove('is-wrapping'); });
        } else {
          li.style.setProperty('--d', d);
        }
        offsets[i] = d;
      });
    }

    function go(next) {
      next = (next % n + n) % n;
      if (next === active) return;
      var prev = slides[active];
      active = next;
      topics.forEach(function (b, i) {
        if (i === active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      clearTimeout(leaveTimer);
      slides.forEach(function (sl) { sl.classList.remove('is-leaving'); });
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      leaveTimer = setTimeout(function () { prev.classList.remove('is-leaving'); }, cssMs('--tm-swap-duration') + 150);
      slides[active].classList.add('is-active');
      countNow.textContent = String(active + 1).padStart(2, '0');
      if (!reduceMotion) scramble(prepareDither(countNow), ditherOpts(0));
      place();
    }

    // Autoplay
    var visible = false, hovering = false, focused = false, stopped = reduceMotion;   // reduced motion: no autoplay
    var timer = 0;
    function schedule() {
      clearTimeout(timer);
      if (stopped || !visible || hovering || focused) return;
      timer = setTimeout(function () { go(active + 1); schedule(); }, cssMs('--tm-autoplay'));
    }
    // A manual pick restarts the 5s count from that review (no early jump).
    function takeOver() { schedule(); }

    var row = section.querySelector('.tm-body');
    function onEnter(e) { if (e.pointerType === 'mouse') { hovering = true; schedule(); } }
    function onLeave(e) { if (e.pointerType === 'mouse') { hovering = false; schedule(); } }
    // Pause for keyboard focus only — a mouse click also focuses the button,
    // which shouldn't stop the rotation.
    function onFocusIn(e) { focused = e.target.matches(':focus-visible'); schedule(); }
    function onFocusOut(e) { if (!row.contains(e.relatedTarget)) { focused = false; schedule(); } }
    row.addEventListener('pointerenter', onEnter);
    row.addEventListener('pointerleave', onLeave);
    row.addEventListener('focusin', onFocusIn);
    row.addEventListener('focusout', onFocusOut);

    function onTopic(e) { go(parseInt(e.currentTarget.dataset.index, 10)); takeOver(); }
    function onPrev() { go(active - 1); takeOver(); }
    function onNext() { go(active + 1); takeOver(); }
    function onKey(e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      go(active + (e.key === 'ArrowDown' ? 1 : -1));
      takeOver();
      topics[active].focus();
    }
    var prevBtn = section.querySelector('.tm-arrow.is-prev');
    var nextBtn = section.querySelector('.tm-arrow.is-next');
    var wheel = section.querySelector('.tm-wheel');
    topics.forEach(function (b) { b.addEventListener('click', onTopic); });
    prevBtn.addEventListener('click', onPrev);
    nextBtn.addEventListener('click', onNext);
    wheel.addEventListener('keydown', onKey);

    var io = null;
    if ('IntersectionObserver' in window) {
      // Watch the carousel itself (not the taller section, which a short
      // window can never show 40% of).
      io = new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; schedule(); },
        { threshold: 0.4 });
      io.observe(row);
    }

    place();
    var stopReveal = useReveal(section, function () {});
    var stopHead = reduceMotion ? function () {} : wordReveal(section.querySelector('.tm-head'));

    return function () {
      clearTimeout(timer);
      clearTimeout(leaveTimer);
      if (io) io.disconnect();
      stopReveal();
      stopHead();
      row.removeEventListener('pointerenter', onEnter);
      row.removeEventListener('pointerleave', onLeave);
      row.removeEventListener('focusin', onFocusIn);
      row.removeEventListener('focusout', onFocusOut);
      topics.forEach(function (b) { b.removeEventListener('click', onTopic); });
      prevBtn.removeEventListener('click', onPrev);
      nextBtn.removeEventListener('click', onNext);
      wheel.removeEventListener('keydown', onKey);
    };
  }

  /* ------------------------------------------------------------------------
     Pricing — badge, switch, plans rise (useReveal); title word reveal; the
     Monthly / Annual switch sets data-billing (CSS slides the thumb and
     crossfades the notes) and tweens each price to its new figure.
     ------------------------------------------------------------------------ */
  function pricing(section) {
    if (!section) return function () {};
    var nums = Array.prototype.slice.call(section.querySelectorAll('.plan-num'));
    var options = Array.prototype.slice.call(section.querySelectorAll('.price-switch .why-option'));
    var raf = 0;

    function show(el, v) { el.textContent = Math.round(v).toLocaleString('en-US'); }
    function tweenTo(billing) {
      cancelAnimationFrame(raf);
      var from = nums.map(function (el) { return parseFloat(el.textContent.replace(/,/g, '')) || 0; });
      var to = nums.map(function (el) { return parseFloat(el.dataset[billing]); });
      if (reduceMotion) { nums.forEach(function (el, i) { show(el, to[i]); }); return; }
      var duration = cssMs('--price-count-duration');
      var start = performance.now();
      (function frame(now) {
        var k = Math.min(1, (now - start) / duration);
        var e = easeOutQuart(k);
        nums.forEach(function (el, i) { show(el, from[i] + (to[i] - from[i]) * e); });
        if (k < 1) raf = requestAnimationFrame(frame);
      })(start);
    }
    function onClick(e) {
      var billing = e.currentTarget.dataset.billing;
      if (section.dataset.billing === billing) return;
      section.dataset.billing = billing;
      options.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.billing === billing)); });
      tweenTo(billing);
    }
    options.forEach(function (b) { b.addEventListener('click', onClick); });

    var stopReveal = useReveal(section, function () {});
    var stopHead = reduceMotion ? function () {} : wordReveal(section.querySelector('.price-head'));

    return function () {
      cancelAnimationFrame(raf);
      stopReveal();
      stopHead();
      options.forEach(function (b) { b.removeEventListener('click', onClick); });
    };
  }

  /* ------------------------------------------------------------------------
     Footer — CTA copy rises (useReveal), the title dither-reveals like the
     hero H1 once 40% of the CTA is visible, the brand plays Figma's entrance,
     and the link columns rise.
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     Nav menu (≤900px): the burger toggles .is-open on the bar, which opens
     the links + Contact Sales as a full-screen sheet (page scroll locked). Closes on Escape, on a link
     tap, on a tap outside, and when the viewport grows past 900px.
     ------------------------------------------------------------------------ */
  function navMenu(nav) {
    if (!nav) return function () {};
    var burger = nav.querySelector('.topnav-burger');
    var menu = nav.querySelector('.topnav-right');
    var mq = window.matchMedia('(max-width: 900px)');

    // Stagger index for the sheet's link rise.
    Array.prototype.forEach.call(menu.querySelectorAll('.topnav-links li'), function (li, i) {
      li.style.setProperty('--i', i);
    });

    function setOpen(open, returnFocus) {
      nav.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (!open && returnFocus) burger.focus();
    }
    function onBurger() { setOpen(!nav.classList.contains('is-open')); }
    function onKey(e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, true);
    }
    function onDocClick(e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false);
    }
    function onMenuClick(e) { if (e.target.closest('a')) setOpen(false); }
    function onMq() { if (!mq.matches) setOpen(false); }

    burger.addEventListener('click', onBurger);
    menu.addEventListener('click', onMenuClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick);
    if (mq.addEventListener) mq.addEventListener('change', onMq);

    return function () {
      burger.removeEventListener('click', onBurger);
      menu.removeEventListener('click', onMenuClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
      if (mq.removeEventListener) mq.removeEventListener('change', onMq);
    };
  }

  // Text roll (finara.framer.website): wrap each link label in a one-line
  // clip holding the label twice; CSS slides both up on hover / focus. The
  // copy is hidden from assistive tech. Used by the nav and footer links.
  function rollText(links) {
    if (reduceMotion) return;
    Array.prototype.forEach.call(links, function (a) {
      var label = a.textContent.trim();
      a.textContent = '';
      var roll = document.createElement('span');
      roll.className = 'roll';
      var top = document.createElement('span');
      top.textContent = label;
      var copy = document.createElement('span');
      copy.textContent = label;
      copy.setAttribute('aria-hidden', 'true');
      roll.appendChild(top);
      roll.appendChild(copy);
      a.appendChild(roll);
    });
  }

  function footer(root) {
    if (!root) return function () {};
    var cta = root.querySelector('.foot-cta');
    var links = root.querySelector('.foot-links');
    var brand = root.querySelector('.foot-brand');
    var stops = [useReveal(cta, function () {}), useReveal(links, function () {})];
    if (reduceMotion) return function () { stops.forEach(function (f) { f(); }); };

    rollText(root.querySelectorAll('.foot-col a'));

    var titleChars = prepareDither(root.querySelector('.foot-title'));
    stops.push(inView(cta, 0.4, function () { scramble(titleChars, ditherOpts(80)); }));
    stops.push(inView(links, 0.15, function () { brand.classList.add('is-in'); }));

    return function () { stops.forEach(function (f) { f(); }); };
  }

  /* ------------------------------------------------------------------------
     Robot arm divider — one rAF loop writes t (ms); everything is a pure
     function of t, drawn in flat side view on an SVG whose viewBox is
     centred on the arm base (divider line at y = 0).
       Cycle (7000ms): pick lower 0–600 · close 600–900 · lift 900–1500 ·
       swing L→R 1500–2900 · drop lower 2900–3500 · open 3500–3800 ·
       lift 3800–4400 · swing R→L 4400–5800 · wait 5800–7000.
     The swing is the turret turning (psi PI → 0 → PI), not the arm
     flipping: the arm is solved with 2-link IK (elbow up) at full reach and
     every x is scaled by f = cos(psi), so it foreshortens mid-swing.
     ------------------------------------------------------------------------ */
  var RB = {
    L1: 56, L2: 60, SHOULDER_Y: -36, REACH: 75, CARRY_Y: -70, GRIP_Y: -34,
    BELT_Y: -8, SPEED: 140, MARK: 14, CYCLE: 7000, TOP: -120, H: 132
  };
  var SVGNS = 'http://www.w3.org/2000/svg';

  var easeInOutCubic = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  function seg(t, a, b) { return easeInOutCubic(clamp01((t - a) / (b - a))); }

  function svgEl(parent, tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    parent.appendChild(el);
    return el;
  }
  function setAttrs(el, attrs) { for (var k in attrs) el.setAttribute(k, attrs[k]); }

  // Arm pose for a time within the cycle.
  function armPose(tc) {
    var lowerPick = seg(tc, 0, 600), close = seg(tc, 600, 900), liftPick = seg(tc, 900, 1500);
    var swingOut = seg(tc, 1500, 2900), lowerDrop = seg(tc, 2900, 3500), open = seg(tc, 3500, 3800);
    var liftDrop = seg(tc, 3800, 4400), swingBack = seg(tc, 4400, 5800);
    var down = lowerPick - liftPick + lowerDrop - liftDrop;
    var wristY = RB.CARRY_Y + (RB.GRIP_Y - RB.CARRY_Y) * down;
    var f = Math.cos(Math.PI * (1 - swingOut + swingBack));
    var rel = wristY - RB.SHOULDER_Y;
    var d = Math.hypot(RB.REACH, rel);
    var a = Math.atan2(rel, RB.REACH);
    var b = Math.acos(Math.max(-1, Math.min(1, (RB.L1 * RB.L1 + d * d - RB.L2 * RB.L2) / (2 * RB.L1 * d))));
    var p1 = a - b;
    return {
      f: f,
      grip: close - open,
      elbow: { x: RB.L1 * Math.cos(p1) * f, y: RB.SHOULDER_Y + RB.L1 * Math.sin(p1) },
      wrist: { x: RB.REACH * f, y: wristY }
    };
  }

  function robotDivider(strip) {
    if (!strip) return function () {};
    var svg = strip.querySelector('svg');
    var W = 1440;
    var STROKE = { stroke: '#fff', 'stroke-width': 1.25, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    function solid(fill) { var o = { fill: fill }; for (var k in STROKE) o[k] = STROKE[k]; return o; }

    // Static scene — every part matches the reference poses (robot-arm-*.svg,
    // 360×150 frame, base centre x 180, baseline y 118) shifted to the origin.
    var defs = svgEl(svg, 'defs', {});
    var clipIn = svgEl(svgEl(defs, 'clipPath', { id: 'rb-clip-in' }), 'rect', {});
    var clipOut = svgEl(svgEl(defs, 'clipPath', { id: 'rb-clip-out' }), 'rect', {});
    var line = svgEl(svg, 'line', { y1: 0, y2: 0, stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1 });
    var FAINT = function (o) { return { stroke: 'rgba(255,255,255,' + o + ')', 'stroke-width': 1, 'stroke-linecap': 'round' }; };

    // Belts: 8px slabs, rollers 4px tall every 14px.
    var beltIn = svgEl(svg, 'rect', solid('#0B0B0B'));
    var marksIn = svgEl(svg, 'g', Object.assign({ 'clip-path': 'url(#rb-clip-in)' }, FAINT(0.3)));
    svgEl(svg, 'rect', Object.assign(solid('#0B0B0B'), { x: -61.5, y: -13, width: 2.5, height: 5, rx: 0.5 }));  // end stop
    var beltOut = svgEl(svg, 'rect', solid('#0B0B0B'));
    var marksOut = svgEl(svg, 'g', Object.assign({ 'clip-path': 'url(#rb-clip-out)' }, FAINT(0.3)));
    svgEl(svg, 'path', Object.assign({ d: 'M63 -11V-9M87 -11V-9', fill: 'none' }, STROKE));                    // drop marks

    // Box: 16×12, tape + label.
    function box(parent, top) {
      var g = svgEl(parent, 'g', {});
      svgEl(g, 'rect', Object.assign(solid('#000'), { x: -8, y: top, width: 16, height: 12, rx: 1.5 }));
      svgEl(g, 'line', Object.assign({ x1: 0, x2: 0, y1: top, y2: top + 5 }, FAINT(0.5), { 'stroke-linecap': 'butt' }));
      svgEl(g, 'line', Object.assign({ x1: -5, x2: -1, y1: top + 8.5, y2: top + 8.5 }, FAINT(0.5)));
      return g;
    }
    // Boxes on the belts (pool for cycles k-1 … k+3) sit behind the arm.
    var boxes = [];
    for (var i = 0; i < 5; i++) boxes.push(box(svg, -12));

    // Base: plate, panel with two LEDs, vents · turret with seam · housing with vent.
    svgEl(svg, 'rect', Object.assign(solid('#0B0B0B'), { x: -30, y: -7, width: 60, height: 7, rx: 1.5 }));
    svgEl(svg, 'rect', { x: -25, y: -5, width: 14, height: 3, rx: 1, fill: '#000', stroke: 'rgba(255,255,255,0.6)', 'stroke-width': 1 });
    var baseLed = svgEl(svg, 'circle', { cx: -21.5, cy: -3.5, r: 0.9, fill: '#fff' });
    var baseLed2 = svgEl(svg, 'circle', { cx: -18, cy: -3.5, r: 0.9, fill: '#fff', 'fill-opacity': 0.35 });
    svgEl(svg, 'path', Object.assign({ d: 'M6 -4.6H24M6 -2.4H20', fill: 'none' }, FAINT(0.35)));
    svgEl(svg, 'rect', Object.assign(solid('#141414'), { x: -16, y: -17, width: 32, height: 10, rx: 2 }));
    svgEl(svg, 'line', Object.assign({ x1: -16, x2: 16, y1: -12, y2: -12 }, FAINT(0.35), { 'stroke-linecap': 'butt' }));
    svgEl(svg, 'rect', Object.assign(solid('#0B0B0B'), { x: -11, y: -29, width: 22, height: 12, rx: 2 }));
    svgEl(svg, 'line', Object.assign({ x1: -6, x2: 6, y1: -21, y2: -21 }, FAINT(0.4)));

    // Arm segment: 10px white outline, 7.5px fill, slot line over the middle 40%.
    function segment() {
      return {
        outer: svgEl(svg, 'line', { stroke: '#fff', 'stroke-width': 10, 'stroke-linecap': 'round' }),
        inner: svgEl(svg, 'line', { stroke: '#0B0B0B', 'stroke-width': 7.5, 'stroke-linecap': 'round' }),
        slot: svgEl(svg, 'line', FAINT(0.45))
      };
    }
    function placeSegment(sg, x1, y1, x2, y2) {
      setAttrs(sg.outer, { x1: x1, y1: y1, x2: x2, y2: y2 });
      setAttrs(sg.inner, { x1: x1, y1: y1, x2: x2, y2: y2 });
      setAttrs(sg.slot, { x1: x1 + (x2 - x1) * 0.3, y1: y1 + (y2 - y1) * 0.3, x2: x1 + (x2 - x1) * 0.7, y2: y1 + (y2 - y1) * 0.7 });
    }
    // Joint: disc + ring + pin, all foreshortened by |f| (min 0.3).
    function joint(r, ring) {
      return {
        r: r, ring: ring,
        disc: svgEl(svg, 'ellipse', Object.assign(solid('#141414'), { ry: r })),
        hole: svgEl(svg, 'ellipse', Object.assign(solid('#000'), { ry: ring })),
        pin: svgEl(svg, 'ellipse', { ry: 1.6, fill: '#fff' })
      };
    }
    function placeJoint(j, cx, cy, af) {
      setAttrs(j.disc, { cx: cx, cy: cy, rx: j.r * af });
      setAttrs(j.hole, { cx: cx, cy: cy, rx: j.ring * af });
      setAttrs(j.pin, { cx: cx, cy: cy, rx: 1.6 * af });
    }

    var lowerArm = segment();                 // shoulder → elbow
    var shoulder = joint(10, 5.5);
    var upperArm = segment();                 // elbow → wrist
    var elbow = joint(8, 4.4);

    // Gripper hangs straight down from the wrist; carries its box.
    var gripG = svgEl(svg, 'g', {});
    var heldBox = box(gripG, 14);             // bottom = wristY + 26
    svgEl(gripG, 'rect', Object.assign(solid('#0B0B0B'), { x: -3, y: 0, width: 6, height: 8 }));            // wrist block
    svgEl(gripG, 'rect', Object.assign(solid('#141414'), { x: -13, y: 8, width: 26, height: 5.5, rx: 1.5 }));// palm
    var palmLed = svgEl(gripG, 'circle', { cx: 0, cy: 10.75, r: 1.3, fill: '#fff' });
    var fingerL = svgEl(gripG, 'rect', Object.assign(solid('#0B0B0B'), { y: 13.5, width: 3, height: 12, rx: 1 }));
    var fingerR = svgEl(gripG, 'rect', Object.assign(solid('#0B0B0B'), { y: 13.5, width: 3, height: 12, rx: 1 }));
    var wrist = joint(6, 3.3);

    // Layout from the strip width (ResizeObserver) -------------------------
    var beltInRight = -57, beltOutLeft = 61;
    function layout() {
      W = Math.max(320, strip.getBoundingClientRect().width);
      svg.setAttribute('viewBox', (-W / 2) + ' ' + RB.TOP + ' ' + W + ' ' + RB.H);
      setAttrs(line, { x1: -W / 2, x2: W / 2 });
      var inAttrs = { x: -W / 2 - 4, y: RB.BELT_Y, width: beltInRight + W / 2 + 4, height: 8, rx: 1.5 };
      var outAttrs = { x: beltOutLeft, y: RB.BELT_Y, width: W / 2 + 4 - beltOutLeft, height: 8, rx: 1.5 };
      setAttrs(beltIn, inAttrs); setAttrs(clipIn, inAttrs);
      setAttrs(beltOut, outAttrs); setAttrs(clipOut, outAttrs);
      buildMarks(marksIn, -W / 2 - RB.MARK * 2, beltInRight + RB.MARK);
      buildMarks(marksOut, beltOutLeft - RB.MARK * 2, W / 2 + RB.MARK);
    }
    function buildMarks(g, from, to) {
      while (g.firstChild) g.removeChild(g.firstChild);
      for (var x = from; x <= to; x += RB.MARK) svgEl(g, 'line', { x1: x, x2: x, y1: -6, y2: -2 });
    }

    // One frame ------------------------------------------------------------
    function draw(t) {
      var k = Math.floor(t / RB.CYCLE);
      var tc = t - k * RB.CYCLE;
      var pose = armPose(tc);
      var af = Math.max(0.3, Math.abs(pose.f));

      var off = (((t * RB.SPEED / 1000) % RB.MARK) + RB.MARK) % RB.MARK;
      marksIn.setAttribute('transform', 'translate(' + off + ' 0)');
      marksOut.setAttribute('transform', 'translate(' + off + ' 0)');
      var blink = Math.floor(t / 600) % 2;
      baseLed.setAttribute('fill-opacity', blink ? 0.35 : 1);
      baseLed2.setAttribute('fill-opacity', blink ? 1 : 0.35);

      placeSegment(lowerArm, 0, RB.SHOULDER_Y, pose.elbow.x, pose.elbow.y);
      placeJoint(shoulder, 0, RB.SHOULDER_Y, af);
      placeSegment(upperArm, pose.elbow.x, pose.elbow.y, pose.wrist.x, pose.wrist.y);
      placeJoint(elbow, pose.elbow.x, pose.elbow.y, af);
      placeJoint(wrist, pose.wrist.x, pose.wrist.y, af);

      var fo = 11 - 2 * pose.grip;
      fingerL.setAttribute('x', -fo - 1.5);
      fingerR.setAttribute('x', fo - 1.5);
      palmLed.setAttribute('fill-opacity', pose.grip > 0.5 ? 1 : 0.35);
      gripG.setAttribute('transform', 'translate(' + pose.wrist.x + ' ' + pose.wrist.y + ')');

      // Boxes: cycle j's box, u = ms since the start of its pick cycle.
      var held = false;
      for (var i = 0; i < boxes.length; i++) {
        var j = k - 1 + i;
        var u = t - j * RB.CYCLE;
        var x, bottom = RB.BELT_Y, show = true;
        if (u < 0) x = -RB.REACH + RB.SPEED * u / 1000;
        else if (u < 900) x = -RB.REACH;
        else if (u < 3500) { held = true; show = false; }
        else if (u < 4400) x = RB.REACH;
        else x = RB.REACH + RB.SPEED * (u - 4400) / 1000;
        if (show && (x < -W / 2 - 12 || x > W / 2 + 12)) show = false;
        boxes[i].style.display = show ? '' : 'none';
        if (show) boxes[i].setAttribute('transform', 'translate(' + x + ' ' + bottom + ')');
      }
      heldBox.style.display = held ? '' : 'none';      // bottom = wristY + 26
    }

    layout();
    var ro = 'ResizeObserver' in window ? new ResizeObserver(function () { layout(); draw(t); }) : null;
    if (ro) ro.observe(strip);

    // Clock: starts at -CYCLE + 1400 so the first box is already sliding in.
    var t = -RB.CYCLE + 1400;
    if (reduceMotion) { draw(0); return function () { if (ro) ro.disconnect(); }; }
    draw(t);

    var raf = 0, last = 0, running = false;
    function frame(now) {
      if (last) t += Math.min(64, now - last);          // no jump after a stall
      last = now;
      draw(t);
      raf = requestAnimationFrame(frame);
    }
    function setRunning(on) {
      if (on === running) return;
      running = on;
      last = 0;
      if (on) raf = requestAnimationFrame(frame); else cancelAnimationFrame(raf);
    }
    var io = 'IntersectionObserver' in window
      ? new IntersectionObserver(function (e) { setRunning(e[0].isIntersecting); })
      : null;
    if (io) io.observe(strip); else setRunning(true);

    return function () {
      setRunning(false);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
    };
  }

  /* ------------------------------------------------------------------------
     Why choose us — badge + card rise (useReveal), title word reveal, and the
     Old way / Baseline switch: sets data-mode (CSS does the flip) and counts
     the warning days between the two Figma values.
     ------------------------------------------------------------------------ */
  var WHY_DAYS = { old: 0, baseline: 14 };

  function whyChooseUs(section) {
    if (!section) return function () {};
    var card = section.querySelector('.why-compare');
    var count = card.querySelector('.why-count');
    var options = Array.prototype.slice.call(card.querySelectorAll('.why-option'));
    var raf = 0;

    function countTo(target) {
      cancelAnimationFrame(raf);
      var from = parseInt(count.textContent, 10) || 0;
      if (reduceMotion || from === target) { count.textContent = target; return; }
      var duration = cssMs('--why-count-duration');
      var start = performance.now();
      (function frame(now) {
        var k = Math.min(1, (now - start) / duration);
        count.textContent = Math.round(from + (target - from) * easeOutQuart(k));
        if (k < 1) raf = requestAnimationFrame(frame);
      })(start);
    }
    function setMode(mode) {
      if (card.dataset.mode === mode) return;
      card.dataset.mode = mode;
      options.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
      countTo(WHY_DAYS[mode]);
    }
    function onClick(e) { setMode(e.currentTarget.dataset.mode); }
    options.forEach(function (b) { b.addEventListener('click', onClick); });

    var stopReveal = useReveal(section, function () {});
    var stopHead = reduceMotion ? function () {} : wordReveal(section.querySelector('.why-head'));

    return function () {
      cancelAnimationFrame(raf);
      stopReveal();
      stopHead();
      options.forEach(function (b) { b.removeEventListener('click', onClick); });
    };
  }

  // Integrations: one-shot rise at 35% visible; carousel starts once fonts
  // are ready so the logo widths (and the gap) are measured correctly.
  var integrations = document.querySelector('.integrations');
  var stopInView = inView(integrations, cssMs('--inview-threshold'), function () {
    integrations.classList.add('is-in-view');
  });
  var stopFeatures = featuresSection(document.querySelector('.features'));
  var stopTrust = trustBadges(document.querySelector('.trust'));
  var stopSteps = howItWorks(document.querySelector('.how-it-works'));
  var stopWhy = whyChooseUs(document.querySelector('.why'));
  var stopTestimonials = testimonials(document.querySelector('.tm'));
  var stopPricing = pricing(document.querySelector('.pricing'));
  var stopFooter = footer(document.querySelector('.site-foot'));
  var stopRobot = robotDivider(document.querySelector('.robot-strip'));
  var stopCarousel = function () {};
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
    stopCarousel = logoCarousel(document.querySelector('.logo-row[data-carousel]'));
  });
  cursorSpotlight(hero, document.getElementById('grid-spot'));
  cursorSpotlight(document.querySelector('.how-it-works'), document.getElementById('hiw-spot'));
  cursorSpotlight(document.querySelector('.tm'), document.getElementById('tm-spot'));
  cursorSpotlight(document.querySelector('.foot-cta'), document.getElementById('foot-spot'));

  // Progress is measured on the untransformed stage and written straight to
  // the wrapper's inline transform — no transition, the scroll is the timeline.
  // Progress the mockup has with the page scrolled to the very top.
  function restingProgress() {
    var vh = window.innerHeight;
    var docTop = stage.getBoundingClientRect().top + window.scrollY;
    return (vh - docTop) / (vh * 0.88);
  }

  var stopReveal = scrollReveal(stage, function (p, inView) {
    var inv = 1 - p;
    reveal.style.transform =
      'translateY(' + (48 * inv) + 'px) scale(' + (0.84 + 0.16 * p) + ') rotateX(' + (20 * inv) + 'deg)';
    var rest = restingProgress();
    var resetAt = rest < RESET_AT ? RESET_AT : (rest + ACTIVATE_AT) / 2;
    if (!inView || p < resetAt) mockup.setActive(false);
    else if (p > ACTIVATE_AT) mockup.setActive(true);
  });

  window.addEventListener('pagehide', function (e) {
    if (e.persisted) return;                   // kept in bfcache: resume as-is
    stopReveal();
    stopLive();
    stopInView();
    stopCarousel();
    stopFeatures();
    stopTrust();
    stopSteps();
    stopWhy();
    stopTestimonials();
    stopPricing();
    stopFooter();
    stopMenu();
    stopRobot();
    mockup.destroy();
  });
})();
