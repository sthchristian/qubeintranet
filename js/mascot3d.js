/* mascot3d.js
 * The 3D QBot robot (assets/qp.glb) shown with <model-viewer>.
 *
 * The .glb has no built-in animations. It is a jointed figure (j_head,
 * j_shoulderL, j_leaf …), so everything here is animated from code:
 *
 *   Rig        turns the joints, draws the eyes, makes the visor glow
 *   POSES      named body poses (angles in degrees)   <- edit these
 *   EYES       named eye shapes                        <- edit these
 *   QUOTES     what QBot says when you click it        <- edit these
 *   Director   decides what QBot does: thinking while you type or wait,
 *              curious after 30 s of no activity, gliding on scroll,
 *              a wave on click and a jump on double-click
 *
 * If the model cannot load (for example when index.html is opened straight
 * from disk instead of through a web server) the 2D image stays in place.
 */
(function () {
  const RAD = Math.PI / 180;
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  /* =====================================================================
     POSES. Angles in degrees: [x, y, z] per joint.
       x = forward / back     y = twist     z = sideways
     Only list the joints that differ from REST. "L" is the robot's own
     left arm (on the right of the screen). up / turn move the whole body.
     ===================================================================== */
  const REST = {
    shoulderL: [6, 0, 9],
    elbowL: [-16, 0, 0],
    shoulderR: [6, 0, -9],
    elbowR: [-16, 0, 0],
  };
  const POSES = {
    rest: {},
    /* leaning towards the chat box while you type */
    listening: { waist: [9, 0, 4], neck: [3, 0, 0], head: [7, -12, -5], shoulderL: [-8, 0, 12], shoulderR: [-8, 0, -12], elbowL: [-34, 0, 0], elbowR: [-34, 0, 0] },
    /* leaning in, hand at the chin (the "Thinking" expression on the brand sheet) */
    thinking: {
      waist: [7, 0, 0],
      neck: [4, 0, 0],
      head: [6, -8, -9],
      shoulderR: [-27, 46, 0],
      elbowR: [-94, 0, 0],
      shoulderL: [10, 0, 14],
      elbowL: [-30, 0, 0],
    },
    /* arm up and open hand (the big waving robot on the brand sheet) */
    wave: {
      waist: [0, 0, -4],
      head: [-4, 0, 9],
      shoulderL: [-71, -20, 60],
      elbowL: [-47, 0, 0],
      shoulderR: [8, 0, -16],
      hipR: [0, 0, -5],
    },
    /* both arms up (the "Excited" expression) */
    excited: {
      head: [-10, 0, 0],
      waist: [-5, 0, 0],
      shoulderL: [-77, -34, 67],
      elbowL: [-24, 0, 0],
      shoulderR: [-77, 34, -67],
      elbowR: [-24, 0, 0],
      hipL: [0, 0, 9],
      hipR: [0, 0, -9],
    },
    crouch: { hipL: [-28, 0, 4], kneeL: [50, 0, 0], ankleL: [-22, 0, 0], hipR: [-28, 0, -4], kneeR: [50, 0, 0], ankleR: [-22, 0, 0], waist: [8, 0, 0], up: -0.045 },
    tiltLeft: { head: [0, 6, 16], neck: [0, 0, 5], waist: [0, 0, 3] },
    tiltRight: { head: [0, -6, -16], neck: [0, 0, -5], waist: [0, 0, -3] },
    lookUp: { head: [-13, 0, 0], neck: [-5, 0, 0], waist: [-3, 0, 0] },
    lookDown: { head: [13, 0, 0], neck: [5, 0, 0], waist: [4, 0, 0] },
    peek: { head: [4, 10, 6], waist: [3, 0, 10], shoulderR: [-20, 0, -30], elbowR: [-40, 0, 0], turn: 14 },
    /* used by the flying / dragged robot */
    fly: { waist: [10, 0, 0], head: [-10, 0, 0], shoulderL: [38, 0, 22], shoulderR: [38, 0, -22], elbowL: [-8, 0, 0], elbowR: [-8, 0, 0], hipL: [14, 0, 5], hipR: [20, 0, -5], kneeL: [22, 0, 0], kneeR: [34, 0, 0] },
    held: { head: [-6, 0, 0], shoulderL: [0, -60, 78], shoulderR: [0, 60, -78], elbowL: [-34, 0, 0], elbowR: [-34, 0, 0], hipL: [8, 0, 10], hipR: [-6, 0, -10], kneeL: [26, 0, 0], kneeR: [12, 0, 0] },
  };

  /* =====================================================================
     EYES. Sizes are fractions of the eye area on the visor.
       arc: r = radius, t = line thickness, flip = arc opens upwards
       dot: rx / ry = half width / height
       x / y move the eye (y down). Per-eye overrides go in left / right.
     ===================================================================== */
  const EYES = {
    happy: { type: "arc", r: 0.27, t: 0.13, y: 0.1 },
    excited: { type: "arc", r: 0.32, t: 0.15, y: 0.12 },
    calm: { type: "arc", r: 0.24, t: 0.1, y: -0.08, flip: true },
    dots: { type: "dot", rx: 0.13, ry: 0.19 },
    thinking: { type: "dot", rx: 0.12, ry: 0.15, x: 0.1, y: -0.14 },
    listening: { type: "dot", rx: 0.13, ry: 0.18, x: -0.09, y: 0.07 },
    curious: { type: "dot", rx: 0.12, ry: 0.17, left: { rx: 0.15, ry: 0.22 } },
    surprised: { type: "dot", rx: 0.17, ry: 0.22 },
  };

  const QUOTES = [
    "Ideas into impact.",
    "Learn today. Build tomorrow.",
    "On to the next challenge!",
    "Same curiosity. Bigger possibilities.",
    "Build. Test. Improve. Repeat.",
    "People make it happen.",
    "Here to help!",
    "A brighter tomorrow, together.",
  ];

  /* =====================================================================
     Rig: one per <model-viewer>
     ===================================================================== */
  const JOINTS = ["pelvis", "waist", "chest", "neck", "head", "leaf", "shoulderL", "elbowL", "wristL", "shoulderR", "elbowR", "wristR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"];
  const SPARE_PARTS = /^(hammer|torch|handFist|handGrip|handOpen|handPoint|mouth)/;
  const GLOW = 0.55; // resting brightness of eyes + chest light

  class Rig {
    constructor(viewer) {
      this.viewer = viewer;
      this.ready = false;
      this.ch = {}; // channels: every number we animate
      this.osc = []; // repeating motions layered on top (waving, wiggling)
      this.eye = { name: "happy", open: 1, openTo: 1 };
      this.glow = { v: GLOW, pulse: 0, pulseTo: 0 };
      this.last = 0;
      this.running = false;
      this.frame = this.frame.bind(this);
    }

    /* Find the joints inside model-viewer's scene. Returns false if this
       version of model-viewer does not expose it (the model still shows). */
    setup() {
      const v = this.viewer;
      const key = Object.getOwnPropertySymbols(v).find((s) => s.description === "scene");
      const scene = key && v[key];
      const root = scene && scene.getObjectByName("j_root");
      if (!root) return false;
      this.scene = scene;
      this.root = root;
      this.parts = {};
      root.traverse((o) => {
        this.parts[o.name] = o;
        if (SPARE_PARTS.test(o.name)) o.visible = false;
        if (o.isMesh && o.material && o.material.name === "glow") this.glowMat = o.material;
      });
      JOINTS.forEach((j) => {
        const o = this.parts["j_" + j];
        if (!o) return;
        ["x", "y", "z"].forEach((a, i) => this.channel(j + "." + a, (REST[j] || [0, 0, 0])[i], (val) => (o.rotation[a] = val * RAD)));
      });
      const y0 = root.position.y;
      this.channel("up", 0, (val) => (root.position.y = y0 + val));
      this.channel("turn", 0, (val) => (root.rotation.y = val * RAD));
      if (this.glowMat) this.glowMat.emissive.copy(this.glowMat.color);
      this.eyes = ["eyeL", "eyeR"].map((n) => this.readEye(this.parts[n])).filter(Boolean);
      this.ready = true;
      this.pose("rest", 99);
      this.drawEyes();
      this.apply(1);
      this.render();
      return true;
    }
    channel(name, rest, set) {
      this.ch[name] = { rest, v: rest, to: rest, speed: 9, set };
    }
    render() {
      if (this.scene.queueRender) this.scene.queueRender();
    }

    /* ---------- Body ---------- */
    /* speed: how quickly joints move there (about 4 = slow, 9 = normal, 18 = snappy) */
    pose(name, speed = 9) {
      if (!this.ready) return;
      const p = typeof name === "string" ? POSES[name] || {} : name;
      Object.keys(this.ch).forEach((k) => {
        const c = this.ch[k],
          [joint, axis] = k.split(".");
        let to = c.rest;
        if (axis && p[joint]) to = p[joint]["xyz".indexOf(axis)];
        else if (!axis && k in p) to = p[k];
        c.to = to;
        c.speed = speed;
      });
      this.start();
    }
    /* nudge single channels without touching the rest, e.g. {"head.x": 8} */
    nudge(values, speed = 9) {
      if (!this.ready) return;
      Object.entries(values).forEach(([k, val]) => {
        if (this.ch[k]) Object.assign(this.ch[k], { to: val, speed });
      });
      this.start();
    }
    /* repeating motion on one channel; returns a function that stops it */
    wiggle(channel, amount, perSecond, phase = 0) {
      if (!this.ready) return () => {};
      const o = { channel, amount, f: perSecond, phase, gain: 0, on: true };
      this.osc.push(o);
      this.start();
      return () => (o.on = false);
    }
    hand(side, kind = "") {
      if (!this.ready) return;
      ["", "Open", "Point", "Fist", "Grip"].forEach((k) => {
        const o = this.parts["hand" + k + side];
        if (o) o.visible = k === kind;
      });
      this.render();
    }

    /* ---------- Eyes + glow ---------- */
    async look(name) {
      if (!this.ready || this.eye.name === name) return;
      this.eye.name = name;
      this.eye.openTo = 0.08; // blink shut, swap shape, open again
      this.start();
      await wait(90);
      this.eye.shape = name;
      this.eye.openTo = 1;
      this.start();
    }
    async blink() {
      if (!this.ready || this.eye.openTo < 1) return;
      this.eye.openTo = 0.08;
      this.start();
      await wait(110);
      this.eye.openTo = 1;
      this.start();
    }
    pulse(on) {
      this.glow.pulseTo = on ? 1 : 0;
      this.start();
    }

    /* The eye meshes are flat 25 x 25 grids lying on the visor. We keep the
       original surface and move the grid points so they trace an arc or a dot. */
    readEye(mesh) {
      if (!mesh) return null;
      const pos = mesh.geometry.attributes.position,
        nor = mesh.geometry.attributes.normal;
      if (pos.count !== 625) return null;
      mesh.frustumCulled = false;
      const src = Float32Array.from(pos.array),
        n = nor ? Float32Array.from(nor.array) : null;
      const flipX = src[0] > src[24 * 3]; // which way the columns run
      return { pos, src, n, flipX, left: mesh.name === "eyeL" };
    }
    drawEyes() {
      if (!this.eyes) return;
      const shape = EYES[this.eye.shape || this.eye.name] || EYES.happy,
        open = this.eye.open;
      this.eyes.forEach((e) => {
        const s = { x: 0, y: 0, ...shape, ...(e.left ? shape.left : shape.right) };
        const out = e.pos.array;
        for (let r = 0; r < 25; r++)
          for (let c = 0; c < 25; c++) {
            const a = c / 24,
              b = r / 24;
            let u, v2;
            if (s.type === "dot") {
              const ang = a * Math.PI * 2;
              u = Math.cos(ang) * s.rx * b;
              v2 = Math.sin(ang) * s.ry * b;
            } else {
              const ang = Math.PI * a,
                thick = s.t * Math.sqrt(1 - Math.pow(Math.abs(2 * a - 1), 6)), // rounded ends
                rad = s.r + (b - 0.5) * thick;
              u = -Math.cos(ang) * rad;
              v2 = -Math.sin(ang) * rad * (s.flip ? -1 : 1);
            }
            /* position inside the eye area, 0..1 (x to screen right, y down) */
            const px = 0.5 + s.x + u,
              py = 0.5 + s.y + v2 * open;
            this.sample(e, e.flipX ? 1 - px : px, py, out, (r * 25 + c) * 3);
          }
        e.pos.needsUpdate = true;
      });
    }
    /* point on the original eye surface (bilinear), pushed 1.5 mm outwards */
    sample(e, u, v, out, at) {
      u = Math.min(Math.max(u, 0), 1) * 24;
      v = Math.min(Math.max(v, 0), 1) * 24;
      const c = Math.min(Math.floor(u), 23),
        r = Math.min(Math.floor(v), 23),
        fu = u - c,
        fv = v - r;
      const i00 = (r * 25 + c) * 3,
        i01 = i00 + 3,
        i10 = i00 + 75,
        i11 = i10 + 3;
      for (let k = 0; k < 3; k++) {
        const mix = (arr) => (arr[i00 + k] * (1 - fu) + arr[i01 + k] * fu) * (1 - fv) + (arr[i10 + k] * (1 - fu) + arr[i11 + k] * fu) * fv;
        out[at + k] = mix(e.src) + (e.n ? mix(e.n) * 0.0015 : 0);
      }
    }

    /* ---------- Animation loop (only runs while something is moving) ---------- */
    start() {
      if (this.running || !this.ready) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.frame);
    }
    frame(now) {
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      const busy = this.apply(dt, now / 1000);
      this.render();
      if (busy && !document.hidden) requestAnimationFrame(this.frame);
      else this.running = false;
    }
    apply(dt, t = 0) {
      let busy = false;
      const still = calm();
      Object.values(this.ch).forEach((c) => {
        const d = c.to - c.v;
        if (Math.abs(d) > 0.01) {
          c.v += d * (still ? 1 : 1 - Math.exp(-dt * c.speed));
          busy = true;
        } else c.v = c.to;
        c.out = c.v;
      });
      this.osc = this.osc.filter((o) => o.on || o.gain > 0.01);
      this.osc.forEach((o) => {
        o.gain += ((o.on ? 1 : 0) - o.gain) * (1 - Math.exp(-dt * 7));
        const c = this.ch[o.channel];
        if (c && !still) c.out += Math.sin((t * o.f + o.phase) * Math.PI * 2) * o.amount * o.gain;
        busy = true;
      });
      Object.values(this.ch).forEach((c) => c.set(c.out));
      /* eyes */
      const e = this.eye,
        de = e.openTo - e.open;
      if (Math.abs(de) > 0.01 || e.shape !== e.drawn) {
        e.open = Math.abs(de) > 0.01 ? e.open + de * (still ? 1 : 1 - Math.exp(-dt * 34)) : e.openTo;
        e.drawn = e.shape;
        this.drawEyes();
        busy = busy || Math.abs(de) > 0.01;
      }
      /* glow */
      const g = this.glow;
      g.pulse += (g.pulseTo - g.pulse) * (1 - Math.exp(-dt * 5));
      if (this.glowMat) this.glowMat.emissiveIntensity = GLOW + g.pulse * (0.55 + 0.45 * Math.sin(t * Math.PI * 2 * 1.3));
      if (g.pulseTo || g.pulse > 0.01) busy = true;
      return busy;
    }
  }

  /* =====================================================================
     Loading: swap the 2D image for the model once it is ready
     ===================================================================== */
  function mount(viewer, holder) {
    const rig = new Rig(viewer);
    if (!viewer || !window.customElements || !customElements.get("model-viewer")) return rig;
    const go = () => {
      try {
        if (rig.setup()) holder.classList.add("is-3d");
        else if (viewer.loaded) holder.classList.add("is-3d"); // model shows, but cannot be posed
      } catch (err) {
        console.warn("QBot 3D mascot: falling back to the 2D image.", err);
      }
      viewer.dispatchEvent(new CustomEvent("qp-rig", { detail: rig }));
    };
    if (viewer.loaded) go();
    else viewer.addEventListener("load", go, { once: true });
    return rig;
  }

  /* =====================================================================
     Director: decides what QBot does on the dashboard
     ===================================================================== */
  const IDLE_AFTER = 30000; // ms without mouse, keyboard or scroll before QBot gets curious
  const TYPING_HOLD = 1600; // ms QBot keeps listening after the last keystroke
  const CAMERA = { angle: -16, tilt: 84, distance: 4.5 }; // must match camera-orbit in index.html

  const button = document.getElementById("mascot"),
    stage = document.querySelector(".chat-stage"),
    viewer = document.getElementById("qp3d");
  if (!button || !viewer) return;
  const rig = mount(viewer, button);
  const bubble = (text, ms = 2800) => typeof say === "function" && say("<b>QBot</b> &nbsp;" + text, ms);
  const onScreen = () => button.offsetParent !== null && !document.hidden && !document.body.classList.contains("is-touring");

  const flags = { typing: false, waiting: false, curious: false };
  let mode = "",
    run = 0, // increases with every reaction so an older one can stop itself
    reacting = false,
    stops = [];
  const stopWiggles = () => {
    stops.forEach((stop) => stop());
    stops = [];
  };

  /* Pick the state with the highest priority and go there */
  function settle(force) {
    if (reacting || !rig.ready) return;
    const next = flags.waiting ? "thinking" : flags.typing ? "listening" : flags.curious ? "curious" : "rest";
    if (next === mode && !force) return;
    mode = next;
    stopWiggles();
    button.dataset.state = next;
    rig.hand("L");
    rig.hand("R", next === "thinking" ? "Point" : "");
    rig.pulse(next === "thinking");
    if (next === "thinking") {
      rig.pose("thinking", 7);
      rig.look("thinking");
      stops.push(rig.wiggle("leaf.y", 34, 1.7), rig.wiggle("head.z", 2.5, 0.45), rig.wiggle("waist.x", 1.2, 0.45, 0.25));
      bubble("Hmm, let me check…", 0);
    } else if (next === "listening") {
      rig.pose("listening", 7);
      rig.look("listening");
      stops.push(rig.wiggle("leaf.x", 9, 0.9), rig.wiggle("head.x", 1.6, 0.6));
      bubble("I'm listening…", 0);
    } else if (next === "curious") {
      beCurious();
    } else {
      rig.pose("rest", 5);
      rig.look("happy");
    }
    if ((next === "rest" || next === "curious") && typeof NOTE_IDLE === "string" && /listening|let me check/.test(note.textContent)) say(NOTE_IDLE);
  }

  /* ---------- 2. Typing / thinking ---------- */
  let typingTimer;
  ["chat-input", "drawer-input"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("input", () => {
        flags.typing = true;
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          flags.typing = false;
          settle();
        }, TYPING_HOLD);
        settle();
      });
  });
  /* chat.js announces when a question is sent and when the answer arrives */
  document.addEventListener("qp:chat", async (e) => {
    flags.waiting = e.detail === "waiting";
    if (flags.waiting) {
      flags.typing = false;
      clearTimeout(typingTimer);
    }
    settle();
    if (e.detail === "answered" && rig.ready && !reacting) {
      rig.nudge({ "head.x": 13 }, 16); // a small "got it" nod
      await wait(190);
      settle(true);
    }
  });

  /* ---------- 3. Idle curiosity ---------- */
  let lastActive = Date.now();
  function active() {
    lastActive = Date.now();
    if (flags.curious) {
      flags.curious = false;
      settle();
    }
  }
  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach((ev) => addEventListener(ev, active, { passive: true, capture: true }));
  setInterval(() => {
    if (!flags.curious && Date.now() - lastActive > IDLE_AFTER && onScreen() && !calm()) {
      flags.curious = true;
      settle();
    }
  }, 1000);
  const CURIOUS_ACTS = [
    async () => {
      rig.look("curious");
      rig.pose(pick(["tiltLeft", "tiltRight"]), 4);
      await wait(1900);
    },
    async () => {
      rig.look("dots");
      rig.pose("lookUp", 4);
      const stop = rig.wiggle("leaf.y", 26, 2.2);
      await wait(1500);
      stop();
    },
    async () => {
      rig.look("dots");
      rig.pose("peek", 4);
      await wait(2100);
    },
    async () => {
      rig.look("happy");
      rig.pose("crouch", 12);
      await wait(180);
      rig.pose("rest", 14);
      rig.nudge({ up: 0.07 }, 16);
      await wait(200);
      rig.nudge({ up: 0 }, 9);
      await wait(500);
    },
    async () => {
      rig.look("calm");
      rig.pose("lookDown", 3);
      await wait(2200);
    },
  ];
  async function beCurious() {
    const mine = ++run;
    const still = () => mine === run && mode === "curious" && flags.curious;
    while (still()) {
      await pick(CURIOUS_ACTS)();
      if (!still()) return;
      rig.pose("rest", 4);
      rig.look("happy");
      await wait(rand(1800, 4200));
      if (still() && !onScreen()) {
        flags.curious = false;
        settle();
      }
    }
  }
  /* blink every few seconds so QBot never looks frozen */
  (function blinkLater() {
    setTimeout(
      () => {
        if (rig.ready && onScreen() && !calm()) rig.blink();
        blinkLater();
      },
      rand(2600, 6000),
    );
  })();

  /* ---------- 4. Scroll-linked glide ---------- */
  let scrollFrame = 0,
    lastY = scrollY,
    lookTimer;
  function glide() {
    scrollFrame = 0;
    if (calm() || !stage) return;
    const box = stage.getBoundingClientRect();
    if (!box.height) return;
    /* 0 = card at rest, 1 = card scrolled out of view */
    const p = Math.min(Math.max(scrollY / (box.top + scrollY + box.height), 0), 1);
    button.style.translate = `${(-p * 10).toFixed(1)}px ${(-p * 20).toFixed(1)}px`;
    button.style.rotate = `${(p * 5).toFixed(2)}deg`;
    if (rig.ready) viewer.cameraOrbit = `${CAMERA.angle + p * 26}deg ${CAMERA.tilt - p * 6}deg ${CAMERA.distance}m`;
    /* look in the direction of travel */
    const speed = scrollY - lastY;
    lastY = scrollY;
    if (rig.ready && !reacting && (mode === "rest" || mode === "curious")) {
      rig.nudge({ "head.x": Math.max(-14, Math.min(14, speed * 0.6)), "neck.x": Math.max(-5, Math.min(5, speed * 0.2)), "leaf.x": Math.max(-30, Math.min(30, -speed * 1.5)) }, 10);
      clearTimeout(lookTimer);
      lookTimer = setTimeout(() => !reacting && settle(true), 220);
    }
  }
  addEventListener(
    "scroll",
    () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(glide);
    },
    { passive: true },
  );

  /* ---------- 5. Click = wave, double-click = jump ---------- */
  function bounce() {
    button.classList.remove("is-bouncing");
    void button.offsetWidth;
    button.classList.add("is-bouncing");
  }
  async function react(kind = "wave") {
    const mine = ++run;
    reacting = true;
    stopWiggles();
    bounce();
    if (rig.ready) {
      rig.pulse(false);
      if (kind === "excited") {
        bubble(pick(["Wheee!", "Let's go!", "On to the next challenge!"]), 2400);
        rig.hand("L", "Open");
        rig.hand("R", "Open");
        rig.look("excited");
        rig.pose("crouch", 18);
        await wait(150);
        if (mine !== run) return;
        rig.pose("excited", 16);
        rig.nudge({ up: 0.12, turn: 360 }, 9);
        await wait(330);
        if (mine !== run) return;
        rig.nudge({ up: 0 }, 9);
        await wait(900);
        if (mine !== run) return;
        Object.assign(rig.ch.turn, { v: 0, to: 0 }); // a full turn ends where it started
      } else {
        bubble(pick(QUOTES));
        rig.hand("L", "Open");
        rig.hand("R");
        rig.look("happy");
        rig.pose("wave", 11);
        stops.push(rig.wiggle("shoulderL.z", 13, 2.5), rig.wiggle("head.z", 3, 1.25), rig.wiggle("leaf.x", 14, 2.5));
        await wait(1900);
        if (mine !== run) return;
      }
    } else {
      bubble(pick(QUOTES));
      await wait(700);
      if (mine !== run) return;
    }
    reacting = false;
    settle(true);
  }
  let lastClick = 0;
  function click() {
    const now = Date.now(),
      double = now - lastClick < 380;
    lastClick = double ? 0 : now;
    react(double ? "excited" : "wave");
  }

  viewer.addEventListener("qp-rig", () => settle(true));

  /* ---------- The flying / dragged robot (tour + drag) uses the model too ---------- */
  const guide = document.getElementById("guide"),
    guideViewer = document.getElementById("qp3d-guide");
  if (guide && guideViewer) {
    const gRig = mount(guideViewer, guideViewer.parentElement);
    let gStops = [],
      gMode = "";
    const sync = () => {
      const c = guide.classList,
        next = !c.contains("on") ? "off" : c.contains("held") ? "held" : c.contains("flying") ? "fly" : c.contains("wave") ? "wave" : "rest";
      if (next === gMode || !gRig.ready) return;
      gMode = next;
      gStops.forEach((stop) => stop());
      gStops = [];
      const open = next === "held" || next === "wave" ? "Open" : "";
      gRig.hand("L", open);
      gRig.hand("R", next === "held" ? "Open" : "");
      if (next === "held") {
        gRig.pose("held", 12);
        gRig.look("surprised");
        gStops.push(gRig.wiggle("hipL.x", 12, 1.3), gRig.wiggle("hipR.x", 12, 1.3, 0.5), gRig.wiggle("leaf.x", 16, 1.3));
      } else if (next === "fly") {
        gRig.pose("fly", 10);
        gRig.look("excited");
      } else if (next === "wave") {
        gRig.pose("wave", 12);
        gRig.look("happy");
        gStops.push(gRig.wiggle("shoulderL.z", 13, 2.5));
      } else {
        gRig.pose("rest", 8);
        gRig.look("happy");
      }
    };
    new MutationObserver(sync).observe(guide, { attributes: true, attributeFilter: ["class"] });
    guideViewer.addEventListener("qp-rig", sync);
    /* load the second copy only after the first one is on screen */
    viewer.addEventListener("qp-rig", () => guideViewer.setAttribute("src", viewer.getAttribute("src")), { once: true });
  }

  window.qpMascot = { rig, react, click, flags, settle };
})();
