/* qbot-acts.js
 * QBot's tour choreography: every tour step names an act (STEPS[].act in js/tour.js) and QBot
 * performs it on the step's real target element, wherever that element is on the screen.
 *
 *   ACTS        one entry per act, edit / add here:
 *                 travel(ctx, dest)  optional: how QBot gets to his spot (default: the normal flight)
 *                 perform(ctx)       what he does once the tooltip shows; may run as long as it likes
 *                 aim(ctx)           optional: re-aim after a resize / scroll (pointing acts)
 *   begin(step)  called by the tour when a step starts: stops the previous act at once
 *   travel(dest) / perform()  called by the tour for the current step
 *   stop()       tour ended or skipped: everything is cleaned up and QBot is handed back
 *
 * Cancelling: every begin() / stop() bumps a run token. An act's waits and tweens throw as soon as
 * their token is stale, so an old act can never keep going in a new step; its repeating motions,
 * props, frame callbacks and screen effects are all removed in cancel().
 *
 * Aiming is real 3D: a screen direction is turned into a world direction with the camera's
 * right / up axes, and the shoulder (or prop) rotation that lines the arm up with it is solved with
 * quaternions, then written into the Rig's normal joint channels. So QBot points at the actual
 * element on any screen size, and the Rig's easing makes every change of pose smooth.
 *
 * Needs: js/mascot3d.js (the Rig), js/qbot-props.js, js/qbot-fx.js; flyTo / setGuide from js/robot.js.
 */
