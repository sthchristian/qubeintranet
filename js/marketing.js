/* marketing.js
 * MARKETING: the "Marketing" sidebar view (#marketing). Company tools, templates, slide decks,
 * website assets and brand resources in one place.
 *
 * What it does:
 *   - Quick Launch: pill cards for the external tools (Figma, Canva, Pitch, the shared brand drive).
 *     They open in a new tab.
 *   - Color palette: a card in the library (Brand Kit & Logos). "Open palette" shows one tab per
 *     company / business area (Core, Talent, Consulting, AI, POC Studio, supporting accents), from
 *     assets/brand/qualipro-color-palette.svg. One click copies HEX or RGB; the last tab is remembered.
 *   - Resource library: search + category pills + cards. "Open" shows what the resource contains,
 *     with downloads: the real files in assets/brand/ where they exist, otherwise an outline
 *     of the template (.txt). The email signature is generated for the signed-in person.
 *     Files show as thumbnails; tapping one opens a large preview before downloading ("File preview").
 *     "Copy link" copies "#marketing/<id>", which opens that resource.
 *   - Admin Mode (padlock in the top bar, js/app.js): + Add resource, + Add tool, and edit / delete
 *     on cards and tools. Deleting asks first (window.qp.confirmDelete).
 *
 * Saved in the browser ("qp-marketing"). Sample tools and six resources are added the first time.
 * The external tool links are the platforms' own start pages until an admin enters the team's links.
 * Styling: css/marketing.css, plus the Knowledge Hub's cards, toolbar and pills (.kb-*).
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('.view[data-view="marketing"]');
  if (!view || !window.qp) return;
  const { showModal, closeModal, confirmDelete, esc } = window.qp;

  const KEY = "qp-marketing";
  const BRAND_DIR = "assets/brand/gold-cream-cube/";
  const CATS = {
    slides: { label: "Slides & Presentations", icon: "i-mk-slides" },
    web: { label: "Websites & UI Assets", icon: "i-mk-web" },
    brand: { label: "Brand Kit & Logos", icon: "i-mk-palette" },
    docs: { label: "Documents & Proposals", icon: "i-doc" },
  };
  const TOOL_ICONS = {
    design: { label: "Design", icon: "i-mk-pen" },
    brand: { label: "Brand", icon: "i-mk-palette" },
    slides: { label: "Slides", icon: "i-mk-slides" },
    drive: { label: "Drive / folder", icon: "i-mk-folder" },
    link: { label: "Link", icon: "i-link" },
  };

  /* ---------- Color palettes ----------
   * From QualiPro's colour palette sheet (assets/brand/qualipro-color-palette.svg): one tab per
   * company / business area, each with its colours and the words the brand gives them.
   * To add a palette or a colour, add it here; the tabs are built from this list. */
  const c = (name, hex, words, note) => ({ name, hex, words, note });
  const PALETTES = [
    {
      id: "core",
      name: "QualiPro Core",
      sub: "Our brand foundation",
      badge: "Q",
      colors: [
        c("Q Charcoal", "#111214", ["Stability", "Trust", "Professionalism"]),
        c("Warm Canvas", "#F6F2EA", ["Neutral base", "Calm", "Space", "Premium feel"]),
        c("Logo Grey", "#6F7073", [], "Only for the logo on dark backgrounds"),
      ],
    },
    {
      id: "talent",
      name: "QualiPro Talent",
      sub: "Talent for the future",
      badge: "T",
      colors: [c("Q Gold", "#FFB817", ["Energy", "Opportunities", "Focus", "Optimism"]), c("Cream Soda", "#FFF0C9", ["Warmth", "Humanity", "Inclusive", "Forward-looking"])],
    },
    {
      id: "consulting",
      name: "QualiPro Consulting",
      sub: "Expertise that delivers",
      badge: "C",
      colors: [c("Digital Aqua", "#22B8B6", ["Technology", "Competence", "Clarity", "Change"]), c("Aqua Foam", "#8FFFE0", ["Innovation", "Movement", "Future", "Enabling"])],
    },
    {
      id: "ai",
      name: "QualiPro AI",
      sub: "Intelligence in practice",
      badge: "A",
      colors: [c("Cyber Grape", "#6D28D9", ["Intelligence", "Innovation", "AI", "Future"]), c("Violet Mist", "#EDE3FF", ["Creativity", "Experiment", "Insight", "New possibilities"])],
    },
    {
      id: "poc",
      name: "POC Studio",
      sub: "From idea to reality",
      badge: "P",
      colors: [c("POC Green", "#79BE5D", ["Experiment", "Innovation", "Learning", "Collaboration"]), c("POC Orange", "#D55625", ["Build", "Test", "Iterate", "Results"])],
    },
    {
      id: "accents",
      name: "Supporting accents",
      sub: "For graphic details",
      badge: "",
      colors: [
        c("Magenta", "#BE185D", ["Passion", "Drive", "People"]),
        c("Sky", "#E0F2FE", ["Growth", "Openness", "Opportunities"]),
        c("Mint", "#D1FAE5", ["Balance", "Sustainability", "Future"]),
        c("Blush", "#FCE7F3", ["Inclusion", "Community", "Humanity"]),
      ],
    },
  ];
  const PALETTE_FILE = "assets/brand/qualipro-color-palette.svg";
  /* The palette is one of the library cards: "Open palette" shows the tabs in the shared window */
  const PALETTE_ITEM = () => ({
    id: "color-palette",
    cat: "brand",
    palette: true,
    title: "QualiPro Color Palette",
    type: "6 palettes · HEX & RGB",
    desc: "The colours of every QualiPro company and area: Core, Talent, Consulting, AI, POC Studio and supporting accents, with HEX and RGB.",
    files: [{ name: "QualiPro colour palette (all companies)", href: PALETTE_FILE }],
    updated: "2026-11-25",
  });
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  /* dark text on light colours, white on dark ones (relative luminance) */
  const isLight = (hex) => {
    const [r, g, b] = rgbOf(hex).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
  };

  /* ---------- Sample content (the first time) ---------- */
  const f = (name, file, note) => ({ name, href: BRAND_DIR + file, note });
  function samples() {
    return {
      tools: [
        { id: "figma", name: "Figma Design System", sub: "Components & UI library", url: "https://www.figma.com/files/", icon: "design" },
        { id: "canva", name: "Canva Brand Kit", sub: "Social posts & one-pagers", url: "https://www.canva.com/brand/", icon: "brand" },
        { id: "pitch", name: "Pitch / Slides", sub: "Company deck templates", url: "https://pitch.com/", icon: "slides" },
        { id: "drive", name: "Shared Brand Drive", sub: "Logos, photos & exports", url: "https://drive.google.com/drive/shared-drives", icon: "drive" },
      ],
      items: [
        PALETTE_ITEM(),
        {
          id: "pitch-deck",
          cat: "slides",
          title: "Client Pitch & Sales Slide Deck",
          type: "PPTX · Google Slides template",
          desc: "The 10-slide QualiPro sales deck: who we are, services, case results and pricing, ready to tailor for each client.",
          outline: ["Title slide with client logo", "Who we are: QualiPro in numbers", "The client's challenge", "Our approach in four steps", "Services and tech stack", "Two case studies with results", "Team and roles", "Timeline and next steps", "Pricing options", "Contact and thank you"],
          updated: "2026-11-10",
        },
        {
          id: "kickoff-deck",
          cat: "slides",
          title: "Project Kickoff & Architecture Presentation",
          type: "Internal & client deck",
          desc: "Kickoff template for new projects: goals, scope, team, architecture overview, risks and the first sprint plan.",
          outline: ["Project goals and success criteria", "Scope: in and out", "Team, roles and contacts", "Architecture overview diagram", "Environments and CI/CD", "Risks and mitigations", "Communication plan", "Sprint 1 plan"],
          updated: "2026-10-28",
        },
        {
          id: "ui-kit",
          cat: "web",
          title: "Website UI Kit & Component Assets",
          type: "SVG · Figma components",
          desc: "Hero banners, app icons and the glass cube for websites and mockups, in light and dark versions.",
          files: [
            f("Hero banner (dark)", "qube-banner-dark.svg"),
            f("Hero banner (light)", "qube-banner-light.svg"),
            f("Glass cube for dark backgrounds", "qube-cube-glass-for-dark-bg.svg"),
            f("Glass cube for light backgrounds", "qube-cube-glass-for-light-bg.svg"),
            f("App icon (dark)", "qube-app-icon-dark.svg"),
            f("App icon (light)", "qube-app-icon-light.svg"),
          ],
          updated: "2026-11-18",
        },
        {
          id: "logo-pack",
          cat: "brand",
          title: "Official QualiPro Logo & Favicons Pack",
          type: "SVG · light & dark variants",
          desc: "Every approved logo: horizontal, stacked, wordmark, monogram and favicon, with the brand sheet that shows how to use them.",
          files: [
            { name: "QualiPro colour palette (all companies)", href: PALETTE_FILE },
            f("Brand sheet (usage guide)", "qube-brand-sheet.svg"),
            f("Horizontal logo (for light backgrounds)", "qube-logo-horizontal-light-transparent.svg"),
            f("Horizontal logo (for dark backgrounds)", "qube-logo-horizontal-dark-transparent.svg"),
            f("Stacked logo (light)", "qube-logo-stacked-light.svg"),
            f("Stacked logo (dark)", "qube-logo-stacked-dark.svg"),
            f("Wordmark (light)", "qube-wordmark-light.svg"),
            f("Wordmark (dark)", "qube-wordmark-dark.svg"),
            f("Monogram Q in cube", "qube-monogram-q-in-cube-light.svg"),
            f("Favicon", "qube-favicon.svg"),
          ],
          updated: "2026-11-18",
        },
        {
          id: "proposal-template",
          cat: "docs",
          title: "Client Proposal & Case Study Template",
          type: "DOCX · PDF layout",
          desc: "Branded proposal with cover, executive summary, scope, timeline and pricing, plus a one-page case study layout.",
          outline: ["Cover page with client name and date", "Executive summary (half a page)", "Background and goals", "Proposed solution", "Scope and deliverables", "Timeline", "Team", "Pricing and terms", "Case study: challenge, solution, result", "Signature page"],
          updated: "2026-09-30",
        },
        {
          id: "social-kit",
          cat: "brand",
          title: "Social Media & Email Signature Kit",
          type: "LinkedIn banners · HTML signature",
          desc: "LinkedIn banners in light and dark, and your personal HTML email signature, generated with your name and title.",
          files: [f("LinkedIn banner (dark)", "qube-banner-dark.svg"), f("LinkedIn banner (light)", "qube-banner-light.svg")],
          signature: true,
          updated: "2026-11-05",
        },
      ],
    };
  }

  let data = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && Array.isArray(v.tools) && Array.isArray(v.items)) return v;
    } catch (e) {}
    return null;
  })();
  if (!data) {
    data = samples();
    data.paletteCard = true;
    save();
  }
  /* saved before the palette card existed: add it once (an admin who deletes it later keeps it deleted) */
  if (!data.paletteCard) {
    if (!data.items.some((x) => x.id === "color-palette")) data.items.unshift(PALETTE_ITEM());
    data.paletteCard = true;
    save();
  }
  /* saved before the colour palette sheet existed: add it to the logo pack once */
  const pack = data.items.find((x) => x.id === "logo-pack");
  if (pack && pack.files && !pack.files.some((fl) => fl.href === PALETTE_FILE)) {
    pack.files.unshift({ name: "QualiPro colour palette (all companies)", href: PALETTE_FILE });
    save();
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      notify("Couldn't save: the browser's storage is full.");
      return false;
    }
  }
  const findItem = (id) => data.items.find((x) => x.id === id);
  const findTool = (id) => data.tools.find((x) => x.id === id);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const sym = (id, cls = "ico") => `<svg class="${cls}"><use href="#${id}" /></svg>`;
  const noTr = (x) => (x.user ? " data-no-tr" : ""); // what admins type is shown as written
  const itemUrl = (id) => location.href.split("#")[0] + "#marketing/" + encodeURIComponent(id);

  async function copyText(text, done) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const t = Object.assign(document.createElement("textarea"), { value: text });
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      if (!ok) return notify("Couldn't copy. Select the text and copy it by hand.");
    }
    notify(done);
  }
  /* https only for links people add; "figma.com/x" becomes "https://figma.com/x" */
  function cleanUrl(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
    try {
      const u = new URL(v);
      return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- Quick Launch ---------- */
  const toolsEl = $("#mk-tools");
  function renderTools() {
    toolsEl.innerHTML =
      data.tools
        .map(
          (t) => `<div class="mk-tool-wrap">
          <a class="mk-tool" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">
            <span class="mk-tool-ico">${sym((TOOL_ICONS[t.icon] || TOOL_ICONS.link).icon)}</span>
            <span class="mk-tool-txt"><strong${noTr(t)}>${esc(t.name)}</strong><small${noTr(t)}>${esc(t.sub || "")}</small></span>
            ${sym("i-ext", "ico mk-ext")}
          </a>
          <span class="mk-admin-tools" data-admin-mode-only${isAdminMode() ? "" : " hidden"}>
            <button type="button" class="mk-mini" data-mk-edit-tool="${esc(t.id)}" aria-label="Edit ${esc(t.name)}" title="Edit">${sym("i-edit")}</button>
            <button type="button" class="mk-mini is-del" data-mk-del-tool="${esc(t.id)}" aria-label="Delete ${esc(t.name)}" title="Delete">${sym("i-trash")}</button>
          </span>
        </div>`,
        )
        .join("") +
      `<button type="button" class="mk-tool mk-tool-add" data-admin-mode-only${isAdminMode() ? "" : " hidden"} data-mk-add-tool>${sym("i-plus")}<span>Add tool</span></button>`;
  }

  /* ---------- Color palette: tabs + swatches ---------- */
  const PAL_KEY = "qp-palette-tab";
  let palTab = (() => {
    try {
      return localStorage.getItem(PAL_KEY) || "core";
    } catch (e) {
      return "core";
    }
  })();
  if (!PALETTES.some((p) => p.id === palTab)) palTab = "core";
  const palColor = (p) => (p.colors[0] || {}).hex || "#FFB817";
  function renderPalette() {
    if (!$("#mk-pal-tabs")) return; // only while the palette window is open
    $("#mk-pal-tabs").innerHTML = PALETTES.map(
      (p) => `<button type="button" role="tab" class="mk-pal-tab" id="mk-tab-${p.id}" data-mk-pal="${p.id}" aria-selected="${p.id === palTab}" aria-controls="mk-pal-panel" tabindex="${p.id === palTab ? 0 : -1}">
          ${p.badge ? `<span class="mk-pal-badge" style="background:${palColor(p)};color:${isLight(palColor(p)) ? "#111214" : "#fff"}" aria-hidden="true">${p.badge}</span>` : `<span class="mk-pal-dots" aria-hidden="true">${p.colors.map((x) => `<i style="background:${x.hex}"></i>`).join("")}</span>`}
          <span data-no-tr>${p.name.replace(/^QualiPro /, "")}</span>
        </button>`,
    ).join("");
    const p = PALETTES.find((x) => x.id === palTab);
    /* on narrow screens the tab row scrolls: keep the chosen tab in view */
    const tabs = $("#mk-pal-tabs"),
      cur = $("#mk-tab-" + p.id);
    tabs.scrollLeft = Math.max(0, cur.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - cur.offsetWidth) / 2);
    const panel = $("#mk-pal-panel");
    panel.setAttribute("aria-labelledby", "mk-tab-" + p.id);
    panel.innerHTML = `<div class="mk-pal-head"><strong data-no-tr>${p.name}</strong><small>${p.sub}</small></div>
      <div class="mk-swatches">${p.colors
        .map((x) => {
          const rgb = rgbOf(x.hex).join(", ");
          return `<div class="mk-color">
            <button type="button" class="mk-color-fill${isLight(x.hex) ? " is-light" : ""}" style="background:${x.hex}" data-mk-copy="${x.hex}" title="Copy ${x.hex}">
              <strong>${x.name}</strong><code data-no-tr>${x.hex}</code>
              <span class="mk-color-copy">${sym("i-copy")}<span>Copy HEX</span></span>
            </button>
            <div class="mk-color-info">
              <button type="button" class="mk-rgb" data-mk-copy="rgb(${rgb})" title="Copy rgb(${rgb})"><span>RGB</span> <code data-no-tr>${rgbOf(x.hex).join(" ")}</code>${sym("i-copy")}</button>
              ${x.words.length ? `<span class="mk-words">${x.words.map((w) => `<span>${w}</span>`).join("")}</span>` : ""}
              ${x.note ? `<small class="mk-note">${x.note}</small>` : ""}
            </div>
          </div>`;
        })
        .join("")}</div>`;
  }
  function selectPalette(id, focus) {
    palTab = id;
    try {
      localStorage.setItem(PAL_KEY, id);
    } catch (e) {}
    renderPalette();
    if (focus) $("#mk-tab-" + id).focus();
  }

  /* arrow keys / Home / End move between the tabs (standard tab pattern) */
  document.addEventListener("keydown", (e) => {
    if (!e.target.closest || !e.target.closest("#mk-pal-tabs")) return;
    const i = PALETTES.findIndex((p) => p.id === palTab),
      n = PALETTES.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    selectPalette(PALETTES[to].id, true);
  });

  /* ---------- Library ---------- */
  const grid = $("#mk-grid"),
    chips = $("#mk-filters"),
    q = $("#mk-q"),
    countEl = $("#mk-count"),
    empty = $("#mk-empty");
  let cat = "all";
  function renderChips() {
    const n = (c) => (c === "all" ? data.items.length : data.items.filter((x) => x.cat === c).length);
    chips.innerHTML = ["all", ...Object.keys(CATS)]
      .map(
        (c) =>
          `<button type="button" class="kb-chip${c === cat ? " active" : ""}" data-mk-cat="${c}" aria-pressed="${c === cat}">${c === "all" ? "All" : CATS[c].label}<span class="kb-chip-n">${n(c)}</span></button>`,
      )
      .join("");
  }
  function prettyDate(d) {
    const sv = document.documentElement.lang === "sv";
    return new Date(d + "T12:00:00").toLocaleDateString(sv ? "sv-SE" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function card(x) {
    return `<article class="tile kb-card mk-card" data-mk-card="${esc(x.id)}">
        <div class="kb-card-top">
          <span class="news-ico">${sym(CATS[x.cat].icon)}</span>
          <span class="pill muted">${CATS[x.cat].label}</span>
          <span class="mk-card-admin" data-admin-mode-only${isAdminMode() ? "" : " hidden"}>
            <button type="button" class="mk-mini" data-mk-edit="${esc(x.id)}" aria-label="Edit" title="Edit">${sym("i-edit")}</button>
            <button type="button" class="mk-mini is-del" data-mk-del="${esc(x.id)}" aria-label="Delete" title="Delete">${sym("i-trash")}</button>
          </span>
        </div>
        <strong${noTr(x)}>${esc(x.title)}</strong>
        <small${noTr(x)}>${esc(x.desc)}</small>
        <span class="kb-meta"><span${noTr(x)}>${esc(x.type)}</span><br /><span>Updated</span> ${prettyDate(x.updated)}</span>
        <span class="kb-actions">
          <button class="btn primary" type="button" data-mk-open="${esc(x.id)}">${x.palette ? "Open palette" : x.url && !x.files && !x.outline ? "Open ↗" : "Open / Download"}</button>
          <button class="btn" type="button" data-mk-link="${esc(x.id)}">${sym("i-link")}Copy link</button>
        </span>
      </article>`;
  }
  function renderGrid() {
    renderChips();
    const term = q.value.trim().toLowerCase();
    const list = data.items
      .filter((x) => cat === "all" || x.cat === cat)
      .filter(
        (x) =>
          !term ||
          [x.title, x.desc, x.type, CATS[x.cat].label, tr(x.title), tr(x.desc), tr(x.type), x.palette ? "colour color palette hex rgb " + PALETTES.flatMap((p) => [p.name, ...p.colors.map((c) => c.name + " " + c.hex)]).join(" ") : ""]
            .join(" ")
            .toLowerCase()
            .includes(term),
      )
      .sort((a, b) => b.updated.localeCompare(a.updated));
    grid.innerHTML = list.map(card).join("");
    grid.hidden = !list.length;
    empty.hidden = !!list.length;
    countEl.textContent = list.length === 1 ? "1 resource" : `${list.length} resources`;
  }

  /* ---------- Open a resource (shared window): contents + downloads ---------- */
  function signatureHtml() {
    return `<!-- QualiPro email signature: paste into Outlook / Apple Mail / Gmail signature settings -->
<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#111214">
  <tr>
    <td style="padding-right:14px;border-right:3px solid #FFB817"><strong style="font-size:15px">Alex Lindqvist</strong><br />
      <span style="font-size:12px;color:#515151">Software Engineer · QualiPro</span></td>
    <td style="padding-left:14px;font-size:12px;color:#515151">Stockholm<br /><span style="color:#111214;font-weight:bold">QUBE</span> · The QualiPro Intranet</td>
  </tr>
</table>
`;
  }
  function downloadText(name, text, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function outlineText(x) {
    return [x.title, "=".repeat(x.title.length), `${x.type} · ${CATS[x.cat].label}`, "", x.desc, "", "Contents", "--------", ...x.outline.map((o, i) => `${i + 1}. ${tr(o)}`), "", "— QualiPro Marketing hub"].join("\n");
  }
  function openItem(id, { fromHistory = false } = {}) {
    const x = findItem(id);
    if (!x) return;
    if (view.hidden) showView("marketing", { push: !fromHistory });
    const hash = "#marketing/" + encodeURIComponent(id);
    if (!fromHistory && location.hash !== hash) history.replaceState(null, "", hash);
    $("#modal .modal").classList.toggle("mk-pal-modal", !!x.palette); // the palette needs a wider window
    viewFiles = (x.files || []).map((fl) => ({ ...fl, user: x.user }));
    /* thumbnails: see a file before downloading it; tap one for the large preview (viewer below) */
    const files = viewFiles
      .map(
        (fl, i) => `<figure class="mk-thumb">
          <button type="button" class="mk-thumb-img ${bgFor(fl.href)}" data-mk-preview="${i}" aria-label="Preview ${esc(fl.name)}">
            ${isImage(fl.href) ? `<img src="${esc(fl.href)}" alt="" loading="lazy" decoding="async" />` : `<span class="mk-thumb-ext">${esc(extOf(fl.href))}</span>`}
            <span class="mk-thumb-zoom">${sym("i-search")}</span>
          </button>
          <figcaption><strong${noTr(x)}>${esc(fl.name)}</strong><small data-no-tr>${esc(extOf(fl.href))}</small></figcaption>
          <a class="mk-thumb-dl" href="${esc(fl.href)}" download aria-label="Download ${esc(fl.name)}" title="Download">${sym("i-download")}</a>
        </figure>`,
      )
      .join("");
    showModal({
      kicker: CATS[x.cat].label,
      title: x.title,
      html: `<p class="kb-doc-meta"><span${noTr(x)}>${esc(x.type)}</span> · <span>Updated</span> ${prettyDate(x.updated)}</p>
        <p${noTr(x)}>${esc(x.desc)}</p>
        ${
          x.palette
            ? `<p class="mk-pal-hint">Click a colour to copy its HEX, or the RGB button for rgb().</p>
          <div class="mk-pal-tabs" id="mk-pal-tabs" role="tablist" aria-label="Palettes"></div>
          <div class="mk-pal-panel" id="mk-pal-panel" role="tabpanel" tabindex="0"></div>`
            : ""
        }
        ${x.url ? `<a class="btn primary mk-wide" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${sym("i-ext")}<span>Open in a new tab</span></a>` : ""}
        ${x.outline ? `<h3 class="mk-h">Contents</h3><ol class="mk-outline">${x.outline.map((o) => `<li${noTr(x)}>${esc(o)}</li>`).join("")}</ol>
          <button type="button" class="btn mk-wide" data-mk-dl-outline="${esc(x.id)}">${sym("i-download")}<span>Download outline (.txt)</span></button>` : ""}
        ${files ? `<h3 class="mk-h">${x.palette ? "Download" : "Files"} <span>${viewFiles.length > 1 ? "Tap a file to preview it" : "Tap to preview"}</span></h3><div class="mk-thumbs">${files}</div>` : ""}
        ${x.signature ? `<h3 class="mk-h">Your email signature</h3><div class="mk-sig" data-no-tr>${signatureHtml()}</div>
          <div class="mk-row"><button type="button" class="btn" data-mk-copy-sig>${sym("i-copy")}<span>Copy HTML</span></button><button type="button" class="btn" data-mk-dl-sig>${sym("i-download")}<span>Download .html</span></button></div>` : ""}`,
    });
    if (x.palette) renderPalette();
  }

  /* ---------- File preview ----------
     Thumbnails in the resource window; tapping one opens a large preview on top of it with the
     file's name, type and size, a Download button, and ‹ › (arrow keys, or swipe on a phone) to
     go through the files. The background can be switched so light and dark logos both show well.
     Esc / ✕ / a click outside the picture closes only the preview. */
  let viewFiles = [],
    viewAt = 0,
    viewBg = null,
    viewReturn = null;
  const extOf = (href) => (href.split(".").pop() || "").toUpperCase();
  const isImage = (href) => /\.(svg|png|jpe?g|webp|gif)$/i.test(href);
  /* files made for dark backgrounds ("…dark…") are shown on charcoal, light ones on canvas */
  const bgFor = (href) => (/dark/i.test(href) ? "bg-dark" : /light/i.test(href) ? "bg-light" : "bg-check");
  const sizes = {};
  const viewer = document.createElement("div");
  viewer.className = "mk-viewer";
  viewer.id = "mk-viewer";
  viewer.hidden = true;
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-labelledby", "mk-viewer-title");
  viewer.innerHTML = `<div class="mk-viewer-box">
      <div class="mk-viewer-top">
        <div class="mk-viewer-name"><strong id="mk-viewer-title"></strong><small id="mk-viewer-meta"></small></div>
        <span class="mk-viewer-count" id="mk-viewer-count"></span>
        <button type="button" class="icon-btn" data-mk-view="close" aria-label="Close preview">✕</button>
      </div>
      <div class="mk-viewer-stage" id="mk-viewer-stage">
        <button type="button" class="mk-viewer-nav prev" data-mk-view="prev" aria-label="Previous file">${sym("i-chev")}</button>
        <img id="mk-viewer-img" alt="" />
        <button type="button" class="mk-viewer-nav next" data-mk-view="next" aria-label="Next file">${sym("i-chev")}</button>
      </div>
      <div class="mk-viewer-bottom">
        <div class="mk-viewer-bgs" role="group" aria-label="Background">
          <button type="button" class="bg-dark" data-mk-bg="bg-dark" aria-label="Dark background" title="Dark background"></button>
          <button type="button" class="bg-light" data-mk-bg="bg-light" aria-label="Light background" title="Light background"></button>
          <button type="button" class="bg-check" data-mk-bg="bg-check" aria-label="Transparent (checkerboard)" title="Transparent"></button>
        </div>
        <a class="btn primary mk-viewer-dl" id="mk-viewer-dl" download>${sym("i-download")}<span>Download</span></a>
      </div>
    </div>`;
  document.body.appendChild(viewer);
  const vImg = $("#mk-viewer-img"),
    vStage = $("#mk-viewer-stage");
  function showFile(i) {
    const n = viewFiles.length;
    viewAt = (i + n) % n;
    const fl = viewFiles[viewAt];
    vImg.src = fl.href;
    vImg.alt = fl.user ? fl.name : tr(fl.name);
    const title = $("#mk-viewer-title");
    title.textContent = fl.user ? fl.name : tr(fl.name);
    title.toggleAttribute("data-no-tr", !!fl.user);
    const meta = $("#mk-viewer-meta"),
      file = fl.href.split("/").pop();
    meta.textContent = sizes[fl.href] ? `${file} · ${sizes[fl.href]}` : file;
    if (!sizes[fl.href])
      fetch(fl.href, { method: "HEAD" })
        .then((r) => {
          const b = +r.headers.get("content-length");
          if (!b) return;
          sizes[fl.href] = b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
          if (viewFiles[viewAt] === fl) meta.textContent = `${file} · ${sizes[fl.href]}`;
        })
        .catch(() => {});
    $("#mk-viewer-count").textContent = n > 1 ? `${viewAt + 1} / ${n}` : "";
    viewer.classList.toggle("is-single", n < 2);
    const dl = $("#mk-viewer-dl");
    dl.href = fl.href;
    dl.setAttribute("download", file);
    setBg(viewBg || bgFor(fl.href), false);
  }
  function setBg(bg, pinned = true) {
    if (pinned) viewBg = bg; // a background picked by hand stays while flipping through files
    vStage.className = "mk-viewer-stage " + bg;
    viewer.querySelectorAll("[data-mk-bg]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mkBg === bg));
  }
  function openViewer(i, from) {
    viewReturn = from || document.activeElement;
    viewBg = null;
    viewer.hidden = false;
    document.body.classList.add("mk-viewing");
    showFile(i);
    $("#mk-viewer-dl").focus({ preventScroll: true });
  }
  function closeViewer() {
    if (viewer.hidden) return;
    viewer.hidden = true;
    document.body.classList.remove("mk-viewing");
    vImg.removeAttribute("src");
    if (viewReturn && viewReturn.isConnected) viewReturn.focus({ preventScroll: true });
  }
  viewer.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mk-view], [data-mk-bg]");
    if (b && b.dataset.mkBg) return setBg(b.dataset.mkBg);
    if (b) return b.dataset.mkView === "close" ? closeViewer() : showFile(viewAt + (b.dataset.mkView === "next" ? 1 : -1));
    if (e.target === viewer) closeViewer(); // the dimmed area around the box
  });
  /* the preview handles its keys first, so Esc doesn't also close the resource window */
  addEventListener(
    "keydown",
    (e) => {
      if (viewer.hidden) return;
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowRight" && viewFiles.length > 1) showFile(viewAt + 1);
      else if (e.key === "ArrowLeft" && viewFiles.length > 1) showFile(viewAt - 1);
      else if (e.key === "Tab") {
        /* keep the keyboard inside the preview */
        const f = [...viewer.querySelectorAll("button, a[href]")].filter((el) => el.offsetParent !== null);
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  /* swipe left / right on the picture (phones) */
  let swipeX = null;
  vStage.addEventListener("pointerdown", (e) => (swipeX = e.clientX));
  vStage.addEventListener("pointerup", (e) => {
    if (swipeX === null || viewFiles.length < 2) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 45) showFile(viewAt + (dx < 0 ? 1 : -1));
  });
  /* closing the resource window also closes a preview on top of it */
  new MutationObserver(() => $("#modal").hidden && closeViewer()).observe($("#modal"), { attributeFilter: ["hidden"] });

  /* ---------- Admin: add / edit resources and tools ---------- */
  function itemForm(x) {
    const v = x || { cat: cat === "all" ? "slides" : cat, title: "", type: "", desc: "", url: "", outline: [] };
    showModal({
      kicker: "Marketing · Admin Mode",
      title: x ? "Edit resource" : "Add resource / template",
      html: `<form class="admin-form mk-form" id="mk-item-form" data-id="${x ? esc(x.id) : ""}" autocomplete="off" novalidate>
          <label class="admin-field"><span>Title</span><input class="field" name="title" maxlength="100" value="${esc(x ? tr(v.title) : "")}" required /></label>
          <div class="admin-cols">
            <label class="admin-field"><span>Category</span><select class="field" name="cat">${Object.entries(CATS)
              .map(([k, c]) => `<option value="${k}"${k === v.cat ? " selected" : ""}>${c.label}</option>`)
              .join("")}</select></label>
            <label class="admin-field"><span>File / tool type</span><input class="field" name="type" maxlength="60" placeholder="PPTX · Google Slides" value="${esc(x ? tr(v.type) : "")}" /></label>
          </div>
          <label class="admin-field"><span>Description</span><textarea class="field" name="desc" rows="3" maxlength="300" required>${esc(x ? tr(v.desc) : "")}</textarea></label>
          <label class="admin-field"><span>Link <i>(optional: Google Slides, Figma, Drive…)</i></span><input class="field" name="url" inputmode="url" placeholder="https://…" value="${esc(v.url || "")}" /></label>
          <label class="admin-field"><span>Contents <i>(optional, one per line)</i></span><textarea class="field" name="outline" rows="4" maxlength="2000">${esc((v.outline || []).map((o) => (x && !x.user ? tr(o) : o)).join("\n"))}</textarea></label>
          <p class="fm-error" id="mk-error" role="alert" hidden></p>
          <div class="modal-foot"><button type="button" class="btn" data-mk-cancel>Cancel</button><button type="submit" class="btn primary">${x ? "Save changes" : "Add resource"}</button></div>
        </form>`,
    });
    $("#mk-item-form [name=title]").focus();
  }
  function toolForm(t) {
    const v = t || { name: "", sub: "", url: "", icon: "link" };
    showModal({
      kicker: "Marketing · Admin Mode",
      title: t ? "Edit tool" : "Add tool",
      html: `<form class="admin-form mk-form" id="mk-tool-form" data-id="${t ? esc(t.id) : ""}" autocomplete="off" novalidate>
          <label class="admin-field"><span>Name</span><input class="field" name="name" maxlength="40" value="${esc(t ? tr(v.name) : "")}" required /></label>
          <label class="admin-field"><span>Short description</span><input class="field" name="sub" maxlength="50" value="${esc(t ? tr(v.sub) : "")}" /></label>
          <div class="admin-cols">
            <label class="admin-field"><span>Link</span><input class="field" name="url" inputmode="url" placeholder="https://…" value="${esc(v.url)}" required /></label>
            <label class="admin-field"><span>Icon</span><select class="field" name="icon">${Object.entries(TOOL_ICONS)
              .map(([k, i]) => `<option value="${k}"${k === v.icon ? " selected" : ""}>${i.label}</option>`)
              .join("")}</select></label>
          </div>
          <p class="fm-error" id="mk-error" role="alert" hidden></p>
          <div class="modal-foot"><button type="button" class="btn" data-mk-cancel>Cancel</button><button type="submit" class="btn primary">${t ? "Save changes" : "Add tool"}</button></div>
        </form>`,
    });
    $("#mk-tool-form [name=name]").focus();
  }
  const fail = (form, field, msg) => {
    const e = $("#mk-error");
    e.textContent = msg;
    e.hidden = false;
    form[field].focus();
  };
  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (form.id !== "mk-item-form" && form.id !== "mk-tool-form") return;
    e.preventDefault();
    if (!isAdminMode()) return notify("Unlock Admin Mode to make changes");
    const id = form.dataset.id;
    if (form.id === "mk-item-form") {
      const title = form.title.value.trim(),
        desc = form.desc.value.trim(),
        url = cleanUrl(form.url.value);
      if (!title) return fail(form, "title", "Add a title.");
      if (!desc) return fail(form, "desc", "Add a short description.");
      if (url === null) return fail(form, "url", "The link doesn't look right. Use a web address like https://example.com.");
      const outline = form.outline.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const old = id && findItem(id);
      const x = Object.assign(old || { id: newId() }, {
        user: true,
        cat: form.cat.value,
        title,
        desc,
        type: form.type.value.trim() || "Link",
        updated: new Date().toISOString().slice(0, 10),
      });
      if (url) x.url = url;
      else delete x.url;
      if (outline.length) x.outline = outline;
      else delete x.outline;
      if (!old) data.items.unshift(x);
      if (!save()) return;
      closeModal();
      if (!old) {
        cat = "all";
        q.value = "";
      }
      renderGrid();
      notify(old ? "Resource updated" : "Resource added");
      grid.querySelector(`[data-mk-open="${CSS.escape(x.id)}"]`)?.focus();
    } else {
      const name = form.name.value.trim(),
        url = cleanUrl(form.url.value);
      if (!name) return fail(form, "name", "Add a name.");
      if (!url) return fail(form, "url", "Add a valid link, like https://www.figma.com/…");
      const old = id && findTool(id);
      const t = Object.assign(old || { id: newId() }, { user: true, name, sub: form.sub.value.trim(), url, icon: form.icon.value });
      if (!old) data.tools.push(t);
      if (!save()) return;
      closeModal();
      renderTools();
      notify(old ? "Tool updated" : "Tool added");
    }
  });
  function askDelete(kind, id) {
    const x = kind === "tool" ? findTool(id) : findItem(id);
    if (!x) return;
    confirmDelete({
      kicker: "Marketing · Admin Mode",
      title: kind === "tool" ? "Delete this tool?" : "Delete this resource?",
      item: { name: tr(x.title || x.name), sub: kind === "tool" ? x.url : `${CATS[x.cat].label} · ${tr(x.type)}` },
      text: "It will be removed from the Marketing page for everyone. This can’t be undone.",
      onConfirm: () => {
        if (kind === "tool") data.tools = data.tools.filter((t) => t.id !== id);
        else data.items = data.items.filter((t) => t.id !== id);
        save();
        kind === "tool" ? renderTools() : renderGrid();
        notify(kind === "tool" ? "Tool deleted" : "Resource deleted");
      },
    });
  }

  /* ---------- Clicks ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target;
    let b;
    if (t.closest("[data-mk-cancel]")) return closeModal();
    if ((b = t.closest("[data-mk-pal]"))) return selectPalette(b.dataset.mkPal);
    if ((b = t.closest("[data-mk-copy]"))) return copyText(b.dataset.mkCopy, `Copied ${b.dataset.mkCopy}`);
    if ((b = t.closest("[data-mk-dl-outline]"))) {
      const x = findItem(b.dataset.mkDlOutline);
      downloadText(`${x.id}-outline.txt`, outlineText(x));
      return notify("Download started");
    }
    if (t.closest("[data-mk-copy-sig]")) return copyText(signatureHtml(), "Signature HTML copied");
    if (t.closest("[data-mk-dl-sig]")) {
      downloadText("qualipro-email-signature.html", signatureHtml(), "text/html");
      return notify("Download started");
    }
    if ((b = t.closest("[data-mk-preview]"))) return openViewer(+b.dataset.mkPreview, b);
    if (t.closest(".mk-thumb-dl, .mk-viewer-dl")) return notify("Download started");
  });
  view.addEventListener("click", (e) => {
    const t = e.target;
    let b;
    if ((b = t.closest("[data-mk-cat]"))) {
      cat = b.dataset.mkCat;
      renderGrid();
      return chips.querySelector(`[data-mk-cat="${cat}"]`).focus();
    }
    if ((b = t.closest("[data-mk-open]"))) {
      const x = findItem(b.dataset.mkOpen);
      if (x && x.url && !x.files && !x.outline) return window.open(x.url, "_blank", "noopener");
      return openItem(b.dataset.mkOpen);
    }
    if ((b = t.closest("[data-mk-link]"))) return copyText(itemUrl(b.dataset.mkLink), "Link copied");
    if (!isAdminMode()) return;
    if (t.closest("#mk-add")) return itemForm();
    if (t.closest("[data-mk-add-tool]")) return toolForm();
    if ((b = t.closest("[data-mk-edit]"))) return itemForm(findItem(b.dataset.mkEdit));
    if ((b = t.closest("[data-mk-edit-tool]"))) return toolForm(findTool(b.dataset.mkEditTool));
    if ((b = t.closest("[data-mk-del]"))) return askDelete("item", b.dataset.mkDel);
    if ((b = t.closest("[data-mk-del-tool]"))) return askDelete("tool", b.dataset.mkDelTool);
  });
  q.addEventListener("input", renderGrid);
  document.addEventListener("qp:adminmode", () => {
    renderTools();
    renderGrid();
  });
  /* "#marketing/<id>": a copied link opens that resource */
  const linked = () => {
    const m = location.hash.match(/^#marketing\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  addEventListener("popstate", () => linked() && openItem(linked(), { fromHistory: true }));
  /* closing the resource window gives the page its own address back */
  new MutationObserver(() => {
    if (!$("#modal").hidden) return;
    $("#modal .modal").classList.remove("mk-pal-modal");
    if (linked() && !view.hidden) history.replaceState(null, "", "#marketing");
  }).observe($("#modal"), { attributeFilter: ["hidden"] });

  renderTools();
  renderGrid();
  if (linked()) openItem(linked(), { fromHistory: true });
  window.qpMarketing = { openItem };
})();
