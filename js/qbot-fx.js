/* qbot-fx.js
 * Screen-space effects for QBot's tour acts (js/qbot-acts.js): smoke, flames, sparks, confetti,
 * muzzle flashes, a paint-ball projectile, impact rings and a torch beam.
 *
 * One <canvas> fixed over the page (above the tour's dimmed backdrop, below QBot and the tooltip).
 * It only exists while something is on it: the frame loop stops and the canvas is hidden as soon as
 * the last particle fades, so the page pays nothing when QBot is not performing.
 * clear() removes everything at once; the acts call it whenever the tour step changes.
 * Everything is a no-op when the visitor prefers reduced motion.
 */
const QBotFX = (() => {
  const BRAND = { gold: "#FFB817", cream: "#FFF0C9", canvas: "#F6F2EA", ink: "#111214", green: "#9bb28a", coral: "#e98a6b", sky: "#7fb7e8" };
  const CONFETTI = [BRAND.gold, BRAND.cream, BRAND.green, BRAND.coral, BRAND.sky, "#ffffff"];
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const light = () => document.documentElement.dataset.theme === "light";
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  let cv = null,
    cx = null,
    dpr = 1,
    raf = 0,
    last = 0,
    parts = [],
    emitters = [],
    drawers = []; // per-frame painters (projectile, beam) that are not particles

  function ensure() {
    if (cv) return;
    cv = document.createElement("canvas");
    cv.className = "qbot-fx";
    cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
    cx = cv.getContext("2d");
    resize();
    addEventListener("resize", resize);
  }
  function resize() {
    if (!cv) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(innerWidth * dpr);
    cv.height = Math.round(innerHeight * dpr);
  }
  function wake() {
    ensure();
    cv.hidden = false;
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  /* ---------- particles ---------- */
  /* kind: smoke | fire | spark | confetti | ring | flash | star | puff */
  function spawn(kind, x, y, o = {}) {
    if (calm()) return null;
    const p = {
      kind,
      x,
      y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      ax: o.ax || 0,
      ay: o.ay != null ? o.ay : kind === "confetti" ? 520 : kind === "spark" ? 260 : kind === "smoke" || kind === "puff" ? -30 : 0,
      drag: o.drag != null ? o.drag : kind === "confetti" ? 1.6 : kind === "smoke" || kind === "puff" ? 2.2 : 1,
      life: o.life || { smoke: 1.1, puff: 0.7, fire: 0.38, spark: 0.55, confetti: 1.8, ring: 0.5, flash: 0.16, star: 0.7 }[kind] || 1,
      age: 0,
      size: o.size || { smoke: 10, puff: 9, fire: 9, spark: 2, confetti: 7, ring: 8, flash: 26, star: 6 }[kind] || 6,
      grow: o.grow != null ? o.grow : { smoke: 2.4, puff: 1.8, fire: -0.6, ring: 5, flash: 0.6 }[kind] || 0,
      color: o.color || null,
      rot: o.rot != null ? o.rot : rnd(0, TAU),
      vr: o.vr != null ? o.vr : rnd(-8, 8),
      alpha: o.alpha != null ? o.alpha : 1,
    };
    parts.push(p);
    wake();
    return p;
  }
  /* n particles flying out from x,y: speed [min,max] px/s, angle = direction in radians (screen, y down),
     spread = cone width in radians (TAU = all around) */
  function burst(kind, x, y, n, o = {}) {
    if (calm()) return;
    const [s0, s1] = o.speed || [60, 220],
      dir = o.angle != null ? o.angle : 0,
      spread = o.spread != null ? o.spread : TAU;
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-spread / 2, spread / 2),
        s = rnd(s0, s1);
      spawn(kind, x + rnd(-2, 2), y + rnd(-2, 2), {
        ...o,
        vx: Math.cos(a) * s + (o.vx || 0),
        vy: Math.sin(a) * s + (o.vy || 0),
        size: o.size ? rnd(o.size * 0.7, o.size * 1.3) : undefined,
        color: o.color || (kind === "confetti" ? CONFETTI[i % CONFETTI.length] : undefined),
      });
    }
  }
  /* call fn(dt, t) every frame until the returned stop() is called (e.g. rocket exhaust) */
  function emit(fn) {
    if (calm()) return () => {};
    const e = { fn, on: true, t: 0 };
    emitters.push(e);
    wake();
    return () => (e.on = false);
  }
  /* paint(cx, dt, t) every frame until stop(); used for the projectile and the torch beam */
  function paint(fn) {
    if (calm()) return () => {};
    const d = { fn, on: true, t: 0 };
    drawers.push(d);
    wake();
    return () => (d.on = false);
  }

  /* ---------- composed effects ---------- */
  /* a colourful cartoon paint-ball flying from `from` to `to` on a slight arc; resolves on impact */
  function projectile(from, to, { dur = 520, arc = 40 } = {}) {
    if (calm()) return Promise.resolve(to);
    return new Promise((done) => {
      let t = 0,
        lastPt = { ...from };
      const stop = paint((c, dt) => {
        t = Math.min(t + dt * 1000, dur);
        const k = t / dur,
          e = k, // straight speed reads better for a "shot"
          x = from.x + (to.x - from.x) * e,
          y = from.y + (to.y - from.y) * e - Math.sin(Math.PI * k) * arc;
        /* trail */
        for (let i = 0; i < 2; i++) spawn("spark", x, y, { vx: (lastPt.x - x) * 8 + rnd(-30, 30), vy: (lastPt.y - y) * 8 + rnd(-30, 30), color: CONFETTI[(Math.random() * 5) | 0], ay: 120, life: 0.35 });
        if (Math.random() < 0.6) spawn("puff", x, y, { size: 5, life: 0.45, alpha: 0.5 });
        lastPt = { x, y };
        /* the ball: gold with a cream swirl, spinning */
        const r = 7.5;
        c.save();
        c.translate(x, y);
        c.rotate(t / 60);
        c.fillStyle = BRAND.gold;
        c.beginPath();
        c.arc(0, 0, r, 0, TAU);
        c.fill();
        c.strokeStyle = BRAND.cream;
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(0, 0, r * 0.55, 0.3, 3.6);
        c.stroke();
        c.fillStyle = BRAND.coral;
        c.beginPath();
        c.arc(r * 0.35, -r * 0.35, 2, 0, TAU);
        c.fill();
        c.restore();
        if (t >= dur) {
          stop();
          done(to);
        }
      });
    });
  }
  /* cartoon impact: flash, ring, confetti and stars */
  function impact(x, y, scale = 1) {
    spawn("flash", x, y, { size: 22 * scale });
    spawn("ring", x, y, { size: 6 * scale, color: BRAND.gold });
    spawn("ring", x, y, { size: 3 * scale, color: BRAND.cream, life: 0.4, grow: 7 });
    burst("confetti", x, y, Math.round(26 * scale), { speed: [120, 320], angle: -Math.PI / 2, spread: Math.PI * 1.6 });
    burst("star", x, y, 6, { speed: [80, 170], color: BRAND.gold, ay: 200 });
  }
  function muzzle(x, y, angle) {
    spawn("flash", x, y, { size: 18 });
    burst("fire", x, y, 10, { speed: [60, 200], angle, spread: 0.7, life: 0.25 });
    burst("smoke", x, y, 8, { speed: [20, 90], angle, spread: 1.2, size: 8 });
    burst("spark", x, y, 8, { speed: [160, 320], angle, spread: 0.6, color: BRAND.gold });
  }
  /* soft light cone from a moving point to a target rectangle; returns stop() */
  function beam(from, to) {
    return paint((c) => {
      const a = from(),
        b = to();
      if (!a || !b) return;
      const ang = Math.atan2(b.y - a.y, b.x - a.x),
        len = Math.hypot(b.x - a.x, b.y - a.y),
        half = Math.max(18, (b.r || 40) * 0.9);
      const g = c.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, "rgba(255,240,201,0.55)");
      g.addColorStop(1, "rgba(255,184,23,0.07)");
      c.save();
      c.globalCompositeOperation = "lighter";
      c.fillStyle = g;
      c.translate(a.x, a.y);
      c.rotate(ang);
      c.beginPath();
      c.moveTo(0, -2);
      c.lineTo(len, -half);
      c.lineTo(len, half);
      c.lineTo(0, 2);
      c.closePath();
      c.fill();
      c.restore();
    });
  }

  /* ---------- frame loop ---------- */
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    emitters = emitters.filter((e) => e.on);
    emitters.forEach((e) => {
      e.t += dt;
      e.fn(dt, e.t);
    });
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => (p.age += dt) < p.life);
    for (const p of parts) step(p, dt);
    for (const p of parts) draw(p);
    drawers = drawers.filter((d) => d.on);
    drawers.forEach((d) => {
      d.t += dt;
      d.fn(cx, dt, d.t);
    });
    if (parts.length || emitters.length || drawers.length) raf = requestAnimationFrame(frame);
    else sleep();
  }
  function sleep() {
    raf = 0;
    if (!cv) return;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, cv.width, cv.height);
    cv.hidden = true;
  }
  function step(p, dt) {
    const f = Math.exp(-p.drag * dt);
    p.vx = (p.vx + p.ax * dt) * f;
    p.vy = (p.vy + p.ay * dt) * f;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  function draw(p) {
    const k = p.age / p.life,
      c = cx,
      size = Math.max(0.1, p.size * (1 + p.grow * k));
    c.save();
    switch (p.kind) {
      case "smoke":
      case "puff": {
        const col = light() ? "120,112,96" : "205,200,186";
        c.globalAlpha = p.alpha * (1 - k) * (p.kind === "puff" ? 0.75 : 0.55);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        g.addColorStop(0, `rgba(${col},0.9)`);
        g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g;
        c.beginPath();
        c.arc(p.x, p.y, size, 0, TAU);
        c.fill();
        break;
      }
      case "fire": {
        c.globalCompositeOperation = light() ? "source-over" : "lighter";
        c.globalAlpha = p.alpha * (1 - k);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        g.addColorStop(0, "rgba(255,250,220,1)");
        g.addColorStop(0.35, "rgba(255,200,60,0.95)");
        g.addColorStop(1, "rgba(255,120,30,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(p.x, p.y, size, 0, TAU);
        c.fill();
        break;
      }
      case "spark": {
        c.globalAlpha = p.alpha * (1 - k);
        c.strokeStyle = p.color || BRAND.gold;
        c.lineWidth = p.size;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        c.stroke();
        break;
      }
      case "confetti": {
        c.globalAlpha = p.alpha * Math.min(1, (1 - k) * 3);
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.scale(1, Math.cos(p.age * 9 + p.rot)); // flutter
        c.fillStyle = p.color || BRAND.gold;
        c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        break;
      }
      case "ring": {
        c.globalAlpha = p.alpha * (1 - k);
        c.strokeStyle = p.color || BRAND.gold;
        c.lineWidth = 3 * (1 - k) + 0.5;
        c.beginPath();
        c.arc(p.x, p.y, size * 2, 0, TAU);
        c.stroke();
        break;
      }
      case "flash": {
        c.globalCompositeOperation = light() ? "source-over" : "lighter";
        c.globalAlpha = p.alpha * (1 - k);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        g.addColorStop(0, "rgba(255,255,240,1)");
        g.addColorStop(0.4, "rgba(255,210,90,0.8)");
        g.addColorStop(1, "rgba(255,184,23,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(p.x, p.y, size, 0, TAU);
        c.fill();
        break;
      }
      case "star": {
        c.globalAlpha = p.alpha * (1 - k);
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.color || BRAND.gold;
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? size * 0.45 : size,
            a = (i / 10) * TAU - Math.PI / 2;
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
        c.fill();
        break;
      }
    }
    c.restore();
  }

  /* remove everything now (tour step changed, tour ended) */
  function clear() {
    parts = [];
    emitters.forEach((e) => (e.on = false));
    drawers.forEach((d) => (d.on = false));
    emitters = [];
    drawers = [];
    if (raf) cancelAnimationFrame(raf);
    sleep();
  }

  return { spawn, burst, emit, paint, projectile, impact, muzzle, beam, clear, BRAND, CONFETTI, get active() { return parts.length + emitters.length + drawers.length; } };
})();
