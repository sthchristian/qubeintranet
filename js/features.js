/* features.js
 * Intranet features on top of the dashboard:
 *   - DOCS: the tools and handbook documents that open in the modal
 *   - Modal (open / close / pin)
 *   - Quick access: pinned + recently opened (saved in localStorage)
 *   - Command palette (Cmd/Ctrl + K, or the search field in the top bar)
 *   - New hire checklist (saved in localStorage)
 *   - Team activity feed (example data, edit FEED_SEED / FEED_POOL)
 *   - Admin Panel: publish news articles and calendar events (saved in localStorage)
 *   - Dashboard layout: "Customize dashboard" drag-and-drop order (saved in localStorage)
 * Uses helpers from app.js ($, $$, notify, reduce, showView, toggleTheme, closeMenus, isAdmin).
 * The chat drawer lives in chat.js.
 */
(function () {
  /* ---------- Small helpers ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    },
  };
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + " h ago";
    return Math.round(h / 24) + " d ago";
  }

  /* =====================================================================
     DOCS: everything that opens in the modal. Add your own entries here.
     kind = "Tool" or "Handbook"; html = the modal content.
     ===================================================================== */
  const PEOPLE = [
    ["Alex Lindqvist", "Software Engineer", "Engineering"],
    ["Maja Berg", "Engineering Manager", "Engineering"],
    ["Jonas Ek", "DevOps Engineer", "Platform"],
    ["Sara Nyström", "People & Culture Lead", "HR"],
    ["Elias Holm", "IT Support Specialist", "IT"],
    ["Linnea Sjöberg", "UX Designer", "POC Studio"],
    ["Omar Haddad", "Security Engineer", "Platform"],
    ["Karin Åberg", "Consultant Manager", "Talent"],
  ];
  const initials = (n) =>
    n
      .split(" ")
      .map((p) => p[0])
      .join("");
  const DOCS = {
    devportal: {
      title: "Dev Portal",
      kind: "Tool",
      icon: "⌘",
      keys: "developer api docs services environments",
      html: `<p>Services, APIs and environments in one place.</p>
        <div class="rows">
          <button class="row" data-say="Opening API reference"><span><strong>API reference</strong><small>REST + event schemas for Core v4.2</small></span><span class="pill muted">Docs</span></button>
          <button class="row" data-say="Opening service catalog"><span><strong>Service catalog</strong><small>24 services · owners and on-call</small></span><span class="pill muted">Catalog</span></button>
          <button class="row" data-say="Opening design tokens"><span><strong>Design tokens</strong><small>Colours, type and spacing</small></span><span class="pill muted">UI</span></button>
        </div>
        <h4>Environments</h4>
        <div class="rows">
          <div class="row"><span><strong>Production</strong><small>core v4.2.0</small></span><span class="pill ok">Healthy</span></div>
          <div class="row"><span><strong>Staging</strong><small>core v4.3.0-rc1</small></span><span class="pill ok">Healthy</span></div>
          <div class="row"><span><strong>Development</strong><small>main @ a41f9c2</small></span><span class="pill">Deploying</span></div>
        </div>`,
    },
    cicd: {
      title: "CI/CD pipelines",
      kind: "Tool",
      icon: "↻",
      keys: "deploy deployment pipeline build release",
      html: `<p>Latest pipeline runs for your teams.</p>
        <div class="rows">
          <div class="row"><span><strong>core-api · main #1842</strong><small>Deploy to production · 3 min 12 s</small></span><span class="pill ok">Success</span></div>
          <div class="row"><span><strong>web-intranet · main #771</strong><small>Build and test · started 2 min ago</small></span><span class="pill">Running</span></div>
          <div class="row"><span><strong>data-ingest · feature/rag #310</strong><small>Integration tests · 2 failed</small></span><span class="pill bad">Failed</span></div>
          <div class="row"><span><strong>poc-retail-ai · main #58</strong><small>Deploy to staging · 1 min 47 s</small></span><span class="pill ok">Success</span></div>
        </div>
        <div class="modal-foot"><button class="btn" data-say="Re-running failed jobs (prototype)">Re-run failed</button><button class="btn primary" data-say="Opening full pipeline view">Open pipelines</button></div>`,
    },
    directory: {
      title: "Directory",
      kind: "Tool",
      icon: "◉",
      keys: "people colleagues contacts phone team",
      html: `<input class="field" id="dir-q" type="text" placeholder="Search people, roles or teams…" autocomplete="off" />
        <div class="rows" id="dir-list"></div>`,
      mount(body) {
        const q = body.querySelector("#dir-q"),
          list = body.querySelector("#dir-list");
        const draw = () => {
          const f = q.value.trim().toLowerCase();
          const rows = PEOPLE.filter((p) => p.join(" ").toLowerCase().includes(f));
          list.innerHTML = rows.length
            ? rows
                .map(
                  ([n, role, team]) =>
                    `<div class="row"><span class="avatar">${esc(initials(n))}</span><span><strong>${esc(n)}</strong><small>${esc(role)}</small></span><span class="pill muted">${esc(team)}</span></div>`,
                )
                .join("")
            : `<div class="row"><span><small>No one matches “${esc(q.value)}”.</small></span></div>`;
        };
        q.addEventListener("input", draw);
        draw();
      },
    },
    inventory: {
      title: "IT Inventory",
      kind: "Tool",
      icon: "▦",
      keys: "devices laptop hardware equipment access licences accounts",
      html: `<p>Devices and access registered to you.</p>
        <div class="rows">
          <div class="row"><span><strong>MacBook Pro 14"</strong><small>QP-LT-0412 · issued Mar 2025</small></span><span class="pill ok">Assigned</span></div>
          <div class="row"><span><strong>Dell UltraSharp 27" monitor</strong><small>QP-MN-0988 · home office</small></span><span class="pill ok">Assigned</span></div>
          <div class="row"><span><strong>YubiKey 5C NFC</strong><small>Primary security key</small></span><span class="pill">Register by Jun 15</span></div>
        </div>
        <h4>Access</h4>
        <div class="rows">
          <div class="row"><span><strong>GitHub · qualipro</strong><small>Engineering team · write</small></span><span class="pill ok">Active</span></div>
          <div class="row"><span><strong>Jira &amp; Confluence</strong><small>All engineering projects</small></span><span class="pill ok">Active</span></div>
          <div class="row"><span><strong>Company VPN</strong><small>Managed device required</small></span><span class="pill ok">Active</span></div>
          <div class="row"><span><strong>Production console</strong><small>Read-only · expires in 12 days</small></span><span class="pill muted">Temporary</span></div>
        </div>
        <div class="modal-foot"><button class="btn" data-say="Access request (prototype)">Request access</button><button class="btn primary" data-say="Hardware request (prototype)">Request hardware</button></div>`,
    },
    handbook: {
      title: "Personalhandbok 2026",
      kind: "Handbook",
      icon: "▣",
      keys: "employee handbook policy personal",
      html: `<p>The complete employee handbook. Pick a chapter.</p>
        <div class="rows">
          <button class="row" data-doc="onboarding"><span><strong>§1 Onboarding</strong><small>Your first weeks</small></span>›</button>
          <button class="row" data-doc="remote"><span><strong>§2 Distansarbete</strong><small>Remote and hybrid work</small></span>›</button>
          <button class="row" data-doc="leave"><span><strong>§5 Ledighet</strong><small>Vacation, sick and parental leave</small></span>›</button>
          <button class="row" data-doc="expenses"><span><strong>§7 Utlägg</strong><small>Expenses and equipment</small></span>›</button>
          <button class="row" data-doc="conduct"><span><strong>§9 Uppförandekod</strong><small>Code of conduct</small></span>›</button>
          <button class="row" data-doc="security"><span><strong>IT Security Policy</strong><small>Keys, passwords, devices</small></span>›</button>
        </div>`,
    },
    onboarding: {
      title: "Onboarding",
      kind: "Handbook",
      icon: "✳",
      keys: "new hire first week start",
      html: `<p>Personalhandbok 2026 · §1</p>
        <ul><li>Day 1: laptop, accounts and your security key.</li><li>Week 1: meet your buddy and your manager.</li><li>Week 2: join a guild and pick your first task.</li></ul>
        <h4>Good to know</h4><p>The “New hire setup” checklist on the dashboard tracks these steps for you.</p>`,
    },
    remote: {
      title: "Remote work",
      kind: "Handbook",
      icon: "⌂",
      keys: "distansarbete hybrid home abroad",
      html: `<p>Personalhandbok 2026 · §2 Distansarbete</p>
        <ul><li>Up to three remote days per week, agreed with your manager.</li><li>Core hours are 09:30–15:00 CET.</li><li>Working from abroad: up to 20 days per year inside the EU/EEA, approved in advance.</li><li>Always use the company VPN and a managed device.</li></ul>`,
    },
    leave: {
      title: "Time off & leave",
      kind: "Handbook",
      icon: "☀",
      keys: "vacation semester sick parental ledighet",
      html: `<p>Personalhandbok 2026 · §5 Ledighet</p>
        <ul><li>30 vacation days per year.</li><li>Request summer vacation before April 30.</li><li>Sick leave: tell your manager before 09:00. A doctor's note is needed from day 8.</li><li>Parental leave is topped up to 90% of salary for six months.</li></ul>`,
    },
    expenses: {
      title: "Expenses",
      kind: "Handbook",
      icon: "▤",
      keys: "utlägg receipts travel equipment reimbursement",
      html: `<p>Personalhandbok 2026 · §7 Utlägg</p>
        <ul><li>Submit receipts within 30 days.</li><li>Purchases over 2,000 SEK need approval first.</li><li>Home-office equipment: up to 5,000 SEK every three years.</li><li>Travel is booked through the travel portal.</li></ul>`,
    },
    conduct: {
      title: "Code of conduct",
      kind: "Handbook",
      icon: "◈",
      keys: "uppförandekod values behaviour",
      html: `<p>Personalhandbok 2026 · §9 Uppförandekod</p>
        <ul><li>Treat colleagues, clients and candidates with respect.</li><li>Speak up early. Concerns go to your manager or People & Culture.</li><li>Keep client information confidential.</li></ul>`,
    },
    security: {
      title: "Security",
      kind: "Handbook",
      icon: "◉",
      keys: "yubikey mfa password device security key policy",
      html: `<p>IT Security Policy · §4</p>
        <ul><li>A hardware security key (YubiKey) is required for all accounts from June 15.</li><li>Register two keys: one primary, one backup.</li><li>Lost key? Report it to IT support within 24 hours.</li><li>Devices lock after 5 minutes and are fully encrypted.</li></ul>
        <div class="modal-foot"><button class="btn primary" data-say="Opening key registration (prototype)">Register a key</button></div>`,
    },
  };

  /* =====================================================================
     Modal
     ===================================================================== */
  const modal = $("#modal"),
    mBody = $("#modal-body"),
    mPin = $("#modal-pin");
  let modalDoc = null,
    modalFocus = null;
  function showModal({ kicker, title, html, pinId = null }) {
    closePalette();
    closeMenus();
    if (modal.hidden) modalFocus = document.activeElement;
    modalDoc = pinId;
    $("#modal-kicker").textContent = kicker;
    $("#modal-title").textContent = title;
    mBody.innerHTML = html;
    mBody.scrollTop = 0;
    mPin.hidden = !pinId;
    syncPinButton();
    modal.hidden = false;
    $("#modal-close").focus({ preventScroll: true });
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modalDoc = null;
    if (modalFocus && modalFocus.focus) modalFocus.focus({ preventScroll: true });
  }
  function openDoc(id) {
    const d = DOCS[id];
    if (!d) return;
    showModal({ kicker: d.kind, title: d.title, html: d.html, pinId: id });
    if (d.mount) d.mount(mBody);
    touchRecent(id);
  }
  $("#modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  mBody.addEventListener("click", (e) => {
    const say = e.target.closest("[data-say]");
    if (say) notify(say.dataset.say);
  });
  /* keep Tab inside the open modal */
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...modal.querySelectorAll("button, input, [href]")].filter((el) => !el.hidden && el.offsetParent);
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  /* anything with data-doc="id" opens that document (tiles, chips, checklist…) */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-doc]");
    if (el) openDoc(el.dataset.doc);
  });

  /* =====================================================================
     Quick access: pinned + recently opened
     ===================================================================== */
  let pins = store.get("qp-pins", ["remote", "leave", "expenses"]).filter((id) => DOCS[id]);
  let recent = store.get("qp-recent", []).filter((r) => DOCS[r.id]);
  const isPinned = (id) => pins.includes(id);
  function togglePin(id) {
    pins = isPinned(id) ? pins.filter((p) => p !== id) : [...pins, id];
    store.set("qp-pins", pins);
    notify(isPinned(id) ? `Pinned ${DOCS[id].title}` : `Unpinned ${DOCS[id].title}`);
    renderQuick();
    syncPinButton();
  }
  function touchRecent(id) {
    recent = [{ id, t: Date.now() }, ...recent.filter((r) => r.id !== id)].slice(0, 6);
    store.set("qp-recent", recent);
    renderQuick();
  }
  function syncPinButton() {
    if (!modalDoc) return;
    const on = isPinned(modalDoc);
    mPin.textContent = on ? "★" : "☆";
    mPin.setAttribute("aria-pressed", on);
    mPin.setAttribute("aria-label", on ? "Unpin from quick access" : "Pin to quick access");
    mPin.title = on ? "Unpin from quick access" : "Pin to quick access";
  }
  mPin.addEventListener("click", () => modalDoc && togglePin(modalDoc));
  function renderQuick() {
    $("#pin-list").innerHTML = pins.length
      ? pins
          .map((id) => {
            const d = DOCS[id];
            return `<span class="chip"><button type="button" data-doc="${id}"><i>${d.icon}</i>${esc(d.title)}</button><button type="button" class="chip-x" data-unpin="${id}" aria-label="Unpin ${esc(d.title)}">×</button></span>`;
          })
          .join("")
      : `<div class="empty-note">Nothing pinned. Use ☆ to pin a tool or document.</div>`;
    $("#recent-list").innerHTML = recent.length
      ? recent
          .slice(0, 4)
          .map(({ id, t }) => {
            const d = DOCS[id],
              on = isPinned(id);
            return `<div class="recent"><button type="button" class="recent-open" data-doc="${id}"><span class="news-ico">${d.icon}</span><span><strong>${esc(d.title)}</strong><small>${d.kind} · ${ago(t)}</small></span></button><button type="button" class="star" data-pin="${id}" aria-pressed="${on}" aria-label="${on ? "Unpin" : "Pin"} ${esc(d.title)}">${on ? "★" : "☆"}</button></div>`;
          })
          .join("")
      : `<div class="empty-note">Nothing opened yet. Try the search field.</div>`;
  }
  $("#quick").addEventListener("click", (e) => {
    const un = e.target.closest("[data-unpin]"),
      pin = e.target.closest("[data-pin]");
    if (un) togglePin(un.dataset.unpin);
    else if (pin) togglePin(pin.dataset.pin);
  });
  renderQuick();

  /* =====================================================================
     Command palette (Cmd/Ctrl + K)
     ===================================================================== */
  const pal = $("#cmdk"),
    palQ = $("#cmdk-q"),
    palList = $("#cmdk-list");
  const VIEW_ICONS = { dashboard: "⌂", news: "▤", handbook: "▣", it: "◉", projects: "⌘", settings: "⚙", admin: `<svg class="ico"><use href="#i-shield" /></svg>` };
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $("#search-kbd").textContent = isMac ? "⌘K" : "Ctrl K";
  function closeOverlays() {
    closePalette();
    closeModal();
    if (window.qpChat) window.qpChat.close();
  }
  function commands() {
    const docs = (kind) =>
      Object.entries(DOCS)
        .filter(([, d]) => d.kind === kind)
        .map(([id, d]) => ({
          group: kind === "Tool" ? "Tools" : "Handbook",
          label: d.title,
          icon: d.icon,
          keys: d.keys,
          run: () => openDoc(id),
        }));
    return [
      ...Object.entries(VIEWS)
        .filter(([id]) => id !== "admin" || isAdmin())
        .map(([id, label]) => ({
          group: "Go to",
          label,
          icon: VIEW_ICONS[id] || "›",
          keys: "view page open " + id + (id === "admin" ? " publish news event manage" : ""),
          run: () => showView(id),
        })),
      ...docs("Tool"),
      ...docs("Handbook"),
      { group: "Actions", label: "Toggle theme", icon: "◐", hint: "D", keys: "dark light mode appearance", run: toggleTheme },
      {
        group: "Actions",
        label: "Replay tour",
        icon: "?",
        keys: "guide help onboarding walkthrough",
        run: () => {
          closeOverlays();
          window.qpTour.start();
        },
      },
      { group: "Actions", label: "Open QualiChat", icon: "✳", keys: "ai assistant chat ask", run: () => window.qpChat.open() },
      {
        group: "Actions",
        label: "Customize dashboard",
        icon: `<svg class="ico grip"><use href="#i-grip" /></svg>`,
        keys: "layout reorder move arrange drag widgets boxes",
        run: () => {
          showView("dashboard");
          setDashEdit(true);
          $("#dash-edit").scrollIntoView({ block: "center" });
          $("#dash-edit").focus({ preventScroll: true });
        },
      },
      {
        group: "Actions",
        label: "Mark notifications as read",
        icon: "✓",
        keys: "bell inbox",
        run: () => $("#mark-read").click(),
      },
    ];
  }
  let palItems = [],
    palIndex = 0;
  function renderPalette() {
    const query = palQ.value.trim(),
      words = query.toLowerCase().split(/\s+/).filter(Boolean);
    palItems = commands().filter((c) => {
      const hay = (c.label + " " + c.group + " " + (c.keys || "")).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    if (query)
      palItems.push({
        group: "Ask",
        label: `Ask QualiChat: “${query}”`,
        icon: "✳",
        run: () => window.qpChat.ask(query),
      });
    palIndex = Math.min(palIndex, Math.max(palItems.length - 1, 0));
    let group = "";
    palList.innerHTML = palItems.length
      ? palItems
          .map((c, n) => {
            const head = c.group !== group ? `<div class="cmdk-group">${c.group}</div>` : "";
            group = c.group;
            return `${head}<div class="cmdk-item${n === palIndex ? " active" : ""}" role="option" aria-selected="${n === palIndex}" data-n="${n}"><i>${c.icon}</i><span>${esc(c.label)}</span>${c.hint ? `<small><kbd>${c.hint}</kbd></small>` : ""}</div>`;
          })
          .join("")
      : `<div class="cmdk-empty">No matches.</div>`;
    const act = palList.querySelector(".active");
    if (act) act.scrollIntoView({ block: "nearest" });
  }
  let palFocus = null;
  function openPalette() {
    if (document.body.classList.contains("is-touring")) return;
    closeMenus();
    palFocus = document.activeElement;
    pal.hidden = false;
    palQ.value = "";
    palIndex = 0;
    renderPalette();
    palQ.focus();
  }
  function closePalette() {
    if (pal.hidden) return;
    pal.hidden = true;
    if (palFocus && palFocus.focus) palFocus.focus({ preventScroll: true });
  }
  function runPalette(n) {
    const c = palItems[n];
    if (!c) return;
    palFocus = null; // the command decides where focus goes
    closePalette();
    c.run();
  }
  $("#search-trigger").addEventListener("click", openPalette);
  palQ.addEventListener("input", () => {
    palIndex = 0;
    renderPalette();
  });
  palQ.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = palItems.length;
      if (n) palIndex = (palIndex + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      renderPalette();
    } else if (e.key === "Enter") {
      e.preventDefault();
      runPalette(palIndex);
    } else if (e.key === "Tab") e.preventDefault();
  });
  palList.addEventListener("click", (e) => {
    const it = e.target.closest(".cmdk-item");
    if (it) runPalette(+it.dataset.n);
  });
  palList.addEventListener("pointermove", (e) => {
    const it = e.target.closest(".cmdk-item");
    if (it && +it.dataset.n !== palIndex) {
      palIndex = +it.dataset.n;
      palList.querySelectorAll(".cmdk-item").forEach((el) => el.classList.toggle("active", el === it));
    }
  });
  pal.addEventListener("click", (e) => {
    if (e.target === pal) closePalette();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      pal.hidden ? openPalette() : closePalette();
    } else if (e.key === "Escape") {
      if (drag) endDrag(true);
      else if (!pal.hidden) closePalette();
      else if (!modal.hidden) closeModal();
      else if (dashEdit && !$("#ai-drawer.open")) setDashEdit(false);
      else if (window.qpChat) window.qpChat.close();
    }
  });

  /* =====================================================================
     New hire checklist. Edit TASKS to change the steps.
     ===================================================================== */
  const TASKS = [
    { id: "mfa", label: "Register YubiKey MFA", hint: "Required from Jun 15", doc: "security" },
    { id: "handbook", label: "Read Personalhandbok 2026", hint: "About 20 minutes", doc: "handbook" },
    { id: "guild", label: "Join Engineering Guild", hint: "Thursdays 15:00" },
    { id: "devenv", label: "Set up your dev environment", hint: "Guide in the Dev Portal", doc: "devportal" },
    { id: "intro", label: "Book intro with your manager", hint: "30 minutes with Maja" },
  ];
  let done = store.get("qp-onboarding", {});
  const obList = $("#onboard-list"),
    obToggle = $("#onboard-toggle"),
    obBody = $("#onboard-body");
  obList.innerHTML = TASKS.map(
    (t) =>
      `<li><label class="check"><input type="checkbox" data-task="${t.id}"${done[t.id] ? " checked" : ""} /><span class="box">✓</span><span class="txt">${esc(t.label)}<small>${esc(t.hint)}</small></span></label>${t.doc ? `<button type="button" class="mini-link" data-doc="${t.doc}" aria-label="Open ${esc(DOCS[t.doc].title)}">Open</button>` : ""}</li>`,
  ).join("");
  function syncChecklist() {
    const n = TASKS.filter((t) => done[t.id]).length,
      pill = $("#onboard-count");
    $("#onboard-bar").style.width = (n / TASKS.length) * 100 + "%";
    pill.textContent = n === TASKS.length ? "Done" : `${n}/${TASKS.length}`;
    pill.classList.toggle("ok", n === TASKS.length);
    return n;
  }
  obList.addEventListener("change", (e) => {
    const id = e.target.dataset.task;
    if (!id) return;
    done[id] = e.target.checked;
    store.set("qp-onboarding", done);
    if (syncChecklist() === TASKS.length && e.target.checked) notify("Setup complete. Welcome aboard!");
  });
  function setCollapsed(c) {
    obToggle.setAttribute("aria-expanded", !c);
    obBody.hidden = c;
    store.set("qp-onboarding-collapsed", c);
  }
  obToggle.addEventListener("click", () => setCollapsed(obToggle.getAttribute("aria-expanded") === "true"));
  setCollapsed(store.get("qp-onboarding-collapsed", false));
  syncChecklist();

  /* =====================================================================
     Team activity feed (example data). status: ok | run | bad | info
     ===================================================================== */
  const BADGE = { ok: ["ok", "Success"], run: ["", "Running"], bad: ["bad", "Failed"], info: ["muted", "Info"] };
  const FEED_SEED = [
    { icon: "↻", title: "core-api deployed to production", by: "CI/CD · #1842", status: "ok", min: 4 },
    { icon: "↗", title: "Core v4.2 release notes published", by: "Engineering", status: "info", label: "Release", min: 38 },
    { icon: "◈", title: "Security policy acknowledged", by: "Maja Berg", status: "ok", label: "Signed", min: 95 },
    { icon: "↻", title: "data-ingest integration tests", by: "CI/CD · #310", status: "bad", min: 170 },
    { icon: "✳", title: "Linnea joined Engineering Guild", by: "People", status: "info", label: "New", min: 300 },
  ];
  const FEED_POOL = [
    { icon: "↻", title: "web-intranet build finished", by: "CI/CD · #771", status: "ok" },
    { icon: "◈", title: "Security policy acknowledged", by: "Jonas Ek", status: "ok", label: "Signed" },
    { icon: "↻", title: "poc-retail-ai deploying to staging", by: "CI/CD · #59", status: "run" },
    { icon: "↗", title: "Core v4.2.1 hotfix tagged", by: "Platform", status: "info", label: "Release" },
    { icon: "◈", title: "Security key registered", by: "Omar Haddad", status: "ok", label: "MFA" },
  ];
  let feed = FEED_SEED.map((f) => ({ ...f, t: Date.now() - f.min * 60000 }));
  let poolAt = 0;
  const feedList = $("#feed-list");
  function renderFeed(fresh) {
    feedList.innerHTML = feed
      .slice(0, 5)
      .map((f, n) => {
        const [cls, text] = BADGE[f.status];
        return `<li class="feed-item${fresh && n === 0 ? " new" : ""}"><span class="news-ico">${f.icon}</span><span><strong>${esc(f.title)}</strong><small>${esc(f.by)} · ${ago(f.t)}</small></span><span class="pill ${cls}">${f.label || text}</span></li>`;
      })
      .join("");
  }
  renderFeed();
  /* a new example event every 30 s; timestamps refresh at the same time */
  setInterval(() => {
    if (document.hidden) return;
    feed.unshift({ ...FEED_POOL[poolAt++ % FEED_POOL.length], t: Date.now() });
    feed = feed.slice(0, 8);
    renderFeed(true);
    if (!$("#quick").contains(document.activeElement)) renderQuick(); // refresh “2 min ago”
  }, 30000);

  /* =====================================================================
     Sidebar quick links + the Edit button. Saved in localStorage.
     A link with a URL opens in a new tab; without one it only shows a message.
     ===================================================================== */
  const LINK_DEFAULTS = [
    { label: "Jira task board", url: "" },
    { label: "GitHub repositories", url: "" },
    { label: "Architecture wiki", url: "" },
  ];
  const LINK_ICONS = ["▤", "⌘", "▣", "◈", "◉", "✳"];
  let links = store.get("qp-quicklinks", LINK_DEFAULTS);
  const quickNav = $("#quick-nav");
  function renderLinks() {
    quickNav.innerHTML = links.length
      ? links
          .map(
            (l, n) =>
              `<button type="button" data-link="${n}" title="${esc(l.label)}"><span class="nav-icon">${LINK_ICONS[n % LINK_ICONS.length]}</span><span class="label">${esc(l.label)}</span><span class="ext">↗</span></button>`,
          )
          .join("")
      : `<div class="empty-note label" style="padding: 4px 12px">No links yet. Use Edit to add one.</div>`;
  }
  quickNav.addEventListener("click", (e) => {
    const b = e.target.closest("[data-link]");
    if (!b) return;
    const l = links[+b.dataset.link];
    if (l.url) window.open(l.url, "_blank", "noopener");
    else notify(`${l.label}: add a web address with Edit`);
  });
  const linkRow = (l) =>
    `<div class="link-row"><input class="field" data-f="label" type="text" placeholder="Name" value="${esc(l.label)}" aria-label="Link name" /><input class="field" data-f="url" type="url" placeholder="https://…" value="${esc(l.url)}" aria-label="Web address" /><button type="button" class="icon-btn" data-remove aria-label="Remove link">✕</button></div>`;
  $("#quick-edit").addEventListener("click", () => {
    showModal({
      kicker: "Sidebar",
      title: "Edit quick links",
      html: `<p>Name each link and paste its web address. Links open in a new tab.</p>
        <div id="link-rows">${links.map(linkRow).join("")}</div>
        <button type="button" class="btn" id="link-add">＋ Add link</button>
        <div class="modal-foot"><button type="button" class="btn" id="link-reset">Reset</button><button type="button" class="btn primary" id="link-save">Save</button></div>`,
    });
    const rows = mBody.querySelector("#link-rows");
    mBody.querySelector("#link-add").onclick = () => {
      rows.insertAdjacentHTML("beforeend", linkRow({ label: "", url: "" }));
      rows.lastElementChild.querySelector("input").focus();
    };
    rows.onclick = (e) => {
      const x = e.target.closest("[data-remove]");
      if (x) x.parentElement.remove();
    };
    mBody.querySelector("#link-reset").onclick = () => (rows.innerHTML = LINK_DEFAULTS.map(linkRow).join(""));
    mBody.querySelector("#link-save").onclick = () => {
      links = [...rows.querySelectorAll(".link-row")]
        .map((r) => {
          let url = r.querySelector('[data-f="url"]').value.trim();
          if (url && !/^https?:\/\//i.test(url)) url = "https://" + url; // only web links
          return { label: r.querySelector('[data-f="label"]').value.trim(), url };
        })
        .filter((l) => l.label);
      store.set("qp-quicklinks", links);
      renderLinks();
      closeModal();
      notify("Quick links saved");
    };
  });
  renderLinks();

  /* =====================================================================
     Admin Panel (HR + Manager): publish news articles and calendar events.
     Both lists are saved in localStorage ("qp-news", "qp-events"), so they
     only exist in this browser. News shows up on the dashboard and in the
     News view; events are drawn by js/calendar.js.
     ===================================================================== */
  const NEWS_CATS = {
    company: ["Company", "☀"],
    engineering: ["Engineering", "↗"],
    security: ["Security", "◈"],
    hr: ["HR & policies", "▣"],
    people: ["People", "✳"],
  };
  const EVENT_TYPES = { meeting: "Meeting", event: "Event", deadline: "Deadline" };
  const HOME_NEWS = 4; // how many articles the dashboard shows
  const savedList = (key) => {
    const v = store.get(key, []);
    return Array.isArray(v) ? v.filter((x) => x && x.id && x.title && /^\d{4}-\d\d-\d\d$/.test(x.date)) : [];
  };
  let news = savedList("qp-news"),
    events = savedList("qp-events");
  const pad = (n) => String(n).padStart(2, "0");
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const day = (iso) => new Date(+iso.slice(0, 4), iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newsDate = (iso) => day(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const eventDate = (iso) => day(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const cat = (n) => NEWS_CATS[n.cat] || NEWS_CATS.company;

  /* Adds the published articles to both news lists and keeps each list newest first */
  function renderNews() {
    [
      ["#news-home", HOME_NEWS],
      ["#news-all", Infinity],
    ].forEach(([sel, max]) => {
      const box = $(sel);
      if (!box) return;
      box.querySelectorAll("[data-custom]").forEach((a) => a.remove());
      box.insertAdjacentHTML(
        "afterbegin",
        news
          .map(
            (n) =>
              `<article class="news-item" data-custom><div class="news-ico" title="${esc(cat(n)[0])}">${cat(n)[1]}</div><div class="news-copy"><strong>${esc(n.title)}</strong><small>${esc(n.text || "")}</small></div><time class="date" datetime="${n.date}">${newsDate(n.date)}</time></article>`,
          )
          .join(""),
      );
      const when = (a) => a.querySelector("time")?.dateTime || "";
      [...box.children]
        .sort((a, b) => when(b).localeCompare(when(a)))
        .forEach((a, i) => {
          box.appendChild(a);
          a.hidden = i >= max;
        });
    });
  }
  const adminRow = (kind, id, icon, title, sub) =>
    `<div class="row"><div class="news-ico">${icon}</div><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><button type="button" class="icon-btn" data-del="${kind}" data-id="${esc(id)}" aria-label="Remove ${esc(title)}">✕</button></div>`;
  function renderAdmin() {
    const byDate = (a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""));
    const draw = (sel, rows, empty) =>
      ($(sel).innerHTML = rows.length ? `<div class="rows admin-list">${rows.join("")}</div>` : `<div class="empty-note">${empty}</div>`);
    draw(
      "#admin-news-list",
      [...news].sort(byDate).map((n) => adminRow("news", n.id, cat(n)[1], n.title, `${cat(n)[0]} · ${newsDate(n.date)}`)),
      "Nothing published yet. Articles you add show up on the dashboard.",
    );
    draw(
      "#admin-event-list",
      [...events]
        .sort(byDate)
        .map((ev) =>
          adminRow(
            "event",
            ev.id,
            `<i class="t-${EVENT_TYPES[ev.type] ? ev.type : "meeting"}"></i>`,
            ev.title,
            `${eventDate(ev.date)} · ${ev.time}${ev.end ? `–${ev.end}` : ""} · ${EVENT_TYPES[ev.type] || "Meeting"}${ev.where ? ` · ${ev.where}` : ""}`,
          ),
        ),
      "Nothing published yet. Events you add show up in the calendar.",
    );
    $("#admin-news-count").textContent = news.length;
    $("#admin-event-count").textContent = events.length;
  }
  const newsForm = $("#admin-news-form"),
    eventForm = $("#admin-event-form"),
    typeSeg = $("#admin-event-type");
  if (newsForm && eventForm) {
    $("#admin-news-cat").innerHTML = Object.entries(NEWS_CATS)
      .map(([id, [label]]) => `<option value="${id}">${esc(label)}</option>`)
      .join("");
    const resetForm = (f) => {
      f.reset();
      f.elements.date.value = todayISO();
    };
    const setType = (t) => typeSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.type === t));
    typeSeg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (b) setType(b.dataset.type);
    });
    newsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!isAdmin()) return notify("Only HR and managers can publish");
      const f = newsForm.elements,
        title = f.title.value.trim(),
        text = f.text.value.trim();
      if (!title || !text) return (title ? f.text : f.title).focus();
      news.push({ id: newId(), title, text, cat: f.cat.value, date: f.date.value });
      store.set("qp-news", news);
      renderNews();
      renderAdmin();
      resetForm(newsForm);
      notify(`Published “${title}”`);
    });
    eventForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!isAdmin()) return notify("Only HR and managers can publish");
      const f = eventForm.elements,
        title = f.title.value.trim(),
        type = typeSeg.querySelector('[aria-pressed="true"]').dataset.type,
        end = type === "deadline" ? "" : f.end.value;
      if (!title) return f.title.focus();
      if (end && end <= f.time.value) {
        notify("The end time must be after the start time");
        return f.end.focus();
      }
      const ev = { id: newId(), title, type, date: f.date.value, time: f.time.value, end, where: f.where.value.trim() };
      events.push(ev);
      store.set("qp-events", events);
      if (window.qpCalendar) window.qpCalendar.reload(ev.date); // the dashboard calendar jumps to that day
      renderAdmin();
      resetForm(eventForm);
      setType("meeting");
      notify(`Published “${title}” in the calendar`);
    });
    /* ✕ in the "Published from this panel" lists */
    $('.view[data-view="admin"]').addEventListener("click", (e) => {
      const b = e.target.closest("[data-del]");
      if (!b || !isAdmin()) return;
      if (b.dataset.del === "news") {
        news = news.filter((n) => n.id !== b.dataset.id);
        store.set("qp-news", news);
        renderNews();
      } else {
        events = events.filter((ev) => ev.id !== b.dataset.id);
        store.set("qp-events", events);
        if (window.qpCalendar) window.qpCalendar.reload();
      }
      renderAdmin();
      notify("Removed");
    });
    resetForm(newsForm);
    resetForm(eventForm);
    renderAdmin();
  }
  renderNews();

  /* =====================================================================
     Dashboard layout: "Customize dashboard" turns on an edit mode where the
     boxes (data-dash="…" in index.html) can be dragged into a new order.
     They all sit in one two-column grid (.widgets). The box marked data-dash-wide
     (Quick access) fills a whole row; the others take one column each.
     The order is saved in localStorage ("qp-dashboard-order-v2").
     Mouse: drag a box anywhere. Touch: drag its Move handle (so the page still scrolls).
     Keyboard: focus a Move handle and use the arrow keys.
     ===================================================================== */
  const DASH_DEFAULT = ["quick", "onboard", "feed", "news", "calendar"];
  const DASH_KEY = "qp-dashboard-order-v2"; // v2: the layout changed, so an order saved for the old one is not reused
  const dashGrid = $(".widgets");
  const dashWide = $("[data-dash-wide]")?.dataset.dash; // id of the full-width box
  const dashBox = {};
  $$("[data-dash]").forEach((b) => (dashBox[b.dataset.dash] = b));
  const dashIds = DASH_DEFAULT.filter((id) => dashBox[id]);
  const dashEditBtn = $("#dash-edit");
  let dashOrder = [...dashIds],
    dashSlots = {}, // id -> where its grid cell is on the page
    dashEdit = false,
    drag = null;
  const dashSlot = document.createElement("div"); // dashed outline that shows where the dragged box will land
  dashSlot.className = "dash-slot";
  dashSlot.hidden = true;
  document.body.appendChild(dashSlot);

  /* The full-width box always sits on a row border: an even number of one-column boxes before it.
     Otherwise a one-column box would be left alone on its row with an empty cell beside it. */
  const dashHalves = (order) => order.filter((id) => id !== dashWide);
  function dashCompose(halves, before) {
    if (!dashWide) return halves;
    const k = Math.max(0, Math.min(halves.length, before + (before % 2)));
    return [...halves.slice(0, k), dashWide, ...halves.slice(k)];
  }
  const dashTidy = (order) => dashCompose(dashHalves(order), order.indexOf(dashWide));
  /* The order after the dragged box is moved onto the box `hit` (null = nothing changes) */
  function dashTarget(hit, py) {
    const halves = dashHalves(dashOrder),
      k = dashOrder.indexOf(dashWide), // how many one-column boxes sit above the full-width one
      id = drag.id;
    if (id !== dashWide && hit !== dashWide) {
      const next = halves.filter((x) => x !== id);
      next.splice(halves.indexOf(hit), 0, id); // take that box's place; the ones in between shift over
      return dashCompose(next, k);
    }
    /* a one-column box dragged onto the full-width one: the full-width box swaps places with that box's row */
    if (id !== dashWide) return dashCompose(halves, halves.indexOf(id) < k ? k - 2 : k + 2);
    /* the full-width box dragged over a row: it jumps to the other side once the pointer passes the middle of that row */
    const at = halves.indexOf(hit),
      row = at - (at % 2),
      cells = halves.slice(row, row + 2).map((x) => dashSlots[x]),
      top = Math.min(...cells.map((s) => s.top)),
      bottom = Math.max(...cells.map((s) => s.top + s.height));
    if (at < k) return py < (top + bottom) / 2 ? dashCompose(halves, row) : null;
    return py > (top + bottom) / 2 ? dashCompose(halves, row + 2) : null;
  }
  /* Puts the boxes into the grid in dashOrder. Only boxes that are out of place are moved. */
  function layoutDash() {
    dashOrder.forEach((id, i) => {
      if (dashGrid.children[i] !== dashBox[id]) dashGrid.insertBefore(dashBox[id], dashGrid.children[i] || null);
      const h = dashBox[id].querySelector(".dash-handle");
      if (h) h.setAttribute("aria-label", `Move ${h.dataset.name}: position ${i + 1} of ${dashOrder.length}. Use the arrow keys.`);
    });
  }
  /* Changes the order and slides every box from where it was to its new cell.
     `held` is the box being dragged: it follows the pointer instead (see dragFrame). */
  function moveDash(next, held) {
    const first = dashIds.map((id) => dashBox[id].getBoundingClientRect());
    dashOrder = next;
    layoutDash();
    dashIds.forEach((id) => dashBox[id].getAnimations().forEach((a) => a.cancel()));
    if (held) held.style.transform = "";
    dashIds.forEach((id, n) => {
      const box = dashBox[id],
        last = box.getBoundingClientRect(),
        dx = first[n].left - last.left,
        dy = first[n].top - last.top;
      dashSlots[id] = { left: last.left + scrollX, top: last.top + scrollY, width: last.width, height: last.height };
      if (box !== held && (dx || dy) && !reduce())
        box.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    });
  }
  const saveDash = () => store.set(DASH_KEY, dashOrder);

  function setDashEdit(on) {
    if (on === dashEdit) return;
    if (drag) endDrag(true);
    if (!on && document.activeElement.closest(".dash-handle")) dashEditBtn.focus({ preventScroll: true }); // the handle is about to disappear
    dashEdit = on;
    document.body.classList.toggle("is-customizing", on);
    dashEditBtn.className = on ? "btn primary" : "link-btn";
    dashEditBtn.setAttribute("aria-pressed", on);
    dashEditBtn.querySelector("span").textContent = on ? "Done" : "Customize dashboard";
    $("#dash-hint").hidden = $("#dash-reset").hidden = !on;
    /* while customizing, the content of each box is switched off so a drag never ticks a checkbox or opens an event */
    dashIds.forEach((id) => [...dashBox[id].children].forEach((c) => (c.classList.contains("dash-handle") ? (c.hidden = !on) : (c.inert = on))));
  }

  /* ---------- Dragging ---------- */
  function startDrag() {
    drag.active = true;
    drag.box.classList.add("dragging");
    document.body.classList.add("is-dash-dragging");
    moveDash(dashOrder, drag.box); // same order: only measures the cells
    placeSlot(false);
    dashSlot.hidden = false;
    dragFrame();
  }
  function placeSlot(animate = true) {
    const s = dashSlots[drag.id];
    dashSlot.style.transition = animate && !reduce() ? "" : "none";
    Object.assign(dashSlot.style, { left: s.left + "px", top: s.top + "px", width: s.width + "px", height: s.height + "px" });
  }
  /* Runs every frame during a drag: scrolls near the screen edges, swaps cells and keeps the box under the pointer */
  function dragFrame() {
    if (!drag) return;
    const edge = 70,
      over = drag.y < edge ? drag.y - edge : drag.y > innerHeight - edge ? drag.y - (innerHeight - edge) : 0;
    if (over) scrollBy(0, over * 0.3);
    const px = drag.x + scrollX,
      py = drag.y + scrollY;
    /* a new swap needs the pointer to move a little first, so boxes of different heights cannot flip back and forth */
    if (Math.hypot(px - drag.swapX, py - drag.swapY) > 12) {
      const hit = dashOrder.find((id) => {
        const s = dashSlots[id];
        return id !== drag.id && px >= s.left && px <= s.left + s.width && py >= s.top && py <= s.top + s.height;
      });
      const next = hit && dashTarget(hit, py);
      if (next && next.join() !== dashOrder.join()) {
        moveDash(next, drag.box);
        placeSlot();
        drag.swapX = px;
        drag.swapY = py;
      }
    }
    const s = dashSlots[drag.id];
    const x = px - drag.fx * s.width - s.left,
      y = py - Math.min(drag.gy, s.height - 16) - s.top;
    drag.box.style.transform = `translate(${x}px, ${y}px) scale(1.02)`;
    drag.raf = requestAnimationFrame(dragFrame);
  }
  /* Drop (or cancel with Esc: the boxes go back to where they were) */
  function endDrag(cancel) {
    const d = drag;
    drag = null;
    if (!d || !d.active) return;
    cancelAnimationFrame(d.raf);
    document.body.classList.remove("is-dash-dragging");
    dashSlot.hidden = true;
    const mid = (r) => [r.left + r.width / 2, r.top + r.height / 2];
    const held = mid(d.box.getBoundingClientRect()); // where the box is on screen right now
    if (cancel === true) moveDash(d.start, d.box);
    else saveDash();
    d.box.style.transform = "";
    const cell = mid(d.box.getBoundingClientRect()); // where it belongs
    d.box.classList.replace("dragging", "dropping");
    const land = () => d.box.classList.remove("dropping");
    if (reduce()) return land();
    const fly = d.box.animate(
      [{ transform: `translate(${held[0] - cell[0]}px, ${held[1] - cell[1]}px) scale(1.02)` }, { transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    fly.onfinish = fly.oncancel = land;
  }
  if (dashEditBtn && dashGrid && dashIds.length) {
    const saved = store.get(DASH_KEY, []);
    dashOrder = dashTidy(Array.isArray(saved) ? [...new Set([...saved.filter((id) => dashIds.includes(id)), ...dashIds])] : dashIds);
    dashIds.forEach((id) => {
      const name = dashBox[id].querySelector("h2")?.textContent.trim() || id;
      dashBox[id].insertAdjacentHTML(
        "beforeend",
        `<button type="button" class="dash-handle" data-name="${esc(name)}" hidden><svg class="ico grip"><use href="#i-grip" /></svg>Move</button>`,
      );
    });
    layoutDash();

    dashEditBtn.addEventListener("click", () => {
      setDashEdit(!dashEdit);
      if (!dashEdit) notify("Dashboard layout saved");
    });
    $("#dash-reset").addEventListener("click", () => {
      moveDash(dashTidy(dashIds));
      saveDash();
      notify("Dashboard layout reset");
    });
    const dashView = dashGrid.closest(".view");
    dashView.addEventListener("pointerdown", (e) => {
      const box = e.target.closest("[data-dash]");
      if (!dashEdit || drag || e.button || !box) return;
      if (e.pointerType !== "mouse" && !e.target.closest(".dash-handle")) return; // touch: only the handle drags
      const r = box.getBoundingClientRect();
      e.preventDefault(); // no text selection while dragging
      drag = {
        id: box.dataset.dash,
        box,
        pointer: e.pointerId,
        start: [...dashOrder],
        x: e.clientX,
        y: e.clientY,
        downX: e.clientX,
        downY: e.clientY,
        fx: (e.clientX - r.left) / r.width, // where the box was grabbed: share of its width, and px from its top
        gy: e.clientY - r.top,
        swapX: -1e6,
        swapY: -1e6,
        active: false,
      };
    });
    /* listening on window: the dragged box is moved in the DOM during a drag, so it cannot hold the pointer itself */
    addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.pointer) return;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (!drag.active && Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) > 5) startDrag();
    });
    addEventListener("pointerup", (e) => drag && e.pointerId === drag.pointer && endDrag());
    addEventListener("pointercancel", (e) => drag && e.pointerId === drag.pointer && endDrag(true));
    /* arrow keys on a Move handle */
    dashView.addEventListener("keydown", (e) => {
      const h = e.target.closest(".dash-handle"),
        step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
      if (!h || !step || !dashEdit) return;
      e.preventDefault();
      const id = h.parentElement.dataset.dash,
        halves = dashHalves(dashOrder),
        k = dashOrder.indexOf(dashWide);
      let next;
      if (id === dashWide) next = dashCompose(halves, k + 2 * step); // the full-width box moves a whole row at a time
      else {
        const from = halves.indexOf(id),
          to = Math.max(0, Math.min(halves.length - 1, from + step));
        halves.splice(to, 0, ...halves.splice(from, 1));
        next = dashCompose(halves, k);
      }
      if (next.join() === dashOrder.join()) return;
      moveDash(next);
      saveDash();
      h.focus({ preventScroll: true }); // moving a box in the page drops the focus
      h.parentElement.scrollIntoView({ block: "nearest" });
    });
    /* leaving the dashboard ends customize mode */
    new MutationObserver(() => dashView.hidden && setDashEdit(false)).observe(dashView, { attributeFilter: ["hidden"] });
  }

  /* Shared with chat.js */
  window.qp = { DOCS, openDoc, showModal, closeModal, closeOverlays, openPalette, esc };
})();