const QBotActs = (() => {
  const DEG = 180 / Math.PI;
  const CANCEL = Symbol("cancelled");
  const guideEl = document.getElementById("guide");
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rig = () => (window.qpMascot && qpMascot.guide) || null;
  const ready = () => !!(rig() && rig().ready);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  let run = 0,
    step = null,
    ctx = null,
    tickers = [],
    cleanups = [],
    raf = 0,
    last = 0;

  /* ---------- one shared frame loop for props that animate (flames, tweens) ---------- */
  function addTicker(fn) {
    const t = { fn, on: true };
    tickers.push(t);
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    return () => (t.on = false);
  }
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tickers = tickers.filter((t) => t.on);
    tickers.forEach((t) => t.on && t.fn(dt, now / 1000));
    if (ready()) rig().render();
    raf = tickers.length ? requestAnimationFrame(loop) : 0;
  }

  /* ---------- 3D helpers ---------- */
  const T = (r) => ({ V: r.root.position.constructor, Q: r.root.quaternion.constructor, E: r.root.rotation.constructor });
  /* evaluate fn with every joint already at the pose it is easing towards */
  function atTarget(r, fn) {
    const chans = Object.values(r.ch);
    chans.forEach((c) => c.set(c.to));
    r.scene.updateMatrixWorld(true);
    try {
      return fn();
    } finally {
      chans.forEach((c) => c.set(c.out != null ? c.out : c.v));
      r.scene.updateMatrixWorld(true);
    }
  }
  function screenOf(r, world) {
    const v = world.clone().project(r.scene.camera),
      b = r.viewer.getBoundingClientRect();
    return { x: b.left + ((v.x + 1) / 2) * b.width, y: b.top + ((1 - v.y) / 2) * b.height };
  }
  /* world direction for a screen direction (from -> to), leaning `toCam` towards the viewer */
  function worldDir(r, from, to, toCam = 0.15) {
    const { V } = T(r),
      e = r.scene.camera.matrixWorld.elements;
    const dx = to.x - from.x,
      dy = to.y - from.y,
      len = Math.hypot(dx, dy) || 1;
    return new V(e[0], e[1], e[2])
      .multiplyScalar(dx / len)
      .add(new V(e[4], e[5], e[6]).multiplyScalar(-dy / len))
      .add(new V(e[8], e[9], e[10]).multiplyScalar(toCam))
      .normalize();
  }
  /* local rotation for `obj` so that its own vector `local` points along world `dir` */
  function alignLocal(r, obj, local, dir) {
    const { Q } = T(r);
    const parentQ = obj.parent.getWorldQuaternion(new Q());
    const d = dir.clone().applyQuaternion(parentQ.invert()).normalize();
    return new Q().setFromUnitVectors(local.clone().normalize(), d);
  }
  /* fingertip of the pointing hand, in the wrist's space (farthest vertex from the wrist) */
  const tipCache = {};
  function fingertip(r, side) {
    if (tipCache[side]) return tipCache[side].clone();
    const { V } = T(r),
      hand = r.node("handPoint" + side),
      pos = hand.geometry.attributes.position,
      v = new V();
    hand.updateMatrix();
    let best = null,
      bd = -1;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(hand.matrix);
      const d = v.length();
      if (d > bd) (bd = d), (best = v.clone());
    }
    tipCache[side] = best;
    return best.clone();
  }

  /* ---------- body language ---------- */
  /* The arm's allowed screen angles (degrees, y down): each arm stays on its own side and never goes
     straight up, where it would vanish behind QBot's big head (at most ~60° above level). */
  function armAngle(side, a) {
    if (side === "R" && a > -122 && a < 100) return a < -16 ? -122 : 100;
    if (side === "L" && (a < -58 || a > 80)) return a < 0 || a > 170 ? -58 : 80;
    return a;
  }
  /* point (or reach) one arm along a screen direction or towards a world point. hand: Point | Open | Grip */
  function aimArm(r, side, { screen, world, hand = "Point", toCam = 0.15, speed = 9, bend = -8, wrist = 38 } = {}) {
    if (!r || !r.ready) return;
    const { V, E } = T(r);
    r.hand(side, hand);
    r.nudge({ [`elbow${side}.x`]: bend, [`elbow${side}.y`]: 0, [`elbow${side}.z`]: 0, [`wrist${side}.x`]: wrist, [`wrist${side}.y`]: 0, [`wrist${side}.z`]: 0 }, speed);
    const sh = r.node("shoulder" + side),
      wr = r.node("wrist" + side);
    const { Q } = T(r);
    const q = atTarget(r, () => {
      /* the arm's own vector (shoulder -> fingertip), in the shoulder's space */
      const tipW = wr.localToWorld(fingertip(r, side));
      const v = sh.worldToLocal(tipW.clone()).normalize();
      const shW = sh.getWorldPosition(new V());
      let aimAt = screen;
      if (screen) {
        /* the eyes look right at the target; the arm points as close to it as it can (armAngle) */
        const s = screenOf(r, shW);
        const a = (armAngle(side, (Math.atan2(screen.y - s.y, screen.x - s.x) * 180) / Math.PI) * Math.PI) / 180;
        aimAt = { x: s.x + Math.cos(a) * 100, y: s.y + Math.sin(a) * 100 };
      }
      const dir = world ? world.clone().sub(shW).normalize() : worldDir(r, screenOf(r, shW), aimAt, toCam);
      const d = dir.applyQuaternion(sh.parent.getWorldQuaternion(new Q()).invert()).normalize();
      /* 1. swing the arm out sideways in the body's front plane (like a person raising an arm), so a
            target overhead never flips the arm forward over the head ... */
      const a0 = Math.atan2(v.y, v.x),
        a1 = Math.atan2(d.y, d.x),
        TAU = Math.PI * 2,
        mod = (a) => ((a % TAU) + TAU) % TAU;
      let roll = side === "L" ? mod(a1 - a0) : -mod(a0 - a1); // L swings out towards +x, R towards -x
      if (Math.abs(roll) > TAU * 0.875) roll -= Math.sign(roll) * TAU; // target a little inwards: short way
      const qRoll = new Q().setFromAxisAngle(new V(0, 0, 1), roll);
      /* 2. ... then the small remaining turn (towards / away from the viewer) */
      return new Q().setFromUnitVectors(v.clone().applyQuaternion(qRoll), d).multiply(qRoll);
    });
    const e = new E().setFromQuaternion(q, "XYZ");
    r.nudge({ [`shoulder${side}.x`]: e.x * DEG, [`shoulder${side}.y`]: e.y * DEG, [`shoulder${side}.z`]: e.z * DEG }, speed);
  }
  /* head, neck, eyes (and a little of the body) towards a point on the screen */
  function lookAt(r, p, { speed = 8, turn = 0 } = {}) {
    if (!r || !r.ready || !p) return;
    const h = atTarget(r, () => r.toScreen(r.node("head"), [0, 0.13, 0.05]));
    const dx = p.x - h.x,
      dy = p.y - h.y,
      len = Math.hypot(dx, dy) || 1,
      nx = dx / len,
      ny = dy / len;
    /* the camera already sees QBot a little from his right, so turning to the right shows his face less:
       keep rightward looks smaller, or he ends up in profile */
    const k = nx > 0 ? 0.6 : 1;
    const v = { "head.y": nx * 22 * k, "head.x": ny * 15, "head.z": -nx * 5, "neck.y": nx * 6 * k, "neck.x": ny * 3 };
    if (turn) v.turn = nx * turn * k;
    r.nudge(v, speed);
    r.gaze(nx, ny, 1, true); // smiling, closed eyes, turned towards it
  }
  const center = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height, b };
  };
  /* nearest point of a box to p (so QBot points at the edge he can "touch") */
  function nearest(el, p, inset = 10) {
    const b = el.getBoundingClientRect();
    return { x: clamp(p.x, b.left + inset, b.right - inset), y: clamp(p.y, b.top + inset, b.bottom - inset) };
  }
  const meCenter = () => {
    const b = guideEl.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height * 0.42 };
  };
  const tipEl = document.getElementById("tip");
  const tipRect = () => (tipEl && tipEl.classList.contains("on") ? tipEl.getBoundingClientRect() : null);
  const overlap = (a, b, m = 0) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
  /* does the line a -> b pass through rectangle R (grown by m)? */
  function crosses(a, b, R, m = 4) {
    for (let i = 1; i <= 12; i++) {
      const x = a.x + ((b.x - a.x) * i) / 12,
        y = a.y + ((b.y - a.y) * i) / 12;
      if (x > R.left - m && x < R.right + m && y > R.top - m && y < R.bottom + m) return true;
    }
    return false;
  }
  /* Where QBot's body, shoulders and reach are on the page when his tour box (#guide) is at x, y.
     QBot is drawn a little beyond the box (head and arms): measured once in his rest pose at the
     desktop box size, scaled with the box (smaller on phones), plus a few px for arm movements. */
  function body(x, y) {
    const w = guideEl.offsetWidth,
      h = guideEl.offsetHeight,
      k = h / 135,
      cx = x + w / 2;
    return {
      drawn: { left: cx - 48 * k, right: cx + 48 * k, top: y - 26 * k, bottom: y + h + 6 * k },
      sh: { R: { x: cx - 19 * k, y: y + 50 * k }, L: { x: cx + 16 * k, y: y + 49 * k } },
      reach: 50 * k,
    };
  }
  const bodyNow = () => {
    const b = guideEl.getBoundingClientRect();
    return body(b.left, b.top);
  };
  /* The better arm for pointing at p: as close to p's direction as armAngle allows, not hidden behind
     the tooltip, and staying on screen. Returns { side, err (degrees off), hidden } */
  function armPlan(bd, p, tip) {
    let best = null;
    for (const side of ["R", "L"]) {
      const s = bd.sh[side],
        want = (Math.atan2(p.y - s.y, p.x - s.x) * 180) / Math.PI,
        got = armAngle(side, want),
        err = Math.abs(((want - got + 540) % 360) - 180);
      const end = { x: s.x + Math.cos((got * Math.PI) / 180) * bd.reach, y: s.y + Math.sin((got * Math.PI) / 180) * bd.reach };
      const hidden = !!tip && crosses(s, end, tip);
      const off = end.x < 0 || end.x > innerWidth || end.y < 0;
      const cost = err + (hidden ? 1000 : 0) + (off ? 500 : 0);
      if (!best || cost < best.cost) best = { side, err, hidden: hidden || off, cost };
    }
    return best;
  }
  /* the arm the tooltip is NOT covering (for gestures that are not aimed, like the hello wave) */
  function freeSide() {
    const t = tipRect();
    if (!t) return "L";
    return t.left + t.width / 2 > meCenter().x ? "R" : "L";
  }
  /* which arm reaches for p from where QBot stands now */
  const sideFor = (p) => armPlan(bodyNow(), p, tipRect()).side;

  /* ---------- staging: where QBot stands for a step ----------
     The tour puts QBot beside the tooltip. That spot is kept whenever he can point at the target from
     it: whole body on screen, the pointing arm not hidden behind the tooltip, and the target within the
     arm's comfortable angles. Otherwise he walks (flies) to the nearest spot that has all of that and
     covers neither the tooltip nor the highlighted element. The tooltip and spotlight never move.
     If no such spot exists (small phones), he stays by the tooltip, nudged so his whole body is on screen. */
  function onScreen(p) {
    const d = body(p.x, p.y).drawn,
      m = 4 + 12 * (guideEl.offsetHeight / 135); // room for a turned body / held prop
    return {
      x: p.x + Math.max(0, m - d.left) - Math.max(0, d.right - (innerWidth - m)),
      y: p.y + Math.max(0, 4 - d.top) - Math.max(0, d.bottom - (innerHeight - 4)),
    };
  }
  /* an act's own sideways nudge (shiftX, in px at desktop size, scaled with QBot); acts without one stay put */
  function shifted(p, a) {
    if (!a || !a.shiftX) return p;
    return { x: p.x + a.shiftX * (guideEl.offsetHeight / 135), y: p.y };
  }
  function stage(dest, L) {
    const s = step,
      a = s && ACTS[s.act];
    if (!s || !s.target || (a && a.stage === false) || !L) return onScreen(dest);
    const el = document.querySelector(s.target);
    if (!el) return onScreen(dest);
    const tb = el.getBoundingClientRect(),
      vw = innerWidth,
      vh = innerHeight,
      w = guideEl.offsetWidth,
      h = guideEl.offsetHeight;
    const tip = L.t ? { left: L.t.x, top: L.t.y, right: L.t.x + tipEl.offsetWidth, bottom: L.t.y + tipEl.offsetHeight } : null;
    const spotR = L.r || null;
    const score = (x, y, isDefault) => {
      const bd = body(x, y),
        d = bd.drawn;
      if (d.left < 2 || d.right > vw - 2 || d.top < 2 || d.bottom > vh - 2) return null; // whole body on screen
      if (!isDefault && ((tip && overlap(d, tip, 8)) || (spotR && overlap(d, spotR, 6)))) return null;
      const c = { x: (bd.sh.R.x + bd.sh.L.x) / 2, y: bd.sh.R.y },
        p = { x: clamp(c.x, tb.left + 10, tb.right - 10), y: clamp(c.y, tb.top + 10, tb.bottom - 10) };
      const dist = Math.hypot(p.x - c.x, p.y - c.y),
        ang = Math.atan2(p.y - c.y, p.x - c.x);
      const s = Math.sin(ang);
      if (s > 0.42 || s < -0.72) return null; // pointing more than ~25° down reads as a hanging arm; up to ~45° up is fine
      const plan = armPlan(bd, p, tip);
      if (plan.hidden || plan.err > 18) return null;
      return Math.abs(dist - 190) * 0.5 + Math.abs(Math.sin(ang)) * 30 + plan.err * 2 + Math.hypot(x - dest.x, y - dest.y) * 0.35;
    };
    if (score(dest.x, dest.y, true) != null) return dest;
    let best = null;
    const stepPx = Math.max(16, Math.round(w / 3));
    for (let y = 8; y <= vh - h - 8; y += stepPx)
      for (let x = 8; x <= vw - w - 8; x += stepPx) {
        const sc = score(x, y, false);
        if (sc != null && (!best || sc < best.sc)) best = { x, y, sc };
      }
    return best ? { x: best.x, y: best.y } : onScreen(dest);
  }
  /* the brand-sheet wave, on either arm ("L" is QBot's own left = the screen's right) */
  const WAVE = {
    L: { waist: [0, 0, -4], head: [-4, 0, 9], shoulderL: [-71, -20, 60], elbowL: [-47, 0, 0], shoulderR: [8, 0, -16], hipR: [0, 0, -5] },
    R: { waist: [0, 0, 4], head: [-4, 0, -9], shoulderR: [-71, 20, -60], elbowR: [-47, 0, 0], shoulderL: [8, 0, 16], hipL: [0, 0, 5] },
  };
  /* short WAAPI wiggle on a page element (bell, gear) - removed again when it ends */
  function jiggle(el, deg = 14) {
    if (!el || calm()) return;
    el.animate(
      [{ transform: "none" }, { transform: `rotate(${-deg}deg) scale(1.12)` }, { transform: `rotate(${deg * 0.8}deg)` }, { transform: `rotate(${-deg * 0.4}deg)` }, { transform: "none" }],
      { duration: 520, easing: "ease-out" },
    );
  }

  /* ---------- the act context ---------- */
  function makeCtx(s, token) {
    const alive = () => token === run;
    const c = {
      step: s,
      fx: QBotFX,
      get rig() {
        return rig();
      },
      el: s && s.target ? document.querySelector(s.target) : null,
      alive,
      aimer: null, // set by pointing acts; re-run on resize / scroll
      async wait(ms) {
        await new Promise((res) => setTimeout(res, ms));
        if (!alive()) throw CANCEL;
      },
      tick(fn) {
        const stop = addTicker(fn);
        cleanups.push(stop);
        return stop;
      },
      tween(ms, fn, ease = easeInOut) {
        return new Promise((res, rej) => {
          if (calm()) ms = 1;
          let t = 0;
          const stop = c.tick((dt) => {
            if (!alive()) return stop(), rej(CANCEL);
            t = Math.min(1, t + (dt * 1000) / ms);
            fn(ease(t), t);
            if (t >= 1) stop(), res();
          });
        });
      },
      cleanup(fn) {
        cleanups.push(fn);
      },
      wiggle(...a) {
        const r = rig();
        return r && r.ready ? r.wiggle(...a) : () => {};
      },
      target() {
        return center(c.el);
      },
    };
    return c;
  }

  /* ---------- shared moves ---------- */
  async function pointAt(c, p, { hand = "Point", turn = 14, hold = true, speed = 8 } = {}) {
    const r = c.rig;
    if (!r || !r.ready || !p) return;
    const side = sideFor(p),
      other = side === "R" ? "L" : "R";
    const dir = Math.sign(p.x - meCenter().x) || 1;
    r.pose({ turn: dir * turn * (dir > 0 ? 0.6 : 1), waist: [0, 0, side === "R" ? 4 : -4] }, speed); // rightward turns kept small (see lookAt)
    r.hand(other, "");
    lookAt(r, p, { speed });
    aimArm(r, side, { screen: p, hand, speed });
    if (hold) c.aimer = () => (lookAt(r, p, { speed: 14 }), aimArm(r, side, { screen: p, hand, speed: 14 }));
    return side;
  }
  async function hop(c, { height = 0.16, spin = 0, crouch = 150 } = {}) {
    const r = c.rig;
    r.pose("crouch", 18);
    await c.wait(crouch);
    r.nudge({ up: height, turn: (r.ch.turn.to || 0) + spin }, 10);
    await c.wait(300);
    r.nudge({ up: 0 }, 9);
    await c.wait(260);
    if (spin) {
      /* a full turn ends where it started: take the 360 back off without moving */
      r.ch.turn.v -= spin;
      r.ch.turn.to -= spin;
    }
  }
  /* the prop's screen point (e.g. the muzzle) */
  const propPoint = (r, prop, local) => r.toScreen(prop, local);
  /* The model's own hammer sits in the fist the way a hammer is held (handle across the fist), but
     flipped: the head is on the wrong end, so it hangs head-down. Turn it 180° about the hand's own
     axis, through the grip: the handle stays on the same line through the fist, and the head comes
     out on top. Returns a function that puts it back exactly as it was. */
  function holdHammer(r, side) {
    const hm = r.node("hammer" + side),
      grip = hm && hm.children.find((o) => /_1$/.test(o.name));
    if (!grip) return () => {};
    const { V } = T(r);
    const p0 = hm.position.clone(),
      q0 = hm.quaternion.clone();
    grip.geometry.computeBoundingBox();
    grip.updateMatrix();
    const g = grip.geometry.boundingBox.getCenter(new V()).applyMatrix4(grip.matrix), // grip centre, in the hammer's own space
      hand = fingertip(r, side).clone().normalize(); // the hand's axis (wrist space = the hammer's space)
    const q = hm.quaternion.clone().setFromAxisAngle(hand, Math.PI);
    hm.quaternion.copy(q);
    hm.position.copy(g.clone().sub(g.clone().applyQuaternion(q))); // the grip stays in the fist
    r.render();
    return () => {
      hm.position.copy(p0);
      hm.quaternion.copy(q0);
    };
  }

  /* =====================================================================
     ACTS (one per tour step; the step's `act` picks it)
     ===================================================================== */
  const ACTS = {
    /* Step 1: big hello - wave (with the arm the tooltip does not hide), a hop with a spin, keep waving */
    hello: {
      async perform(c) {
        const r = c.rig;
        const side = freeSide(),
          s = side === "L" ? 1 : -1;
        r.hand(side, "Open");
        r.look("excited");
        r.pose(WAVE[side], 11);
        c.wiggle(`shoulder${side}.z`, 13 * s, 2.5);
        c.wiggle("head.z", 3, 1.25);
        c.wiggle("leaf.x", 14, 2.5);
        await c.wait(1100);
        r.stopAll();
        await hop(c, { height: 0.2, spin: 360 });
        const m = meCenter();
        c.fx.burst("confetti", m.x, m.y - 50, 18, { speed: [90, 240], angle: -Math.PI / 2, spread: Math.PI });
        r.look("happy");
        r.hand(side, "Open");
        r.pose(WAVE[side], 9);
        c.wiggle(`shoulder${side}.z`, 10 * s, 1.6);
        c.wiggle("leaf.x", 8, 1.6);
      },
    },

    /* generic: turn to the target, look at it and point at it */
    point: {
      async perform(c) {
        const t = c.target();
        if (!t) return;
        const p = nearest(c.el, meCenter(), 16);
        await pointAt(c, p);
        await c.wait(650);
        c.fx.spawn("ring", p.x, p.y, { size: 7 });
        c.wiggle("elbowR.x", 4, 1.4);
        c.wiggle("elbowL.x", 4, 1.4);
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 2 (ask anything): point at the box, then "listen" with a nod */
    ask: {
      async perform(c) {
        const r = c.rig;
        const p = nearest(c.el, meCenter(), 30);
        await pointAt(c, p);
        await c.wait(700);
        c.fx.spawn("ring", p.x, p.y, { size: 7 });
        await c.wait(500);
        r.nudge({ "head.x": (r.ch["head.x"].to || 0) + 12 }, 16); // nod
        await c.wait(180);
        lookAt(r, p, { speed: 10 });
        c.wiggle("leaf.x", 9, 0.9);
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 3 (suggestions): tap each suggestion chip in turn, a ring pops on each */
    tap: {
      async perform(c) {
        const r = c.rig;
        const chips = c.el ? [...c.el.querySelectorAll("button")].filter((b) => b.offsetWidth) : [];
        if (!chips.length) return ACTS.point.perform(c);
        for (let round = 0; round < 2; round++)
          for (const chip of chips) {
            const p = center(chip);
            await pointAt(c, p, { speed: 12, hold: false });
            await c.wait(330);
            const side = sideFor(p);
            r.nudge({ [`elbow${side}.x`]: -24 }, 22); // tap!
            await c.wait(110);
            r.nudge({ [`elbow${side}.x`]: -8 }, 18);
            c.fx.spawn("ring", p.x, p.y, { size: 6 });
            c.fx.burst("spark", p.x, p.y, 5, { speed: [60, 140], color: QBotFX.BRAND.gold });
            await c.wait(160);
          }
        const mid = center(chips[Math.floor(chips.length / 2)]);
        await pointAt(c, mid);
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 4 (navigation): turn to the menu, sweep down it with eyes and finger, then hold the point */
    nav: {
      async perform(c) {
        const r = c.rig;
        const items = c.el ? [...c.el.querySelectorAll("button")].filter((b) => b.offsetHeight) : [];
        const t = c.target();
        if (!t) return;
        const first = items.length ? center(items[0]) : { x: t.x, y: t.b.top + 20 },
          lastI = items.length ? center(items[items.length - 1]) : { x: t.x, y: t.b.bottom - 20 };
        const edge = (p) => ({ x: t.b.right - 14, y: p.y });
        r.look("curious");
        await c.wait(250);
        await pointAt(c, edge(first), { turn: 34, speed: 7 });
        await c.wait(650);
        /* sweep down the menu */
        await c.tween(1100, (k) => {
          const p = edge({ y: lerp(first.y, lastI.y, k) });
          lookAt(r, p, { speed: 16 });
          aimArm(r, sideFor(p), { screen: p, speed: 16 });
        });
        const mid = edge({ y: (first.y + lastI.y) / 2 });
        await pointAt(c, mid, { turn: 34, speed: 6 });
        c.fx.spawn("ring", mid.x, mid.y, { size: 7 });
        c.wiggle("leaf.x", 8, 1.2);
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 5 (quick links, "make them your own"): out comes QBot's own welding torch, sparks fly */
    tinker: {
      async perform(c) {
        const r = c.rig;
        const p = nearest(c.el, meCenter(), 14);
        const side = sideFor(p);
        lookAt(r, p, { turn: 26 });
        aimArm(r, side, { screen: p, hand: "Grip", toCam: 0.25, bend: -20 });
        QBotProps.show(r, "torch" + side);
        r.look("calm"); // squinting at the sparks
        await c.wait(600);
        const stop = c.fx.emit(() => {
          if (Math.random() < 0.7) c.fx.burst("spark", p.x, p.y, 2, { speed: [90, 260], angle: -Math.PI / 2, spread: Math.PI * 1.4, color: Math.random() < 0.5 ? "#fff3c4" : QBotFX.BRAND.gold });
          if (Math.random() < 0.25) c.fx.spawn("flash", p.x, p.y, { size: rnd(8, 14), life: 0.08 });
        });
        c.wiggle(`shoulder${side}.x`, 3, 3.2);
        await c.wait(1500);
        stop();
        r.stopAll();
        c.fx.burst("puff", p.x, p.y, 4, { speed: [10, 40] });
        QBotProps.hideAll(r);
        r.look("happy");
        await pointAt(c, p, { hand: "Point" });
        r.nudge({ [`wrist${side}.z`]: side === "R" ? 25 : -25 }, 6); // a proud little flourish
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 6 (notifications): ding the bell with QBot's hammer */
    bell: {
      shiftX: -36, // px at desktop size: a bit further left, so the raised hammer clears the tooltip
      async perform(c) {
        const r = c.rig;
        const p = c.target();
        if (!p) return;
        const side = sideFor(p);
        lookAt(r, p, { turn: 20 });
        QBotProps.show(r, "hammer" + side);
        c.cleanup(holdHammer(r, side)); // the right way up
        aimArm(r, side, { screen: { x: p.x, y: p.y - 60 }, hand: "Grip", bend: -50, speed: 8 });
        await c.wait(500);
        for (let i = 0; i < 3; i++) {
          aimArm(r, side, { screen: { x: p.x, y: p.y + 30 }, hand: "Grip", bend: -10, speed: 26 }); // strike
          await c.wait(120);
          c.fx.spawn("ring", p.x, p.y, { size: 6 });
          c.fx.spawn("ring", p.x, p.y, { size: 3, color: QBotFX.BRAND.cream, grow: 8, life: 0.45 });
          c.fx.burst("star", p.x, p.y, 3, { speed: [70, 130], ay: 160 });
          jiggle(document.getElementById("notif-btn"), 16);
          aimArm(r, side, { screen: { x: p.x, y: p.y - 60 }, hand: "Grip", bend: -50, speed: 14 }); // back up
          await c.wait(380);
        }
        QBotProps.hideAll(r);
        await pointAt(c, nearest(c.el, meCenter(), 6));
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 7 (profile): a smart salute, then an open-hand "this is you" */
    salute: {
      async perform(c) {
        const r = c.rig;
        const p = c.target();
        if (!p) return;
        lookAt(r, p, { turn: 18 });
        r.hand("R", "Open");
        /* hand up beside the visor and in front of it - never inside the head, on the way up included
           (checked against the head's shape) */
        r.nudge({ "shoulderR.x": -55, "shoulderR.y": 0, "shoulderR.z": -92, "elbowR.x": -45, "elbowR.y": 0, "elbowR.z": 0, "wristR.x": 0 }, 10);
        r.look("happy");
        await c.wait(900);
        await pointAt(c, nearest(c.el, meCenter(), 8), { hand: "Open" });
        c.fx.burst("star", p.x, p.y, 7, { speed: [50, 120], ay: 60, life: 0.9 });
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 8 (settings): the oversized cartoon bazooka */
    bazooka: {
      async perform(c) {
        const r = c.rig;
        const t = c.target();
        if (!t) return;
        const right = t.x >= meCenter().x;
        const side = right ? "R" : "L"; // the shoulder nearest the camera once he turns
        const sx = side === "R" ? -1 : 1;
        /* intro: a mischievous look at the viewer */
        r.look("calm");
        r.pose({ head: [-6, 0, 10], waist: [0, 0, -3] }, 9);
        await c.wait(450);
        /* turn side-on and pull it out with a pop */
        r.look("dots");
        r.pose({ turn: right ? 62 : -62, waist: [-4, 0, 0] }, 8);
        const chest = r.node("chest");
        const baz = QBotProps.show(r, "bazooka", chest, { p: [sx * 0.15, 0.11, 0.0], s: 0.01 });
        const at = propPoint(r, baz, [0, 0, 0]);
        if (at) c.fx.burst("puff", at.x, at.y, 6, { speed: [20, 70] });
        await c.tween(380, (k) => baz.scale.setScalar(Math.max(0.01, easeOutBack(k))), (x) => x);
        /* aim at the gear: barrel (+Z) along the screen direction from the muzzle to the target */
        const { Q, V } = T(r);
        const qFrom = baz.quaternion.clone();
        const aimQ = () =>
          atTarget(r, () => {
            const m = baz.localToWorld(new V(0, 0, 0));
            return alignLocal(r, baz, new V(0, 0, 1), worldDir(r, screenOf(r, m), c.target(), 0.08));
          });
        const qTo = aimQ();
        /* hands on the grips */
        const grip = (z, y) => baz.localToWorld(new V(0, y, z));
        const holdGrips = (speed) => {
          const far = side === "R" ? "L" : "R";
          aimArm(r, side, { world: atTarget(r, () => grip(-0.06, -0.12)), hand: "Grip", bend: -30, speed });
          aimArm(r, far, { world: atTarget(r, () => grip(0.14, -0.11)), hand: "Grip", bend: -20, speed });
        };
        lookAt(r, c.target(), { speed: 8 });
        await c.tween(420, (k) => baz.quaternion.copy(qFrom).slerp(qTo, k));
        holdGrips(9);
        await c.wait(550);
        /* FIRE: flash, smoke, recoil, the shot */
        r.look("excited");
        const muzzle = propPoint(r, baz, baz.userData.muzzle);
        const tc = c.target();
        const ang = Math.atan2(tc.y - muzzle.y, tc.x - muzzle.x);
        c.fx.muzzle(muzzle.x, muzzle.y, ang);
        c.fx.burst("smoke", propPoint(r, baz, [0, 0, -0.42]).x, propPoint(r, baz, [0, 0, -0.42]).y, 7, { speed: [20, 80], angle: ang + Math.PI, spread: 1.4 }); // back-blast
        r.viewer.animate([{ transform: "none" }, { transform: `translate(${-Math.cos(ang) * 9}px, ${-Math.sin(ang) * 9}px)` }, { transform: "none" }], { duration: 300, easing: "ease-out" });
        const z0 = baz.position.clone();
        const kick = new V(0, 0, -0.07).applyQuaternion(baz.quaternion);
        c.tween(260, (k) => baz.position.copy(z0).addScaledVector(kick, Math.sin(Math.PI * k))).catch(() => {});
        r.nudge({ "waist.x": -12 }, 22);
        await c.fx.projectile(muzzle, tc, { dur: 480, arc: 26 });
        if (!c.alive()) return;
        c.fx.impact(tc.x, tc.y, 1);
        jiggle(c.el, 22);
        /* celebrate the hit, then put it away */
        r.nudge({ "waist.x": 0 }, 9);
        r.look("happy");
        await c.wait(650);
        const out = propPoint(r, baz, [0, 0, 0]);
        await c.tween(260, (k) => baz.scale.setScalar(Math.max(0.01, 1 - k)));
        if (out) c.fx.burst("puff", out.x, out.y, 6, { speed: [20, 70] });
        QBotProps.hideAll(r);
        await pointAt(c, nearest(c.el, meCenter(), 6), { turn: 20 });
        c.wiggle("leaf.x", 10, 1.4);
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 9 (news): hop on a rocket and blast off to the news.
       He mounts it and fires it up where he stands (by the Settings icon), and only when he takes off
       does the page start scrolling to the news - scroll = { from, to } (js/tour.js), moved in step
       with his flight */
    rocket: {
      ridesScroll: true,
      async travel(c, dest, scroll) {
        const r = c.rig;
        const from = { x: pos.x, y: pos.y };
        const dx = dest.x - from.x,
          dy = dest.y - from.y,
          dist = Math.hypot(dx, dy);
        const scrollAlong = (k) => scroll && scrollTo({ top: lerp(scroll.from, scroll.to, k), behavior: "instant" });
        if (dist < 30 && !scroll) return flyTo(dest.x, dest.y);
        const dirX = dx >= 0 ? 1 : -1;
        const tilt = clamp(Math.atan2(dy, Math.abs(dx)), -0.6, 0.6); // nose up / down a bit
        const { V, Q } = T(r);
        const root = r.root;
        /* 1. the rocket pops up in front of him */
        r.pose("rest", 8);
        r.look("surprised");
        const rk = QBotProps.show(r, "rocket", root, { p: [0, 0.12, 0.32], r: [0, 0, (-dirX * Math.PI) / 2], s: 0.01 });
        const p0 = propPoint(r, rk, [0, 0.3, 0]);
        if (p0) c.fx.burst("puff", p0.x, p0.y, 8, { speed: [20, 80] });
        await c.tween(360, (k) => rk.scale.setScalar(Math.max(0.01, easeOutBack(k))), (x) => x);
        r.gaze(0, 1);
        r.nudge({ "head.x": 18 }, 9);
        await c.wait(380);
        r.look("excited");
        /* 2. jump on: turn side-on, legs astride, the rocket slides under him */
        const turn = dirX * 76;
        r.pose("crouch", 18);
        await c.wait(150);
        const ride = { turn, up: 0.1, waist: [16, 0, 0], head: [-8, 0, 0], hipL: [-82, 0, 12], hipR: [-82, 0, -12], kneeL: [88, 0, 0], kneeR: [88, 0, 0], ankleL: [-10, 0, 0], ankleR: [-10, 0, 0] };
        r.pose({ ...ride, up: 0.3 }, 10);
        const seatPose = atTarget(r, () => {
          const axis = new V(Math.cos(tilt) * dirX, -Math.sin(tilt), 0); // screen-ish direction, in camera space
          const e = r.scene.camera.matrixWorld.elements;
          const w = new V(e[0], e[1], e[2]).multiplyScalar(axis.x).add(new V(e[4], e[5], e[6]).multiplyScalar(axis.y)).normalize();
          const q = alignLocal(r, rk, new V(0, 1, 0), w);
          const along = new V(0, 1, 0).applyQuaternion(q);
          const seat = new V(0, 0.27, -0.02); // middle of the rocket, just under the pelvis (root space)
          return { q, p: seat.addScaledVector(along, -0.3) };
        });
        const q0 = rk.quaternion.clone(),
          pa = rk.position.clone();
        await c.tween(330, (k) => {
          rk.quaternion.copy(q0).slerp(seatPose.q, k);
          rk.position.lerpVectors(pa, seatPose.p, k);
          rk.position.y += Math.sin(Math.PI * k) * 0.12;
        });
        r.pose(ride, 12); // land on it
        r.hand("L", "Grip");
        r.hand("R", "Grip");
        r.nudge({ "shoulderL.x": -42, "shoulderR.x": -42, "shoulderL.z": 14, "shoulderR.z": -14, "elbowL.x": -50, "elbowR.x": -50 }, 10);
        await c.wait(260);
        /* 3. ignition: flames, smoke, the whole thing shakes */
        const fl = rk.userData.flame;
        fl.visible = true;
        fl.scale.set(0.2, 0.2, 0.2);
        let throttle = 0.45;
        c.tick(() => {
          const s = throttle * rnd(0.85, 1.15);
          fl.scale.set(lerp(0.85, 1.05, throttle), s * 1.6, lerp(0.85, 1.05, throttle));
        });
        const nozzle = () => propPoint(r, rk, [0, -0.05, 0]);
        const back = Math.atan2(-Math.sin(tilt), -dirX * Math.cos(tilt)); // exhaust goes opposite to the flight
        /* time-based rates (particles per second), so the plume looks the same at any frame rate */
        let fireDue = 0,
          smokeDue = 0;
        const ex = c.fx.emit((dt) => {
          const n = nozzle();
          if (!n) return;
          fireDue += dt * (40 + 70 * throttle);
          smokeDue += dt * (14 + 22 * throttle);
          for (; fireDue >= 1; fireDue--) {
            const s = rnd(110, 190) * (0.6 + throttle);
            c.fx.spawn("fire", n.x + rnd(-3, 3), n.y + rnd(-3, 3), { vx: Math.cos(back) * s, vy: Math.sin(back) * s + rnd(-25, 25), size: rnd(5, 8) * (0.7 + throttle * 0.6), life: rnd(0.35, 0.55) });
          }
          for (; smokeDue >= 1; smokeDue--) {
            const s = rnd(40, 110);
            c.fx.spawn("smoke", n.x, n.y, { vx: Math.cos(back) * s + rnd(-20, 20), vy: Math.sin(back) * s + rnd(-15, 25), size: rnd(5, 8), alpha: 1.2 });
          }
        });
        c.cleanup(ex);
        c.wiggle("up", 0.008, 13);
        c.wiggle("leaf.x", 22, 3);
        await c.wait(900); // engines roaring: ready for take-off
        /* 4. lift-off: the page starts scrolling with him, and both arrive together */
        throttle = 1;
        r.look("excited");
        const travelPx = dist + (scroll ? Math.abs(scroll.to - scroll.from) * 0.5 : 0);
        const dur = clamp(travelPx * 1.15, 650, 1400);
        const lift = clamp(dist * 0.12, 18, 70);
        const anim = guideEl.animate(
          [
            { transform: `translate(${from.x}px,${from.y}px) rotate(0deg)` },
            { transform: `translate(${from.x - dirX * 6}px,${from.y + 6}px) rotate(${-dirX * 3}deg)`, offset: 0.12 },
            { transform: `translate(${from.x + dx * 0.45}px,${from.y + dy * 0.45 - lift}px) rotate(${dirX * 4}deg)`, offset: 0.55 },
            { transform: `translate(${dest.x}px,${dest.y - 6}px) rotate(${-dirX * 2}deg)`, offset: 0.9 },
            { transform: `translate(${dest.x}px,${dest.y}px) rotate(0deg)` },
          ],
          { duration: calm() ? 1 : dur, easing: "cubic-bezier(.55,0,.35,1)" },
        );
        c.cleanup(() => anim.cancel());
        const stopScroll = scroll
          ? /* the scroll follows the flight's own progress: still while he dips for take-off, then
               gliding to the news, finished just as he lands */
            c.tick(() => {
              const t = anim.currentTime;
              if (t == null) return;
              const k = clamp((t / dur - 0.1) / 0.8, 0, 1);
              scrollAlong(k * k * (3 - 2 * k));
            })
          : () => {};
        await anim.finished.catch(() => {});
        stopScroll();
        if (!c.alive()) throw CANCEL;
        scrollAlong(1);
        setGuide(dest.x, dest.y);
        if (!c.alive()) throw CANCEL;
        throttle = 0.35;
        c.rocketDone = async () => {
          /* 5. touch down: engine off, hop off, the rocket poofs away */
          ex();
          fl.visible = false;
          r.stopAll();
          const pr = propPoint(r, rk, [0, 0.3, 0]);
          r.pose({ turn: 0, up: 0.24 }, 10);
          r.look("happy");
          c.tween(260, (k) => rk.scale.setScalar(Math.max(0.01, 1 - k))).then(
            () => {
              if (pr) c.fx.burst("puff", pr.x, pr.y, 10, { speed: [20, 90] });
              QBotProps.hideAll(r);
            },
            () => {},
          );
          await c.wait(260);
          r.pose("rest", 9);
          await c.wait(260);
        };
      },
      async perform(c) {
        if (c.rocketDone) await c.rocketDone();
        const t = c.target();
        if (!t) return;
        /* "ta-da": open hand to the news, sparkle along the top of the card */
        await pointAt(c, nearest(c.el, meCenter(), 30), { hand: "Open" });
        for (let i = 0; i < 5; i++) {
          c.fx.spawn("star", lerp(t.b.left + 30, t.b.right - 30, i / 4), t.b.top + rnd(-6, 6), { vy: -30, ay: 0, size: 6, life: 0.9 });
          await c.wait(90);
        }
        c.wiggle("leaf.x", 10, 1.3);
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 10 (calendar): checks his wrist "watch", then points at the week */
    watch: {
      async perform(c) {
        const r = c.rig;
        const p = c.target();
        if (!p) return;
        const side = sideFor(p),
          w = side === "R" ? "L" : "R",
          s = w === "L" ? 1 : -1;
        r.hand(w, "Fist");
        r.pose({ [`shoulder${w}`]: [-58, 0, -s * 22], [`elbow${w}`]: [-96, 0, 0], [`wrist${w}`]: [0, s * 20, 0], head: [20, s * 20, s * 6], neck: [6, 0, 0] }, 9);
        r.look("dots");
        r.gaze(s * 0.6, 0.9);
        await c.wait(500);
        c.wiggle("leaf.y", 30, 2); // tick tock
        await c.wait(800);
        r.stopAll();
        r.look("surprised"); // oh, look at the time!
        const wp = r.toScreen(r.node("wrist" + w));
        if (wp) c.fx.spawn("ring", wp.x, wp.y, { size: 4 });
        await c.wait(350);
        r.look("happy");
        await pointAt(c, nearest(c.el, meCenter(), 24));
        c.fx.spawn("ring", p.x, p.y, { size: 9 });
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Step 11 (search): a magnifying glass, held up to the search field, scanning */
    magnify: {
      async perform(c) {
        const r = c.rig;
        const p = nearest(c.el, meCenter(), 30);
        const side = sideFor(p);
        lookAt(r, p, { turn: 18 });
        r.look("surprised");
        const MAG = 1.7; // a big, cartoonish glass
        const mg = QBotProps.show(r, "magnifier", r.node("wrist" + side), { p: [0, -0.08, 0.02], r: [Math.PI, 0, 0], s: 0.01 });
        await c.tween(300, (k) => mg.scale.setScalar(Math.max(0.01, easeOutBack(k) * MAG)), (x) => x);
        aimArm(r, side, { screen: p, hand: "Grip", bend: -78, toCam: 0.55 }); // held up close, peering through it
        /* whatever the hand's angle, the glass stays upright with its lens towards us (else it is seen edge-on) */
        const { V } = T(r);
        const camPos = new V();
        c.tick(() => {
          r.scene.camera.getWorldPosition(camPos);
          mg.lookAt(camPos);
        });
        await c.wait(500);
        c.wiggle(`shoulder${side}.x`, 6, 0.9);
        c.wiggle(`shoulder${side}.z`, 6, 0.9, 0.25); // little circles: scanning
        c.wiggle("head.y", 6, 0.9);
        await c.wait(1600);
        r.stopAll();
        const at = propPoint(r, mg, [0, 0.2, 0]);
        await c.tween(220, (k) => mg.scale.setScalar(Math.max(0.01, (1 - k) * MAG)));
        if (at) c.fx.burst("puff", at.x, at.y, 5, { speed: [15, 50] });
        QBotProps.hideAll(r);
        r.look("happy");
        await pointAt(c, p);
        c.fx.spawn("ring", p.x, p.y, { size: 7 });
      },
      aim: (c) => c.aimer && c.aimer(),
    },

    /* Last step: celebration - jump, spin, arms up, confetti, victory pose */
    celebrate: {
      stage: false, // celebrates right beside the tooltip
      async perform(c) {
        const r = c.rig;
        r.look("excited");
        r.hand("L", "Open");
        r.hand("R", "Open");
        await hop(c, { height: 0.26, spin: 360, crouch: 170 });
        r.pose("excited", 14);
        const m = meCenter();
        c.fx.burst("confetti", m.x - 30, m.y - 30, 26, { speed: [160, 340], angle: -Math.PI * 0.62, spread: 0.9 });
        c.fx.burst("confetti", m.x + 30, m.y - 30, 26, { speed: [160, 340], angle: -Math.PI * 0.38, spread: 0.9 });
        c.fx.burst("star", m.x, m.y - 60, 8, { speed: [60, 160], ay: 120 });
        await c.wait(700);
        /* victory pose: one fist pumping in the air (on the side the tooltip leaves free), the other on the hip */
        const up = freeSide(),
          down = up === "L" ? "R" : "L",
          s = up === "L" ? 1 : -1;
        r.hand(up, "Fist");
        r.hand(down, "");
        r.pose({ [`shoulder${up}`]: [-30, -20 * s, 150 * s], [`elbow${up}`]: [-30, 0, 0], [`shoulder${down}`]: [8, 0, -38 * s], [`elbow${down}`]: [-70, 0, 0], head: [-8, 0, 6 * s], waist: [0, 0, -3 * s] }, 10);
        c.wiggle(`elbow${up}.x`, 14, 1.7);
        c.wiggle("up", 0.012, 1.7);
        c.wiggle("leaf.x", 14, 1.7);
      },
    },
  };

  /* ---------- the tour talks to these ---------- */
  function cancel() {
    run++;
    const r = rig();
    /* props that are still out disappear with a puff */
    cleanups.forEach((f) => {
      try {
        f();
      } catch (e) {}
    });
    cleanups = [];
    tickers.forEach((t) => (t.on = false));
    QBotFX.clear();
    if (r && r.ready) {
      QBotProps.hideAll(r);
      r.stopAll();
      r.hand("L");
      r.hand("R");
    }
    ctx = null;
  }
  function begin(s) {
    cancel();
    step = s;
    guideEl.dataset.act = (s && s.act) || "point";
    if (ready()) rig().boldEyes(4); // thicker smile arcs: his closed, smiling eyes stay readable at tour size
    ctx = makeCtx(s, run);
  }
  /* reduced motion or no 3D model: everything falls back to a plain point (or nothing) */
  function pick(s) {
    if (!ready()) return null;
    const name = (s && s.act) || (s && s.target ? "point" : "hello");
    if (calm()) return s && s.target ? ACTS.point : null;
    return ACTS[name] || ACTS.point;
  }
  /* dest = where the tour would put QBot (beside the tooltip); L = the tour's layout (spotlight, tooltip).
     ride (acts that scroll the page themselves, see ridesScroll): { dest: already placed, ride: { from, to } } */
  async function travel(dest, L, ride) {
    const c = ctx,
      a = pick(step);
    if (ride) dest = ride.dest;
    else if (a) dest = shifted(stage(dest, L), a);
    if (!c) return flyTo(dest.x, dest.y);
    try {
      if (a && a.travel) return await a.travel(c, dest, ride && ride.ride);
    } catch (e) {
      if (e !== CANCEL) console.warn("QBot act:", e);
      return setGuide(dest.x, dest.y);
    }
    if (ready()) {
      const r = rig();
      r.stopAll();
      r.hand("L");
      r.hand("R");
      r.pose("fly", 10);
      r.look("excited");
    }
    await flyTo(dest.x, dest.y);
    if (ready() && c.alive()) rig().pose("rest", 8);
  }
  function perform() {
    const c = ctx,
      a = pick(step);
    if (!c || !a) return;
    a.perform(c).catch((e) => e !== CANCEL && console.warn("QBot act:", e));
  }
  /* the page moved or resized: the tour has just put QBot back beside the tooltip - restage and re-aim */
  let reaimFrame = 0;
  function reflow(L) {
    if (!ctx) return;
    if (L) {
      const a = pick(step);
      if (a) {
        const d = shifted(stage(L.robot, L), a);
        setGuide(d.x, d.y);
      }
    }
    if (reaimFrame) return;
    reaimFrame = requestAnimationFrame(() => {
      reaimFrame = 0;
      const a = pick(step);
      if (ctx && a && a.aim) a.aim(ctx);
    });
  }
  /* does this step's act scroll the page itself (the rocket: the page moves only once he has taken off)? */
  function ridesScroll() {
    const a = pick(step);
    return !!(a && a.ridesScroll);
  }
  /* where QBot will stand for this step, for a layout measured ahead of time */
  function place(dest, L) {
    return pick(step) ? stage(dest, L) : dest;
  }
  function stop() {
    cancel();
    step = null;
    delete guideEl.dataset.act;
    if (ready()) rig().boldEyes(1);
    if (window.qpMascot && qpMascot.releaseGuide) qpMascot.releaseGuide();
  }
  return { begin, travel, perform, reflow, stop, ridesScroll, place, ACTS, _dev: { aimArm, lookAt, fingertip, atTarget, screenOf, worldDir } };
})();
