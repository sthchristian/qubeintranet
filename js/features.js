/* features.js
 * Intranet features on top of the dashboard:
 *   - DOCS: the tools and handbook documents that open in the modal
 *   - Modal (open / close / add to favorites)
 *   - Quick access: favorites (add / remove / reorder) + recently opened (saved in localStorage)
 *   - Command palette (Cmd/Ctrl + K, or the search field in the top bar)
 *   - New hire checklist (saved in localStorage)
 *   - Team activity feed (example data, edit FEED_SEED / FEED_POOL)
 *   - News: slideshow on the dashboard, article reader + list in the News view (saved in localStorage)
 *   - Admin Panel: publish news articles (with a cover image) and calendar events (saved in localStorage)
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
  /* SVG icons for the symbols that phones would otherwise draw as colour emoji (the sparkle, arrow, sun and gear) */
  const svgIcon = (id) => `<svg class="ico"><use href="#${id}" /></svg>`;
  const ICON = { spark: svgIcon("i-spark"), ext: svgIcon("i-ext"), sun: svgIcon("i-sun"), cog: svgIcon("i-cog") };
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
      icon: svgIcon("i-code"),
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
      icon: svgIcon("i-server"),
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
      icon: svgIcon("i-users"),
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
      icon: svgIcon("i-laptop"),
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
      icon: svgIcon("i-book"),
      keys: "employee handbook policy personal",
      /* The handbook is now one document in the Knowledge Hub (js/knowledge.js, "employee-handbook").
         Each topic points to the hub document(s) that cover it, so nothing is written twice. */
      html: `<p>The complete employee handbook. Pick a chapter.</p>
        <h4>Onboarding</h4>
        <div class="rows">
          <button class="row" data-doc="onboarding-checklist"><span><strong>Onboarding Checklist</strong><small>Your first weeks at QualiPro.</small></span>›</button>
        </div>
        <h4>Remote work</h4>
        <div class="rows">
          <button class="row" data-doc="remote-work-policy"><span><strong>Remote Work Policy</strong><small>Working from home and abroad.</small></span>›</button>
        </div>
        <h4>Time off &amp; leave</h4>
        <div class="rows">
          <button class="row" data-doc="vacation-policy"><span><strong>Vacation Policy</strong><small>Vacation days and how to request them.</small></span>›</button>
          <button class="row" data-doc="hr-guidelines"><span><strong>HR Guidelines</strong><small>Sick leave, parental leave and benefits.</small></span>›</button>
        </div>
        <h4>Expenses</h4>
        <div class="rows">
          <button class="row" data-doc="expense-travel-guide"><span><strong>Expense &amp; Travel Guide</strong><small>Travel, equipment and receipts.</small></span>›</button>
        </div>
        <h4>Code of conduct</h4>
        <div class="rows">
          <button class="row" data-doc="code-of-conduct"><span><strong>Code of Conduct</strong><small>How we work together.</small></span>›</button>
        </div>
        <h4>Security</h4>
        <div class="rows">
          <button class="row" data-doc="it-security-policy"><span><strong>IT Security Policy</strong><small>Security keys, devices and incidents.</small></span>›</button>
          <button class="row" data-doc="password-access-guide"><span><strong>Password &amp; Access Guide</strong><small>Passwords and access to systems.</small></span>›</button>
        </div>`,
    },
    onboarding: {
      title: "Onboarding",
      kind: "Handbook",
      icon: ICON.spark,
      keys: "new hire first week start",
      html: `<p>Personalhandbok 2026 · §1</p>
        <ul><li>Day 1: laptop, accounts and your security key.</li><li>Week 1: meet your buddy and your manager.</li><li>Week 2: join a guild and pick your first task.</li></ul>
        <h4>Good to know</h4><p>The “New hire setup” checklist on the dashboard tracks these steps for you.</p>`,
    },
    remote: {
      title: "Remote work",
      kind: "Handbook",
      icon: svgIcon("i-home"),
      keys: "distansarbete hybrid home abroad",
      html: `<p>Personalhandbok 2026 · §2 Distansarbete</p>
        <ul><li>Up to three remote days per week, agreed with your manager.</li><li>Core hours are 09:30–15:00 CET.</li><li>Working from abroad: up to 20 days per year inside the EU/EEA, approved in advance.</li><li>Always use the company VPN and a managed device.</li></ul>`,
    },
    leave: {
      title: "Time off & leave",
      kind: "Handbook",
      icon: ICON.sun,
      keys: "vacation semester sick parental ledighet",
      html: `<p>Personalhandbok 2026 · §5 Ledighet</p>
        <ul><li>30 vacation days per year.</li><li>Request summer vacation before April 30.</li></ul>
        <h4>Sick and parental leave</h4>
        <div class="rows">
          <button class="row" data-doc="hr-guidelines"><span><strong>HR Guidelines</strong><small>Sick leave, parental leave and benefits.</small></span>›</button>
        </div>`,
    },
    expenses: {
      title: "Expenses",
      kind: "Handbook",
      icon: svgIcon("i-doc"),
      keys: "utlägg receipts travel equipment reimbursement",
      html: `<p>Personalhandbok 2026 · §7 Utlägg</p>
        <ul><li>Submit receipts within 30 days.</li><li>Purchases over 2,000 SEK need approval first.</li><li>Home-office equipment: up to 5,000 SEK every three years.</li><li>Travel is booked through the travel portal.</li></ul>`,
    },
    conduct: {
      title: "Code of conduct",
      kind: "Handbook",
      icon: svgIcon("i-board"),
      keys: "uppförandekod values behaviour",
      html: `<p>Personalhandbok 2026 · §9 Uppförandekod</p>
        <ul><li>Treat colleagues, clients and candidates with respect.</li><li>Speak up early. Concerns go to your manager or People & Culture.</li><li>Keep client information confidential.</li></ul>`,
    },
    security: {
      title: "Security",
      kind: "Handbook",
      icon: svgIcon("i-shield"),
      keys: "yubikey mfa password device security key policy",
      html: `<p>IT Security Policy · §4</p>
        <ul><li>A hardware security key (YubiKey) is required for all accounts from June 15.</li><li>Register two keys: one primary, one backup.</li><li>Lost key? Report it to IT support within 24 hours.</li><li>Devices lock after 5 minutes and are fully encrypted.</li></ul>
        <div class="modal-foot"><button class="btn primary" data-say="Opening key registration (prototype)">Register a key</button></div>`,
    },
  };
  /* The Employee handbook moved into the Knowledge Hub. The handbook entries above stay, because the
     hub documents borrow their text (doc: "…" in js/knowledge.js), but anything that opens one of them
     (the checklist, QualiChat sources, the search, saved favorites and recents) gets the hub document. */
  const MOVED = {
    handbook: "employee-handbook",
    onboarding: "onboarding-checklist",
    remote: "remote-work-policy",
    leave: "vacation-policy",
    expenses: "expense-travel-guide",
    conduct: "code-of-conduct",
    security: "it-security-policy",
    "view:handbook": "view:knowledge",
  };
  const canon = (id) => MOVED[id] || id;

  /* =====================================================================
     Modal
     ===================================================================== */
  const modal = $("#modal"),
    mBox = modal.querySelector(".modal"),
    mBody = $("#modal-body"),
    mPin = $("#modal-pin");
  let modalDoc = null,
    modalFocus = null,
    onConfirm = null; // what "Delete" runs while a confirmation is open (see confirmDelete)
  function showModal({ kicker, title, html, pinId = null }) {
    closePalette();
    closeMenus();
    if (modal.hidden) modalFocus = document.activeElement;
    modalDoc = pinId;
    onConfirm = null; // anything else opening in the window cancels a pending confirmation
    mBox.classList.remove("is-confirm");
    mBox.setAttribute("role", "dialog");
    mBox.removeAttribute("aria-describedby");
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
    onConfirm = null; // closing (✕, a click outside, Esc, Cancel) never deletes anything
    if (modalFocus && modalFocus.focus) modalFocus.focus({ preventScroll: true });
  }
  function openDoc(id) {
    if (DOCS[canon(id)]) id = canon(id); // a handbook chapter opens its Knowledge Hub document
    const d = DOCS[id];
    if (!d) return;
    showModal({ kicker: d.kind, title: d.title, html: d.html, pinId: id });
    if (d.mount) d.mount(mBody);
    touchRecent(id);
  }
  /* ---------- Confirm before deleting ----------
     Asks in the same document window, so it looks and closes like every other one.
     Cancel, ✕, a click outside or Esc only close it. Delete closes it and then runs
     onConfirm: the delete code that used to run straight away. Used by the Admin Panel
     (news) and QualiChat (previous chats, through window.qp.confirmDelete).
     item = { name, sub, icon } describes what will be deleted (name is shown as typed). */
  function confirmDelete({ kicker, title, item, text, onConfirm: run }) {
    showModal({
      kicker,
      title,
      html: `<div class="rows admin-list"><div class="row">${item.icon ? `<div class="news-ico">${item.icon}</div>` : ""}<span><strong data-no-tr>${esc(item.name)}</strong>${item.sub ? `<small>${esc(item.sub)}</small>` : ""}</span></div></div>
        <p class="confirm-text" id="confirm-text">${esc(text)}</p>
        <div class="modal-foot">
          <button type="button" class="btn" data-confirm="cancel">Cancel</button>
          <button type="button" class="btn primary" data-confirm="delete">Delete</button>
        </div>`,
    });
    onConfirm = run;
    mBox.classList.add("is-confirm");
    mBox.setAttribute("role", "alertdialog");
    mBox.setAttribute("aria-describedby", "confirm-text");
    mBody.querySelector('[data-confirm="cancel"]').focus({ preventScroll: true }); // the safe choice has the focus
  }
  mBody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-confirm]");
    if (!b) return;
    const run = b.dataset.confirm === "delete" ? onConfirm : null;
    closeModal(); // focus goes back to the trash button first, so the delete code can move it on
    if (run) run();
  });
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
     Quick access: Favorites (big cards the user picks, removes and reorders)
     + Recent (the last things opened, filled in automatically)
     Saved in localStorage: "qp-favorites" (ids in order), "qp-recent" ([{id, t}]).
     An id is a DOCS key ("devportal") or a page ("view:projects").
     ===================================================================== */
  const sym = (id) => `<svg class="ico"><use href="#${id}" /></svg>`;
  /* the six suggested cards (listed first in the "Add favorite" picker): their own title, subtitle and icon */
  const FAV_CARDS = {
    devportal: { title: "Dev Portal", sub: "Engineering tools", icon: "i-code" },
    cicd: { title: "CI/CD Status", sub: "Builds & deployments", icon: "i-server" },
    "employee-handbook": { title: "Handbook", sub: "People & policies", icon: "i-book" },
    inventory: { title: "IT Inventory", sub: "Devices & access", icon: "i-laptop" },
    "view:projects": { title: "Projects", sub: "Team workspaces", icon: "i-flow" },
    directory: { title: "Directory", sub: "Find a colleague", icon: "i-users" },
  };
  const FAV_DEFAULT = Object.keys(FAV_CARDS);
  const FAV_MAX = 12;
  /* pages that can be a favorite */
  const FAV_VIEWS = {
    news: { sub: "Company updates", icon: "i-news" },
    knowledge: { sub: "Document library", icon: "i-library" },
    it: { sub: "Help & tickets", icon: "i-headset" },
    projects: { sub: "Team workspaces", icon: "i-flow" },
    forum: { sub: "Links, tips & discussions", icon: "i-forum" },
  };
  /* Everything a favorite or recent card needs to know about an id (null if it no longer exists) */
  function quickItem(id) {
    if (id.startsWith("view:")) {
      const v = id.slice(5);
      if (!FAV_VIEWS[v] || !VIEWS[v]) return null;
      const c = FAV_CARDS[id] || {};
      return { id, title: c.title || VIEWS[v], sub: c.sub || FAV_VIEWS[v].sub, kind: "Page", icon: sym(c.icon || FAV_VIEWS[v].icon) };
    }
    const d = DOCS[id];
    if (!d) return null;
    const c = FAV_CARDS[id];
    return {
      id,
      title: c ? c.title : d.title,
      sub: c ? c.sub : d.kind,
      kind: d.kind,
      icon: c ? sym(c.icon) : d.icon,
    };
  }
  function openQuick(id) {
    if (id.startsWith("view:")) {
      showView(id.slice(5));
      touchRecent(id);
    } else openDoc(id); // openDoc records it under Recent itself
  }
  function loadFavs() {
    let list = store.get("qp-favorites", null);
    if (!Array.isArray(list)) list = []; // a new user starts with no favorites, just the "Add favorite" card
    list = list.filter((id) => typeof id === "string").map(canon); // a saved handbook chapter becomes its hub document
    return [...new Set(list)].filter((id) => quickItem(id)).slice(0, FAV_MAX);
  }
  /* recently opened, newest first; a saved handbook chapter becomes its hub document (listed once) */
  function loadRecent(fallback) {
    const seen = new Set();
    return store
      .get("qp-recent", fallback)
      .filter((r) => r && typeof r.id === "string")
      .map((r) => ({ ...r, id: canon(r.id) }))
      .filter((r) => !seen.has(r.id) && seen.add(r.id) && quickItem(r.id));
  }
  let favs = loadFavs();
  let recent = loadRecent([]);
  let favEditing = false;
  const RECENT_SHOWN = 6; // how many recent items the dashboard shows
  const isFav = (id) => favs.includes(id);
  const saveFavs = () => store.set("qp-favorites", favs);
  function toggleFav(id, quiet) {
    const it = quickItem(id);
    if (!it) return;
    if (isFav(id)) favs = favs.filter((f) => f !== id);
    else if (favs.length >= FAV_MAX) return notify(`You can have up to ${FAV_MAX} favorites. Remove one first.`);
    else favs = [...favs, id];
    saveFavs();
    if (!quiet) notify(isFav(id) ? `Added ${it.title} to favorites` : `Removed ${it.title} from favorites`);
    renderQuick();
    syncPinButton();
  }
  function moveFav(id, to) {
    const from = favs.indexOf(id);
    if (from < 0 || to < 0 || to >= favs.length || to === from) return false;
    favs.splice(from, 1);
    favs.splice(to, 0, id);
    saveFavs();
    renderQuick();
    return true;
  }
  function touchRecent(id) {
    if (!quickItem(id)) return;
    recent = [{ id, t: Date.now() }, ...recent.filter((r) => r.id !== id)].slice(0, 8);
    store.set("qp-recent", recent);
    renderQuick();
  }
  /* the star in the document window adds / removes that document as a favorite */
  function syncPinButton() {
    if (!modalDoc) return;
    const on = isFav(modalDoc),
      label = on ? "Remove from favorites" : "Add to favorites";
    mPin.classList.toggle("on", on);
    mPin.setAttribute("aria-pressed", on);
    mPin.setAttribute("aria-label", label);
    mPin.title = label;
  }
  mPin.addEventListener("click", () => modalDoc && toggleFav(modalDoc));

  const favGrid = $("#fav-grid"),
    favEditBtn = $("#fav-edit"),
    recentList = $("#recent-list");
  const starBtn = (id, title) => {
    const on = isFav(id);
    return `<button type="button" class="star${on ? " on" : ""}" data-fav-toggle="${esc(id)}" aria-pressed="${on}" aria-label="${on ? "Remove" : "Add"} ${esc(title)} ${on ? "from" : "to"} favorites" title="${on ? "Remove from" : "Add to"} favorites">${sym("i-star")}</button>`;
  };
  function renderQuick() {
    /* Favorites */
    const cards = favs.map((id, i) => {
      const it = quickItem(id),
        t = esc(it.title);
      return `<div class="fav" role="listitem" data-fav="${esc(id)}"${favEditing ? ' draggable="true"' : ""}>
        <button type="button" class="tile fav-open" data-open="${esc(id)}"${favEditing ? ' tabindex="-1" aria-hidden="true"' : ""}><span class="news-ico">${it.icon}</span><strong>${t}</strong><small>${esc(it.sub)}</small></button>
        ${
          favEditing
            ? `<div class="fav-tools">
          <button type="button" data-fav-move="-1" aria-label="Move ${t} earlier"${i ? "" : " disabled"}>${sym("i-chev")}</button>
          <button type="button" data-fav-move="1" aria-label="Move ${t} later"${i < favs.length - 1 ? "" : " disabled"}>${sym("i-chev")}</button>
          <button type="button" class="fav-remove" data-fav-remove aria-label="Remove ${t} from favorites">✕</button>
        </div>`
            : `<button type="button" class="fav-x" data-fav-remove aria-label="Remove ${t} from favorites" title="Remove from favorites">×</button>`
        }
      </div>`;
    });
    /* one dashed "Add favorite" card right after the last favorite (centred on its own when there are none) */
    if (favs.length < FAV_MAX)
      cards.push(
        `<div class="fav" role="listitem"><button type="button" class="fav-add" data-fav-pick><span class="news-ico">${sym("i-plus")}</span><strong>Add favorite</strong><small>Tools, documents, pages</small></button></div>`,
      );
    favGrid.innerHTML = cards.join("");
    favGrid.classList.toggle("editing", favEditing);
    favGrid.classList.toggle("is-empty", !favs.length);
    $("#fav-hint").hidden = !favEditing;

    /* Recent: compact cards in a row; nothing opened yet = one helper line */
    recentList.innerHTML = recent
      .slice(0, RECENT_SHOWN)
      .map(({ id, t }) => {
        const it = quickItem(id);
        return `<div class="recent-card" role="listitem"><button type="button" class="recent-open" data-open="${esc(id)}"><span class="news-ico">${it.icon}</span><span><strong>${esc(it.title)}</strong><small>${esc(it.kind)} · ${ago(t)}</small></span></button>${starBtn(id, it.title)}</div>`;
      })
      .join("");
    recentList.hidden = !recent.length;
    $("#recent-help").hidden = recent.length > 0;
    $("#recent-clear").hidden = !recent.length;
  }
  function setFavEditing(on) {
    favEditing = on;
    favEditBtn.textContent = on ? "Done" : "Edit";
    favEditBtn.setAttribute("aria-pressed", on);
    renderQuick();
  }
  favEditBtn.addEventListener("click", () => {
    setFavEditing(!favEditing);
    if (!favEditing) favEditBtn.focus();
  });
  /* "Add favorite": a picker in the shared document window */
  function pickerHtml() {
    const ids = [...FAV_DEFAULT, ...Object.keys(FAV_VIEWS).map((v) => "view:" + v), ...Object.keys(DOCS)].filter((id) => !MOVED[id]); // handbook chapters: listed once, as hub documents
    const groups = {};
    [...new Set(ids)].forEach((id) => {
      const it = quickItem(id);
      if (it) (groups[{ Page: "Pages", Tool: "Tools" }[it.kind] || it.kind] ||= []).push(it);
    });
    return (
      `<p class="fav-pick-note">Choose what appears as a card under Favorites. ${favs.length} of ${FAV_MAX} used.</p>` +
      Object.entries(groups)
        .map(
          ([g, items]) =>
            `<h4>${esc(g)}</h4><div class="fav-pick">${items
              .map((it) => {
                const on = isFav(it.id);
                return `<button type="button" class="fav-pick-item${on ? " on" : ""}" data-fav-pick-toggle="${esc(it.id)}" aria-pressed="${on}"><span class="news-ico">${it.icon}</span><span><strong>${esc(it.title)}</strong><small>${esc(it.sub)}</small></span><i>${on ? "Added" : "Add"}</i></button>`;
              })
              .join("")}</div>`,
        )
        .join("")
    );
  }
  function openPicker() {
    showModal({ kicker: "Quick access", title: "Add favorites", html: pickerHtml() });
  }
  mBody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav-pick-toggle]");
    if (!b) return;
    toggleFav(b.dataset.favPickToggle, true);
    const id = b.dataset.favPickToggle;
    mBody.innerHTML = pickerHtml();
    mBody.querySelector(`[data-fav-pick-toggle="${CSS.escape(id)}"]`)?.focus();
  });

  $("#quick").addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]"),
      tog = e.target.closest("[data-fav-toggle]"),
      move = e.target.closest("[data-fav-move]"),
      rm = e.target.closest("[data-fav-remove]");
    if (tog) return toggleFav(tog.dataset.favToggle);
    if (e.target.closest("[data-fav-pick]")) return openPicker();
    if (move || rm) {
      const id = e.target.closest("[data-fav]").dataset.fav,
        title = quickItem(id).title;
      if (rm) {
        const at = favs.indexOf(id);
        toggleFav(id, true);
        notify(`Removed ${title} from favorites`);
        (favGrid.querySelectorAll("[data-fav-remove]")[Math.min(at, favs.length - 1)] || favGrid.querySelector("[data-fav-pick]") || favEditBtn)?.focus();
      } else if (moveFav(id, favs.indexOf(id) + +move.dataset.favMove)) {
        const btn = favGrid.querySelector(`[data-fav="${CSS.escape(id)}"] [data-fav-move="${move.dataset.favMove}"]`);
        (btn && !btn.disabled ? btn : favGrid.querySelector(`[data-fav="${CSS.escape(id)}"] [data-fav-move]:not([disabled])`))?.focus();
      }
      return;
    }
    if (open && !favEditing) openQuick(open.dataset.open);
  });
  $("#recent-clear").addEventListener("click", () => {
    recent = [];
    store.set("qp-recent", recent);
    renderQuick();
    $("#fav-edit").focus();
  });
  $("[data-open-search]").addEventListener("click", () => openPalette()); // the top search, with the cursor in it

  /* reorder favorites by dragging (Edit mode, mouse); touch and keyboard use the arrows */
  let dragFav = null;
  favGrid.addEventListener("dragstart", (e) => {
    const f = e.target.closest("[data-fav]");
    if (!favEditing || !f) return e.preventDefault();
    dragFav = f.dataset.fav;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragFav);
    requestAnimationFrame(() => f.classList.add("fav-dragging"));
  });
  favGrid.addEventListener("dragover", (e) => {
    const over = e.target.closest("[data-fav]");
    if (!dragFav || !over) return;
    e.preventDefault();
    if (over.dataset.fav === dragFav) return;
    const to = favs.indexOf(over.dataset.fav);
    favs.splice(favs.indexOf(dragFav), 1);
    favs.splice(to, 0, dragFav);
    /* move the element itself so the drag keeps going; saved on drop */
    const el = favGrid.querySelector(`[data-fav="${CSS.escape(dragFav)}"]`);
    favGrid.insertBefore(el, favs.indexOf(dragFav) > [...favGrid.children].indexOf(over) ? over.nextSibling : over);
  });
  const endFavDrag = () => {
    if (!dragFav) return;
    dragFav = null;
    saveFavs();
    renderQuick();
  };
  favGrid.addEventListener("drop", (e) => {
    e.preventDefault();
    endFavDrag();
  });
  favGrid.addEventListener("dragend", endFavDrag);

  /* Lets a script that runs later (js/knowledge.js) add its own documents to DOCS,
     so they open, can be favorites and show up under Recent exactly like the ones above.
     Favorites + recent are re-read from the browser afterwards: entries saved there
     were dropped when this file loaded, because their document was not known yet. */
  function addDocs(entries) {
    Object.assign(DOCS, entries);
    favs = loadFavs();
    recent = loadRecent(recent);
    renderQuick();
  }
  renderQuick();

  /* =====================================================================
     Command palette (Cmd/Ctrl + K)
     ===================================================================== */
  const pal = $("#cmdk"),
    palQ = $("#cmdk-q"),
    palList = $("#cmdk-list");
  /* the same line icons as the sidebar, so search looks like the rest of the app */
  const VIEW_ICONS = {
    dashboard: sym("i-home"),
    news: sym("i-news"),
    knowledge: sym("i-library"),
    it: sym("i-headset"),
    projects: sym("i-flow"),
    forum: sym("i-forum"),
    settings: ICON.cog,
    admin: sym("i-shield"),
  };
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
          icon: (quickItem(id) || d).icon, // same icon as on the Favorites cards
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
          run: () => {
            showView(id);
            if (FAV_VIEWS[id]) touchRecent("view:" + id);
          },
        })),
      ...docs("Tool"),
      ...docs("Handbook"),
      { group: "Actions", label: "Toggle theme", icon: svgIcon("i-moon"), hint: "D", keys: "dark light mode appearance", run: toggleTheme },
      { group: "Actions", label: "Open settings", icon: ICON.cog, hint: "S", keys: "settings preferences language svenska english theme help", run: () => setTimeout(toggleSettings) },
      {
        group: "Actions",
        label: "Replay tour",
        icon: svgIcon("i-help"),
        keys: "guide help onboarding walkthrough",
        run: () => {
          closeOverlays();
          window.qpTour.start();
        },
      },
      { group: "Actions", label: "Open QualiChat", icon: ICON.spark, keys: "ai assistant chat ask", run: () => window.qpChat.open() },
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
        icon: svgIcon("i-bell"),
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
    /* a result whose name starts with what was typed goes first ("open settings" -> Open settings) */
    const q = query.toLowerCase();
    if (q) palItems.sort((a, b) => !a.label.toLowerCase().startsWith(q) - !b.label.toLowerCase().startsWith(q));
    if (query)
      palItems.push({
        group: "Ask",
        label: `Ask QualiChat: “${query}”`,
        icon: ICON.spark,
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
    { icon: svgIcon("i-server"), title: "core-api deployed to production", by: "CI/CD · #1842", status: "ok", min: 4 },
    { icon: ICON.ext, title: "Core v4.2 release notes published", by: "Engineering", status: "info", label: "Release", min: 38 },
    { icon: svgIcon("i-shield"), title: "Security policy acknowledged", by: "Maja Berg", status: "ok", label: "Signed", min: 95 },
    { icon: svgIcon("i-server"), title: "data-ingest integration tests", by: "CI/CD · #310", status: "bad", min: 170 },
    { icon: ICON.spark, title: "Linnea joined Engineering Guild", by: "People", status: "info", label: "New", min: 300 },
  ];
  const FEED_POOL = [
    { icon: svgIcon("i-server"), title: "web-intranet build finished", by: "CI/CD · #771", status: "ok" },
    { icon: svgIcon("i-shield"), title: "Security policy acknowledged", by: "Jonas Ek", status: "ok", label: "Signed" },
    { icon: svgIcon("i-server"), title: "poc-retail-ai deploying to staging", by: "CI/CD · #59", status: "run" },
    { icon: ICON.ext, title: "Core v4.2.1 hotfix tagged", by: "Platform", status: "info", label: "Release" },
    { icon: svgIcon("i-shield"), title: "Security key registered", by: "Omar Haddad", status: "ok", label: "MFA" },
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
  const LINK_ICONS = ["i-board", "i-code", "i-doc", "i-link", "i-users", "i-flow"]; // SVG symbols in index.html
  let links = store.get("qp-quicklinks", LINK_DEFAULTS);
  const quickNav = $("#quick-nav");
  function renderLinks() {
    quickNav.innerHTML = links.length
      ? links
          .map(
            (l, n) =>
              `<button type="button" data-link="${n}" title="${esc(l.label)}"><span class="nav-icon"><svg class="ico"><use href="#${LINK_ICONS[n % LINK_ICONS.length]}" /></svg></span><span class="label">${esc(l.label)}</span><span class="ext"><svg class="ico"><use href="#i-ext" /></svg></span></button>`,
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
     News + Admin Panel (HR + Manager): publish news articles and calendar events.
     Both lists are saved in localStorage ("qp-news-v2", "qp-events"), so they
     only exist in this browser. News fills the dashboard slideshow and the
     News view; events are drawn by js/calendar.js.
     ===================================================================== */
  const NEWS_CATS = {
    company: ["Company", ICON.sun],
    engineering: ["Engineering", ICON.ext],
    security: ["Security", "◈"],
    hr: ["HR & policies", "▣"],
    people: ["People", ICON.spark],
  };
  const EVENT_TYPES = { meeting: "Meeting", event: "Event", deadline: "Deadline" };
  const HOME_SLIDES = 5; // how many of the newest articles the dashboard slideshow shows
  const SLIDE_EVERY = 6000; // ms between automatic slides (paused on hover / focus)
  /* Built-in covers (assets/news, photos from Unsplash). An article without its own image gets its category's cover. */
  const NEWS_COVERS = {
    company: "assets/news/office.jpg",
    engineering: "assets/news/engineering.jpg",
    security: "assets/news/security.jpg",
    hr: "assets/news/hr.jpg",
    people: "assets/news/people.jpg",
  };
  /* The articles every browser starts with. They are copied into localStorage on the first visit;
     after that the saved list is the source, and new articles are added to its front. */
  const NEWS_DEFAULTS = [
    {
      id: "mfa-rollout",
      title: "Multi-factor authentication rollout",
      text: "Register your security key by Jun 15.",
      body: "From June 15 every QualiPro account signs in with a hardware security key. Pick up two YubiKeys at the service desk (one primary, one backup) and register both under IT support. Lost a key? Report it within 24 hours so it can be blocked.",
      cat: "security",
      date: "2026-06-08",
      img: "assets/news/security.jpg",
    },
    {
      id: "core-42",
      title: "QualiPro Core v4.2 is here",
      text: "Release notes from Engineering.",
      body: "Core v4.2 brings event-driven notifications, a 35% faster search API and the new role-based access layer. The legacy /v1/auth endpoints are deprecated and will be removed in v4.4, so plan your migration this quarter.",
      cat: "engineering",
      date: "2026-06-05",
      img: "assets/news/engineering.jpg",
    },
    {
      id: "midsummer",
      title: "Office closed on Midsummer Eve",
      text: "Plan deliveries and support cover early.",
      body: "All offices are closed on Midsummer Eve. Agree on support cover with your team before then, and move client deliveries that land on that day. Glad midsommar!",
      cat: "company",
      date: "2026-06-03",
      img: "assets/news/midsummer.jpg",
    },
    {
      id: "parental-leave",
      title: "Updated parental leave guide",
      text: "Now in the Knowledge Hub.",
      body: "The parental leave chapter has been rewritten with clearer steps, a planning checklist and the new top-up rules: 90% of your salary for six months. Find it in the Knowledge Hub, under HR Guidelines.",
      cat: "hr",
      date: "2026-05-28",
      img: "assets/news/hr.jpg",
    },
    {
      id: "new-consultants",
      title: "Welcome to our new consultants",
      text: "Six people joined in May.",
      body: "Six consultants joined QualiPro in May, across Engineering, POC Studio and Talent. Say hello at Friday's after-work, and find them in the Directory.",
      cat: "people",
      date: "2026-05-22",
      img: "assets/news/people.jpg",
    },
  ];
  const NEWS_KEY = "qp-news-v2"; // v2: the whole list (defaults + published), newest first
  const savedList = (key) => {
    const v = store.get(key, []);
    return Array.isArray(v) ? v.filter((x) => x && x.id && x.title && /^\d{4}-\d\d-\d\d$/.test(x.date)) : [];
  };
  /* Only images we made or can trust: an uploaded data: image, a web address, or one of our own covers */
  const safeImg = (src) =>
    typeof src === "string" &&
    (/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src) ||
      /^https?:\/\/[^\s"'<>()]+$/.test(src) ||
      /^assets\/news\/[\w.-]+$/.test(src))
      ? src
      : "";
  function loadNews() {
    const saved = store.get(NEWS_KEY, null);
    let list = Array.isArray(saved) ? saved : null;
    if (!list) {
      /* first visit: the defaults, with anything published by the older Admin Panel ("qp-news") in front */
      const older = savedList("qp-news")
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((n) => ({ ...n, own: true }));
      list = [...older, ...NEWS_DEFAULTS];
      store.set(NEWS_KEY, list);
    }
    return list
      .filter((x) => x && x.id && x.title && /^\d{4}-\d\d-\d\d$/.test(x.date))
      .map((x) => ({ ...x, id: String(x.id), cat: NEWS_CATS[x.cat] ? x.cat : "company", img: safeImg(x.img) }));
  }
  let news = loadNews(),
    events = savedList("qp-events");
  const saveNews = () => {
    try {
      localStorage.setItem(NEWS_KEY, JSON.stringify(news));
      return true;
    } catch (e) {
      return false; // full: usually too many uploaded images
    }
  };
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
  const cover = (n) => n.img || NEWS_COVERS[n.cat] || NEWS_COVERS.company;
  const longDate = (iso) => day(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  /* a cover that fails to load (dead link, offline) falls back to its category's built-in cover */
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.cover || img.dataset.failed) return;
      img.dataset.failed = "1";
      img.src = NEWS_COVERS[img.dataset.cover] || NEWS_COVERS.company;
    },
    true,
  );

  /* ---------- News view: list + article reader ---------- */
  const newsAll = $("#news-all"),
    reader = $("#news-reader");
  function renderNewsList() {
    if (!newsAll) return;
    newsAll.innerHTML = news.length
      ? news
          .map(
            (n) =>
              `<button type="button" class="news-item news-row" data-open-news="${esc(n.id)}"><img class="news-thumb" src="${esc(cover(n))}" data-cover="${n.cat}" alt="" loading="lazy" /><span class="news-copy"><strong>${esc(n.title)}</strong><small>${esc(n.text || "")}</small></span><time class="date" datetime="${n.date}">${newsDate(n.date)}</time></button>`,
          )
          .join("")
      : `<div class="empty-note">No news yet.</div>`;
    markOpen();
  }
  let openId = null;
  const markOpen = () =>
    newsAll?.querySelectorAll("[data-open-news]").forEach((b) => b.classList.toggle("open", b.dataset.openNews === openId));
  /* Opens an article in the News view (from the slideshow, the list, or anywhere with data-open-news) */
  /* Every article has its own address, "#news/<id>": it can be shared, bookmarked, and Back / Forward work */
  const articleUrl = (id) => location.href.split("#")[0] + "#news/" + encodeURIComponent(id);
  function openArticle(id, { fromHistory = false } = {}) {
    const n = news.find((x) => x.id === id);
    if (!n || !reader) return;
    const wasHidden = $('.view[data-view="news"]').hidden;
    if (wasHidden) showView("news", { push: !fromHistory });
    if (!fromHistory && location.hash !== "#news/" + encodeURIComponent(id))
      history[wasHidden ? "replaceState" : "pushState"](null, "", "#news/" + encodeURIComponent(id));
    openId = id;
    reader.innerHTML = `<img class="news-reader-cover" src="${esc(cover(n))}" data-cover="${n.cat}" alt="" />
      <div class="news-reader-body">
        <div class="news-reader-meta">
          <span>${esc(cat(n)[0])}</span><time datetime="${n.date}">${longDate(n.date)}</time>
          <div class="news-share">
            <button type="button" class="btn share-btn" data-share-mail="${esc(n.id)}"><svg class="ico"><use href="#i-mail" /></svg>Share via Email</button>
            <button type="button" class="btn share-btn" data-share-copy="${esc(n.id)}"><svg class="ico"><use href="#i-link" /></svg>Copy link</button>
          </div>
        </div>
        <h2 id="news-reader-title">${esc(n.title)}</h2>
        <p class="news-reader-lead">${esc(n.text || "")}</p>
        ${n.body ? `<p>${esc(n.body)}</p>` : ""}
        <button type="button" class="btn" data-close-reader>← All news</button>
      </div>`;
    reader.hidden = false;
    markOpen();
    scrollTo({ top: 0 });
    reader.focus({ preventScroll: true });
  }
  function closeArticle(refocus) {
    if (!reader || reader.hidden) return;
    const was = openId;
    if (location.hash.startsWith("#news/")) history.replaceState(null, "", "#news"); // back to the list's address
    reader.hidden = true;
    openId = null;
    markOpen();
    if (refocus) newsAll.querySelector(`[data-open-news="${CSS.escape(was)}"]`)?.focus();
  }
  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open-news]");
    if (open && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault(); // the slides are links to #news; we open the article ourselves
      if (!slider || !slider.contains(open) || !slider.dataset.swiped) openArticle(open.dataset.openNews);
    } else if (e.target.closest("[data-close-reader]")) closeArticle(true);
    else if (e.target.closest('[data-view-link="news"]')) closeArticle(); // "View all" / sidebar: back to the list
  });
  /* ---------- Share an article: email draft (mailto:) or copy its link ---------- */
  /* The email follows the language chosen in Settings: tr() (js/app.js) gives the Swedish text from
     js/lang-sv.js. An article written in the Admin Panel has no translation and is sent as written. */
  function shareText(n) {
    const sv = document.documentElement.lang === "sv",
      title = tr(n.title),
      date = sv ? day(n.date).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : longDate(n.date),
      words = [n.text, n.body]
        .filter(Boolean)
        .map((t) => tr(t.trim()))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      excerpt = words.length > 320 ? words.slice(0, 320).replace(/\s+\S*$/, "") + "…" : words;
    return {
      subject: `${tr("QualiPro News:")} ${title}`,
      body: `${title}\n${date}\n\n${excerpt}\n\n${tr("Read it on the intranet:")}\n${articleUrl(n.id)}\n`,
    };
  }
  /* "mailto:?subject=…&body=…", every part URL-encoded; line breaks as CRLF, which mail apps expect */
  function articleMailto(id) {
    const n = news.find((x) => x.id === id);
    if (!n) return null;
    const { subject, body } = shareText(n);
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
  }
  function shareByMail(id) {
    const mailtoUrl = articleMailto(id);
    if (!mailtoUrl) return;
    notify("Opening email draft…");
    window.location.href = mailtoUrl; // the default mail app (Outlook, Apple Mail…) opens with the draft
  }
  async function copyArticleLink(id) {
    const url = articleUrl(id);
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      /* older browsers / no permission: copy through a hidden text field */
      const t = Object.assign(document.createElement("textarea"), { value: url });
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      if (!ok) return notify("Couldn't copy the link. Copy it from the address bar.");
    }
    notify("Link copied");
  }
  document.addEventListener("click", (e) => {
    const m = e.target.closest("[data-share-mail]"),
      c = e.target.closest("[data-share-copy]");
    if (m) shareByMail(m.dataset.shareMail);
    else if (c) copyArticleLink(c.dataset.shareCopy);
  });
  /* Back / Forward between articles, and opening a shared "#news/<id>" link */
  const linkedArticle = () => {
    const m = location.hash.match(/^#news\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  addEventListener("popstate", () => {
    const id = linkedArticle();
    if (id) openArticle(id, { fromHistory: true });
    else if (location.hash === "#news") closeArticle();
  });

  /* leaving the News view (sidebar, search, back button) puts the article away */
  const newsView = $('.view[data-view="news"]');
  if (newsView) new MutationObserver(() => newsView.hidden && closeArticle()).observe(newsView, { attributeFilter: ["hidden"] });

  /* ---------- Dashboard slideshow (#news-home) ---------- */
  const slider = $("#news-home");
  let slideAt = 0,
    slideTimer = 0,
    slideHold = 0; // > 0 while the pointer is over the slideshow or focus is inside it
  const slides = () => news.slice(0, HOME_SLIDES);
  function renderSlider() {
    if (!slider) return;
    const list = slides();
    slideAt = Math.min(slideAt, Math.max(0, list.length - 1));
    if (!list.length) {
      slider.innerHTML = `<div class="news-slider-empty">No news yet. Published articles show up here.</div>`;
      return;
    }
    slider.innerHTML = `<div class="news-track">${list
      .map(
        (n, i) =>
          `<a class="news-slide" href="#news" data-open-news="${esc(n.id)}" aria-roledescription="slide" aria-label="${i + 1} of ${list.length}: ${esc(n.title)}">
            <img src="${esc(cover(n))}" data-cover="${n.cat}" alt="" ${i ? 'loading="lazy"' : ""} />
            <span class="news-slide-copy"><strong>${esc(n.title)}</strong><span class="read-more">Read more →</span></span>
          </a>`,
      )
      .join("")}</div>${
      list.length > 1
        ? `<button type="button" class="news-nav prev" data-slide-step="-1" aria-label="Previous news"><svg class="ico"><use href="#i-chev" /></svg></button>
      <button type="button" class="news-nav next" data-slide-step="1" aria-label="Next news"><svg class="ico"><use href="#i-chev" /></svg></button>
      <div class="news-dots" role="group" aria-label="Choose a news story">${list
        .map((n, i) => `<button type="button" data-slide-to="${i}" aria-label="Show news ${i + 1}: ${esc(n.title)}"></button>`)
        .join("")}</div>`
        : ""
    }`;
    showSlide(slideAt, false);
  }
  function showSlide(i, user = true) {
    const all = slider.querySelectorAll(".news-slide"),
      n = all.length;
    if (!n) return;
    slideAt = (i + n) % n;
    slider.querySelector(".news-track").style.transform = `translateX(${-100 * slideAt}%)`;
    all.forEach((s, k) => (s.inert = k !== slideAt)); // only the visible slide can be tabbed to or read out
    slider.querySelectorAll("[data-slide-to]").forEach((d, k) => d.setAttribute("aria-current", k === slideAt));
    if (user) scheduleSlide(); // a manual change restarts the 6 s wait
  }
  /* Auto-advance: only while the slideshow is on screen, nobody is pointing at it or typing in it,
     the dashboard is not being rearranged, and the user has not asked for reduced motion */
  function scheduleSlide() {
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
      const busy =
        slideHold > 0 || document.hidden || !slider.offsetParent || document.body.classList.contains("is-customizing") || reduce();
      if (!busy) showSlide(slideAt + 1, false);
      scheduleSlide();
    }, SLIDE_EVERY);
  }
  if (slider) {
    slider.addEventListener("click", (e) => {
      const step = e.target.closest("[data-slide-step]"),
        to = e.target.closest("[data-slide-to]");
      if (step) showSlide(slideAt + +step.dataset.slideStep);
      else if (to) showSlide(+to.dataset.slideTo);
    });
    slider.addEventListener("keydown", (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (!step || e.target.closest(".dash-handle")) return;
      e.preventDefault();
      showSlide(slideAt + step);
      slider.querySelectorAll(".news-slide")[slideAt].focus({ preventScroll: true });
    });
    slider.addEventListener("pointerenter", () => slideHold++);
    slider.addEventListener("pointerleave", () => {
      slideHold = Math.max(0, slideHold - 1);
      scheduleSlide();
    });
    slider.addEventListener("focusin", () => slideHold++);
    slider.addEventListener("focusout", () => {
      slideHold = Math.max(0, slideHold - 1);
      scheduleSlide();
    });
    /* swipe left / right on touch screens (a swipe does not open the article) */
    let swipe = null;
    slider.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") swipe = { x: e.clientX, y: e.clientY };
      delete slider.dataset.swiped;
    });
    slider.addEventListener("pointerup", (e) => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - swipe.y)) {
        slider.dataset.swiped = "1";
        showSlide(slideAt + (dx < 0 ? 1 : -1));
      }
      swipe = null;
    });
    slider.addEventListener("pointercancel", () => (swipe = null));
    scheduleSlide();
  }
  function renderNews(first) {
    if (first) slideAt = 0; // a new article becomes the active slide
    renderSlider();
    renderNewsList();
    if (openId && !news.some((n) => n.id === openId)) closeArticle();
  }
  const adminRow = (kind, id, icon, title, sub) =>
    `<div class="row"><div class="news-ico">${icon}</div><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><button type="button" class="icon-btn" data-del="${kind}" data-id="${esc(id)}" aria-label="Remove ${esc(title)}"><svg class="ico"><use href="#i-trash" /></svg></button></div>`;
  function renderAdmin() {
    const byDate = (a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""));
    const draw = (sel, rows, empty) =>
      ($(sel).innerHTML = rows.length ? `<div class="rows admin-list">${rows.join("")}</div>` : `<div class="empty-note">${empty}</div>`);
    draw(
      "#admin-news-list",
      news.filter((n) => n.own).map((n) => adminRow("news", n.id, `<img src="${esc(cover(n))}" data-cover="${n.cat}" alt="" />`, n.title, `${cat(n)[0]} · ${newsDate(n.date)}`)),
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
    $("#admin-news-count").textContent = news.filter((n) => n.own).length;
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
    /* ---------- Cover image: upload (resized + compressed here) or web address, with a live preview ---------- */
    const imgFile = $("#admin-img-file"),
      imgUrl = $("#admin-img-url"),
      imgPrev = $("#admin-img-preview img"),
      imgTag = $("#admin-img-tag"),
      imgNote = $("#admin-img-note"),
      imgClear = $("#admin-img-clear"),
      IMG_NOTE = imgNote.textContent;
    let upload = ""; // data: URL of the processed upload
    function showPreview() {
      const url = imgUrl.value.trim(),
        own = upload || (safeImg(url) && /^https?:/.test(url) ? url : "");
      imgPrev.dataset.cover = newsForm.elements.cat.value;
      delete imgPrev.dataset.failed;
      imgPrev.src = own || NEWS_COVERS[newsForm.elements.cat.value] || NEWS_COVERS.company;
      imgTag.textContent = upload ? "Uploaded image" : own ? "Image from the web" : "Default cover";
      imgClear.hidden = !own;
    }
    /* Shrinks a photo to fit 1280 × 800 and saves it as JPEG, lowering the quality until it is under ~300 KB,
       so a few dozen articles fit in the browser's storage (about 5 MB). */
    async function compress(file) {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = url;
        });
        let scale = Math.min(1, 1280 / img.naturalWidth, 800 / img.naturalHeight),
          q = 0.82,
          out = "";
        for (let tries = 0; tries < 8; tries++) {
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const g = c.getContext("2d");
          g.fillStyle = "#fff"; // transparent PNGs get a white background instead of black
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL("image/jpeg", q);
          if (out.length < 400000) break; // ~300 KB of image data
          if (q > 0.55) q -= 0.1;
          else scale *= 0.8;
        }
        return out;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    imgFile.addEventListener("change", async () => {
      const file = imgFile.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 20e6) {
        imgFile.value = "";
        return notify("Pick an image file under 20 MB");
      }
      imgNote.textContent = "Preparing the image…";
      try {
        upload = await compress(file);
        imgUrl.value = ""; // the upload wins over a pasted address
        imgNote.textContent = `${file.name} · resized to ${Math.round((upload.length * 0.75) / 1024)} KB`;
      } catch (err) {
        upload = "";
        imgNote.textContent = IMG_NOTE;
        notify("That image could not be read");
      }
      imgFile.value = "";
      showPreview();
    });
    imgUrl.addEventListener("input", () => {
      if (imgUrl.value.trim()) {
        upload = "";
        imgNote.textContent = IMG_NOTE;
      }
      showPreview();
    });
    imgClear.addEventListener("click", () => {
      upload = "";
      imgUrl.value = "";
      imgNote.textContent = IMG_NOTE;
      showPreview();
      imgFile.focus();
    });
    newsForm.elements.cat.addEventListener("change", showPreview);
    const resetImage = () => {
      upload = "";
      imgNote.textContent = IMG_NOTE;
      showPreview();
    };

    newsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!isAdmin()) return notify("Only HR and managers can publish");
      const f = newsForm.elements,
        title = f.title.value.trim(),
        text = f.text.value.trim(),
        url = imgUrl.value.trim();
      if (!title || !text) return (title ? f.text : f.title).focus();
      if (url && !upload && !safeImg(url)) {
        notify("Use an image address that starts with https://");
        return imgUrl.focus();
      }
      const n = { id: newId(), title, text, cat: f.cat.value, date: f.date.value, img: upload || url, own: true };
      news.unshift(n); // newest first: it becomes the first slide on the dashboard
      if (!saveNews()) {
        news.shift();
        return notify("Not enough room in this browser's storage. Try a smaller image or remove older articles.");
      }
      renderNews(true);
      renderAdmin();
      resetForm(newsForm);
      resetImage();
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
    function removePublished(kind, id) {
      if (!isAdmin()) return;
      if (kind === "news") {
        news = news.filter((n) => n.id !== id);
        saveNews();
        renderNews();
      } else {
        events = events.filter((ev) => ev.id !== id);
        store.set("qp-events", events);
        if (window.qpCalendar) window.qpCalendar.reload();
      }
      renderAdmin();
      notify("Removed");
    }
    $('.view[data-view="admin"]').addEventListener("click", (e) => {
      const b = e.target.closest("[data-del]");
      if (!b || !isAdmin()) return;
      const { del: kind, id } = b.dataset;
      if (kind !== "news") return removePublished(kind, id);
      /* a news article: ask first */
      const n = news.find((x) => x.id === id);
      if (!n) return;
      confirmDelete({
        kicker: "Admin Panel",
        title: "Delete this news item?",
        item: { name: n.title, sub: `${cat(n)[0]} · ${newsDate(n.date)}`, icon: `<img src="${esc(cover(n))}" data-cover="${n.cat}" alt="" />` },
        text: "It will be removed from the dashboard slideshow and the News page. This can’t be undone.",
        onConfirm: () => removePublished("news", id),
      });
    });
    resetForm(newsForm);
    resetForm(eventForm);
    resetImage();
    renderAdmin();
  }
  renderNews();
  if (linkedArticle()) openArticle(linkedArticle(), { fromHistory: true }); // the page was opened from a shared "#news/<id>" link

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
  window.qp = { DOCS, addDocs, openDoc, showModal, closeModal, confirmDelete, closeOverlays, openPalette, esc, openArticle, articleMailto };
})();
