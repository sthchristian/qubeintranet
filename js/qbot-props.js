/* qbot-props.js
 * Cartoon props for QBot's tour acts (js/qbot-acts.js), built in code inside QBot's own 3D scene:
 * an oversized bazooka, a rocket (with engine flames) and a magnifying glass.
 *
 * No 3D library is added: the classes come from the objects model-viewer already loaded
 * (a mesh's constructor, its geometry's constructor, ...), and every prop is painted with QBot's
 * own materials (cream, yellow, black, steel, glow, screen), so it shares his exact look and lighting.
 * Shapes come from three tiny generators: lathe (turned shapes), box and torus.
 *
 * Props are built once per robot, the first time they are needed, then hidden and reused;
 * dispose() frees the few materials that were copied (flames, glass).
 * Sizes are in metres, like the model (QBot is about 1.1 m tall). Built-in props in the .glb
 * (hammer, torch) are shown through show() as well.
 */
const QBotProps = (() => {
  const kits = new WeakMap();

  /* ---------- classes + materials, taken from the loaded model ---------- */
  function kit(rig) {
    if (kits.has(rig)) return kits.get(rig);
    let anyMesh = null;
    const mats = {};
    rig.root.traverse((o) => {
      if (!o.isMesh) return;
      anyMesh = anyMesh || o;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => m && m.name && !mats[m.name] && (mats[m.name] = m));
    });
    const geo = anyMesh.geometry;
    const k = {
      rig,
      Object3D: rig.root.constructor,
      Mesh: anyMesh.constructor,
      Geometry: geo.constructor,
      Attribute: geo.attributes.position.constructor,
      mats,
      copies: [], // materials we cloned (and must dispose)
      geos: [],
      props: {},
    };
    kits.set(rig, k);
    return k;
  }
  function tinted(k, base, opts) {
    const m = k.mats[base].clone();
    if (opts.color != null) m.color.setHex(opts.color);
    if (opts.emissive != null && m.emissive) {
      m.emissive.setHex(opts.emissive);
      m.emissiveIntensity = opts.intensity || 1;
    }
    if (opts.opacity != null) {
      m.transparent = true;
      m.opacity = opts.opacity;
      m.depthWrite = false;
    }
    if (opts.roughness != null && "roughness" in m) m.roughness = opts.roughness;
    k.copies.push(m);
    return m;
  }

  /* ---------- geometry generators ---------- */
  function geometry(k, pos, idx) {
    const g = new k.Geometry();
    g.setAttribute("position", new k.Attribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    k.geos.push(g);
    return g;
  }
  /* turned shape around +Y: profile = [[radius, y], ...] from bottom to top.
     Repeat a point to get a crisp edge there. */
  function lathe(k, profile, seg = 28) {
    const pos = [],
      idx = [];
    profile.forEach(([r, y]) => {
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        pos.push(r * Math.cos(a), y, r * Math.sin(a));
      }
    });
    const row = seg + 1;
    for (let i = 0; i < profile.length - 1; i++)
      for (let j = 0; j < seg; j++) {
        const a = i * row + j,
          b = a + row,
          c = b + 1,
          d = a + 1;
        idx.push(a, b, d, b, c, d);
      }
    return geometry(k, pos, idx);
  }
  function box(k, w, h, d) {
    const x = w / 2,
      y = h / 2,
      z = d / 2;
    const F = [
      [[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z]],
      [[-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z]],
      [[-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z]],
      [[-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z]],
      [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]],
      [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]],
    ];
    const pos = [],
      idx = [];
    F.forEach((f, n) => {
      f.forEach((p) => pos.push(...p));
      const o = n * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    return geometry(k, pos, idx);
  }
  /* ring in the XY plane (hole along Z) */
  function torus(k, R, r, seg = 32, tube = 12) {
    const pos = [],
      idx = [];
    for (let i = 0; i <= seg; i++) {
      const u = (i / seg) * Math.PI * 2;
      for (let j = 0; j <= tube; j++) {
        const v = (j / tube) * Math.PI * 2;
        pos.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v));
      }
    }
    const row = tube + 1;
    for (let i = 0; i < seg; i++)
      for (let j = 0; j < tube; j++) {
        const a = i * row + j,
          b = a + row,
          c = b + 1,
          d = a + 1;
        idx.push(a, d, b, b, d, c);
      }
    return geometry(k, pos, idx);
  }
  function part(k, g, mat, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
    const m = new k.Mesh(g, typeof mat === "string" ? k.mats[mat] : mat);
    m.position.set(p[0], p[1], p[2]);
    m.rotation.set(r[0], r[1], r[2]);
    if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]);
    else m.scale.setScalar(s);
    m.frustumCulled = false;
    return m;
  }
  const group = (k, ...kids) => {
    const g = new k.Object3D();
    kids.forEach((c) => g.add(c));
    return g;
  };
  const Y2Z = [Math.PI / 2, 0, 0]; // turn a +Y lathe so it runs along +Z

  /* ---------- props ---------- */
  /* Oversized cartoon bazooka, barrel along +Z. Origin = where it rests on the shoulder.
     userData.muzzle = the barrel's mouth (for the flash and the shot) */
  function bazooka(k) {
    const tube = lathe(k, [[0, -0.34], [0.058, -0.34], [0.058, -0.34], [0.064, 0.3], [0.064, 0.3], [0, 0.3]]);
    const bell = lathe(k, [[0.06, 0.28], [0.06, 0.28], [0.088, 0.36], [0.094, 0.4], [0.094, 0.4], [0.072, 0.4], [0.072, 0.4], [0.06, 0.37]]);
    const hole = lathe(k, [[0, 0.395], [0.07, 0.395]]);
    const back = lathe(k, [[0.03, -0.42], [0.03, -0.42], [0.078, -0.42], [0.06, -0.34], [0.06, -0.34], [0.03, -0.34]]);
    const band = lathe(k, [[0.067, -0.02], [0.067, -0.02], [0.067, 0.04], [0.067, 0.04]]);
    const b = group(
      k,
      part(k, tube, "cream", { r: Y2Z }),
      part(k, bell, "black", { r: Y2Z }),
      part(k, hole, "black", { r: Y2Z }),
      part(k, back, "black", { r: Y2Z }),
      part(k, band, "yellow", { r: Y2Z, p: [0, 0, 0.18] }),
      part(k, band, "yellow", { r: Y2Z, p: [0, 0, -0.18] }),
      part(k, box(k, 0.03, 0.11, 0.05), "black", { p: [0, -0.1, -0.06], r: [0.2, 0, 0] }), // grip
      part(k, box(k, 0.03, 0.09, 0.04), "black", { p: [0, -0.09, 0.14], r: [-0.15, 0, 0] }), // front grip
      part(k, box(k, 0.026, 0.05, 0.1), "black", { p: [0.0, 0.08, 0.05] }), // sight
      part(k, box(k, 0.03, 0.025, 0.03), "yellow", { p: [0.0, 0.112, 0.085] }),
    );
    b.userData.muzzle = [0, 0, 0.4];
    return b;
  }
  /* Engine flame pointing down -Y from y = 0: two nested cones that flicker (scale.y in the act) */
  function flame(k) {
    const outer = lathe(k, [[0, 0.02], [0.07, 0], [0.06, -0.12], [0.03, -0.26], [0, -0.32]], 20);
    const inner = lathe(k, [[0, 0.02], [0.045, 0], [0.035, -0.09], [0, -0.19]], 20);
    const f = group(
      k,
      part(k, outer, tinted(k, "glow", { color: 0xff8a1e, emissive: 0xff7a10, intensity: 2.2, opacity: 0.8 })),
      part(k, inner, tinted(k, "glow", { color: 0xfff0c9, emissive: 0xffe9a8, intensity: 2.6, opacity: 0.95 })),
    );
    return f;
  }
  /* Cartoon rocket, nose along +Y, nozzle at y = 0. userData.flame / nozzle for the act */
  function rocket(k) {
    const body = lathe(k, [[0, 0.07], [0.07, 0.07], [0.07, 0.07], [0.098, 0.13], [0.11, 0.26], [0.104, 0.42], [0.085, 0.5], [0.085, 0.5], [0, 0.5]]);
    const nose = lathe(k, [[0.086, 0.497], [0.086, 0.497], [0.07, 0.56], [0.045, 0.61], [0.016, 0.64], [0, 0.645]]);
    const nozzle = lathe(k, [[0.05, 0.075], [0.05, 0.075], [0.07, 0.0], [0.07, 0.0], [0.04, 0.0], [0.04, 0.0], [0.03, 0.06]]);
    const stripe = lathe(k, [[0.112, 0.28], [0.112, 0.28], [0.112, 0.31], [0.112, 0.31]]);
    const fin = box(k, 0.012, 0.15, 0.1);
    const r = group(k, part(k, body, "cream"), part(k, nose, "yellow"), part(k, nozzle, "steel"), part(k, stripe, "yellow"));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const holder = group(k, part(k, fin, "black", { p: [0, 0, 0.1], r: [-0.45, 0, 0] }));
      holder.rotation.y = a;
      holder.position.y = 0.12;
      r.add(holder);
    }
    /* porthole on both sides (facing the camera whichever way the rocket turns) */
    [0.106, -0.106].forEach((z) => {
      const ring = part(k, torus(k, 0.042, 0.009, 24, 8), "yellow", { p: [0, 0.36, z] });
      const glass = part(k, lathe(k, [[0, 0], [0.036, 0]], 20), "screen", { p: [0, 0.36, z], r: [z > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0] });
      r.add(ring, glass);
    });
    const f = flame(k);
    f.visible = false;
    r.add(f);
    r.userData.flame = f;
    r.userData.nozzle = [0, -0.02, 0];
    return r;
  }
  /* Magnifying glass: ring + glass in the XY plane, handle down -Y. Origin = where the hand holds it */
  function magnifier(k) {
    const m = group(
      k,
      part(k, torus(k, 0.085, 0.016), "yellow", { p: [0, 0.2, 0] }),
      part(k, lathe(k, [[0, 0], [0.075, 0]], 28), tinted(k, "screen", { color: 0xcfe8ff, opacity: 0.35, roughness: 0.05 }), { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0] }),
      part(k, lathe(k, [[0, -0.02], [0.018, -0.02], [0.02, 0.1], [0.012, 0.115], [0.012, 0.115], [0, 0.115]]), "black", { p: [0, 0, 0] }),
    );
    return m;
  }
  const BUILD = { bazooka, rocket, magnifier };

  /* ---------- use ---------- */
  /* the prop, built on first use, attached to `parent` (a joint) and visible */
  function show(rig, name, parent, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
    if (!rig || !rig.ready) return null;
    const built = rig.node(name); // a prop that is already part of the model (hammerR, torchL ...)
    if (built && !BUILD[name]) {
      built.traverse((o) => (o.visible = true));
      rig.render();
      return built;
    }
    const k = kit(rig);
    let prop = k.props[name];
    if (!prop) prop = k.props[name] = BUILD[name](k);
    if (prop.parent !== parent) parent.add(prop);
    prop.position.set(p[0], p[1], p[2]);
    prop.rotation.set(r[0], r[1], r[2]);
    if (Array.isArray(s)) prop.scale.set(s[0], s[1], s[2]);
    else prop.scale.setScalar(s);
    prop.visible = true;
    rig.render();
    return prop;
  }
  /* hide every prop (ours and the model's own hammer / torch) */
  function hideAll(rig) {
    if (!rig || !rig.ready) return;
    const k = kits.get(rig);
    if (k)
      Object.values(k.props).forEach((p) => {
        p.visible = false;
        if (p.userData.flame) p.userData.flame.visible = false;
        if (p.parent) p.parent.remove(p);
      });
    ["hammerL", "hammerR", "torchL", "torchR"].forEach((n) => {
      const o = rig.node(n);
      if (o) o.traverse((c) => (c.visible = false));
    });
    rig.render();
  }
  function dispose(rig) {
    const k = kits.get(rig);
    if (!k) return;
    hideAll(rig);
    k.geos.forEach((g) => g.dispose());
    k.copies.forEach((m) => m.dispose());
    kits.delete(rig);
  }
  return { show, hideAll, dispose };
})();
