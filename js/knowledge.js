/* knowledge.js
 * KNOWLEDGE HUB — the "Knowledge Hub" sidebar view.
 *
 * What it does:
 *   - LIBRARY below: every document, with category, version, owner and review date.
 *   - Search (title, description, category, keywords) + category filter chips + sort.
 *   - Every document is registered in DOCS (js/features.js) with kind "Knowledge Hub",
 *     so it opens through the intranet's own openDoc(): the SHARED modal, the pin
 *     star, and the dashboard's existing "Recent" list (qp-recent in localStorage,
 *     deduped and moved to the top by touchRecent). None of that is reimplemented here.
 *   - Downloads: the document is written to a .txt file in the browser, no server needed.
 *
 * Reuse: documents with `doc: "<id>"` borrow their body from DOCS in js/features.js,
 * so a chapter is written once and shown in both places.
 * Employee handbook: there is no separate handbook page any more. "Personalhandbok 2026"
 * below is its entry point — its six topics link to the documents in this library that
 * cover them — and those documents have "employee handbook" in their keys, so searching
 * for "handbook" lists the handbook together with everything it points to.
 * Styling: existing classes only (.hero-head, .tile, .pill, .btn, .field, .news-ico)
 * plus the small .kb-* additions in css/knowledge.css. No new colours or fonts.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* =====================================================================
     LIBRARY: add a document here and it appears in the hub straight away.
       category  one of the filter chips (a new name makes a new chip)
       doc       optional id from DOCS in js/features.js — reuses that body
       body      the document itself, when it is not already in DOCS
     ===================================================================== */
  const LIBRARY = [
    {
      id: "employee-handbook",
      title: "Personalhandbok 2026",
      category: "HR",
      version: "v3.2",
      updated: "2026-09-15",
      owner: "People & Culture",
      format: "PDF",
      size: "2.4 MB",
      keys: "employee handbook personalhandbok culture ways of working onboarding remote work time off leave expenses code of conduct security",
      description: "Everything a QualiPro employee needs to know, in six topics: onboarding, remote work, time off & leave, expenses, code of conduct and security.",
      doc: "handbook",
    },
    {
      id: "vacation-policy",
      title: "Vacation Policy",
      category: "HR",
      version: "v2.1",
      updated: "2026-10-28",
      owner: "People & Culture",
      format: "PDF",
      size: "480 KB",
      keys: "vacation semester time off leave ledighet days employee handbook",
      description: "How vacation days work: how many you have, how to request time off and when the blackout periods are.",
      doc: "leave",
    },
    {
      id: "hr-guidelines",
      title: "HR Guidelines",
      category: "HR",
      version: "v2.4",
      updated: "2026-11-06",
      owner: "People & Culture",
      format: "PDF",
      size: "1.1 MB",
      keys: "parental leave sick reporting benefits wellness insurance time off employee handbook",
      description: "Guidelines for leave of absence, parental leave, sick reporting and the benefits you have as an employee.",
      body: `<p>HR Guidelines · 2026 edition</p>
        <ul>
          <li>Parental leave is topped up to 90% of salary for six months.</li>
          <li>Report sick leave to your manager before 09:00 on the first day.</li>
          <li>A doctor's note is needed from day 8 of a sick period.</li>
          <li>Wellness allowance: 5,000 SEK per year, claimed through the expense portal.</li>
          <li>Occupational health and private healthcare insurance are included from day one.</li>
        </ul>
        <h4>Who to ask</h4>
        <p>People &amp; Culture answer HR questions within one working day. QualiChat can answer the common ones straight away.</p>`,
    },
    {
      id: "collective-agreement",
      title: "Collective Agreement",
      category: "HR",
      version: "v4.0",
      updated: "2026-06-01",
      owner: "People & Culture",
      format: "PDF",
      size: "3.8 MB",
      keys: "kollektivavtal union salary pension working hours",
      description: "The collective agreement that applies to everyone employed at QualiPro, in its current version.",
      body: `<p>Collective Agreement · valid from 1 June 2026</p>
        <ul>
          <li>Standard working week: 40 hours, flexible around core hours 09:30–15:00 CET.</li>
          <li>Annual salary review takes place in March.</li>
          <li>Occupational pension (ITP) from the first month of employment.</li>
          <li>Overtime compensation follows §6 of the agreement.</li>
        </ul>
        <h4>Good to know</h4>
        <p>Local additions to the agreement are decided together with the union representatives and published here.</p>`,
    },
    {
      id: "it-security-policy",
      title: "IT Security Policy",
      category: "IT",
      version: "v1.8",
      updated: "2026-08-20",
      owner: "Platform & Security",
      format: "PDF",
      size: "920 KB",
      keys: "security yubikey mfa devices incidents data employee handbook",
      description: "Rules for devices, software installation, handling data and reporting a security incident.",
      doc: "security",
    },
    {
      id: "password-access-guide",
      title: "Password & Access Guide",
      category: "IT",
      version: "v1.3",
      updated: "2026-10-02",
      owner: "IT Support",
      format: "PDF",
      size: "640 KB",
      keys: "password manager access request login sso account security employee handbook",
      description: "How to manage passwords, use the password manager and request access to internal systems.",
      body: `<p>Password &amp; Access Guide · IT Support</p>
        <ul>
          <li>All accounts go through single sign-on. Never reuse a work password elsewhere.</li>
          <li>Store every credential in the company password manager, never in a document or chat.</li>
          <li>Access to a new system is requested from your manager, who approves it in the access portal.</li>
          <li>Access is reviewed every six months and removed when it is no longer needed.</li>
        </ul>
        <div class="modal-foot"><button class="btn" data-say="Opening the password manager (prototype)">Open password manager</button></div>`,
    },
    {
      id: "device-vpn-guide",
      title: "Device & VPN Guide",
      category: "IT",
      version: "v1.1",
      updated: "2026-09-08",
      owner: "IT Support",
      format: "PDF",
      size: "510 KB",
      keys: "vpn laptop device remote access network hardware",
      description: "Set up your laptop, connect to the VPN and get help when you are working away from the office.",
      body: `<p>Device &amp; VPN Guide · IT Support</p>
        <ul>
          <li>Every laptop is fully encrypted and locks after 5 minutes of inactivity.</li>
          <li>Connect through the company VPN whenever you use a network you do not control.</li>
          <li>Install software from the managed app catalog only.</li>
          <li>A broken or lost device is reported to IT Support the same day.</li>
        </ul>`,
    },
    {
      id: "remote-work-policy",
      title: "Remote Work Policy",
      category: "Policies",
      version: "v2.0",
      updated: "2026-09-30",
      owner: "People & Culture",
      format: "PDF",
      size: "420 KB",
      keys: "remote hybrid distansarbete home office abroad employee handbook",
      description: "Our hybrid setup: expectations, equipment and the rules for working from home or abroad.",
      doc: "remote",
    },
    {
      id: "code-of-conduct",
      title: "Code of Conduct",
      category: "Policies",
      version: "v1.6",
      updated: "2026-05-14",
      owner: "People & Culture",
      format: "PDF",
      size: "380 KB",
      keys: "uppforandekod conduct values respect whistleblowing employee handbook",
      description: "How we treat colleagues, clients and candidates — and where to raise a concern.",
      doc: "conduct",
    },
    {
      id: "data-privacy-policy",
      title: "Data & Privacy Policy",
      category: "Policies",
      version: "v1.4",
      updated: "2026-07-02",
      owner: "Platform & Security",
      format: "PDF",
      size: "760 KB",
      keys: "gdpr privacy personal data retention client confidentiality",
      description: "How we handle personal and client data: classification, retention and confidentiality.",
      body: `<p>Data &amp; Privacy Policy · §1–§4</p>
        <ul>
          <li>Client data stays inside approved systems. Never copy it to a personal device or drive.</li>
          <li>Personal data is kept only as long as there is a documented purpose for it.</li>
          <li>Classify a document before sharing it: Public, Internal, Confidential or Restricted.</li>
          <li>A suspected data breach is reported to Platform &amp; Security within 24 hours.</li>
        </ul>`,
    },
    {
      id: "onboarding-checklist",
      title: "Onboarding Checklist",
      category: "Guides",
      version: "v1.9",
      updated: "2026-10-12",
      owner: "People & Culture",
      format: "DOCX",
      size: "210 KB",
      keys: "onboarding new hire first week buddy start checklist employee handbook",
      description: "Step-by-step checklist for new employees through their first weeks at QualiPro.",
      doc: "onboarding",
    },
    {
      id: "time-reporting-guide",
      title: "Time Reporting Guide",
      category: "Guides",
      version: "v1.5",
      updated: "2026-10-20",
      owner: "Finance",
      format: "PDF",
      size: "340 KB",
      keys: "time reporting tidrapport projects absence hours",
      description: "How and when to report your time, your projects and your absence in the time system.",
      body: `<p>Time Reporting Guide · Finance</p>
        <ul>
          <li>Report your time every Friday, at the latest on the last working day of the month.</li>
          <li>Each hour is booked on a project code — ask your manager if you are unsure which one.</li>
          <li>Absence is reported in the same place as working hours.</li>
          <li>A locked month is reopened by Finance on request.</li>
        </ul>`,
    },
    {
      id: "expense-travel-guide",
      title: "Expense & Travel Guide",
      category: "Guides",
      version: "v2.2",
      updated: "2026-07-18",
      owner: "Finance",
      format: "PDF",
      size: "560 KB",
      keys: "expenses utlagg travel receipts reimbursement booking employee handbook",
      description: "How to report expenses, book business travel and get your money back.",
      doc: "expenses",
    },
  ];

  /* ---------- Small helpers ---------- */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAY = 86400000;
  const NEW_FOR_DAYS = 30; // a document updated this recently gets the "Updated" badge

  function prettyDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  const isRecent = (iso) => Date.now() - new Date(iso + "T00:00:00").getTime() < NEW_FOR_DAYS * DAY;

  /* The body of a document: its own, or the one it borrows from DOCS (js/features.js). */
  function bodyOf(item) {
    if (item.body) return item.body;
    const d = window.qp && window.qp.DOCS[item.doc];
    return d ? d.html : "<p>This document has not been published yet.</p>";
  }

  /* ---------- State (the chosen category survives a reload) ---------- */
  const STORE_KEY = "qp-kb-filter";
  let category = "All";
  try {
    category = localStorage.getItem(STORE_KEY) || "All";
  } catch (e) {}
  let query = "";
  let sort = "updated";

  const CATEGORIES = ["All", ...new Set(LIBRARY.map((d) => d.category))];
  if (!CATEGORIES.includes(category)) category = "All";

  /* ---------- Elements ---------- */
  const root = $('.view[data-view="knowledge"]');
  if (!root) return;
  const elFilters = $("#kb-filters", root);
  const elGrid = $("#kb-grid", root);
  const elCount = $("#kb-count", root);
  const elEmpty = $("#kb-empty", root);
  const elQuery = $("#kb-q", root);
  const elSort = $("#kb-sort", root);

  /* ---------- Search + filter + sort ---------- */
  function matches(item) {
    if (category !== "All" && item.category !== category) return false;
    if (!query) return true;
    const hay = `${item.title} ${item.description} ${item.category} ${item.owner} ${item.keys}`.toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((w) => hay.includes(w));
  }
  function results() {
    const list = LIBRARY.filter(matches);
    return sort === "title"
      ? list.sort((a, b) => a.title.localeCompare(b.title))
      : list.sort((a, b) => b.updated.localeCompare(a.updated));
  }

  /* ---------- Rendering ---------- */
  function renderFilters() {
    elFilters.innerHTML = CATEGORIES.map((c) => {
      const n = c === "All" ? LIBRARY.length : LIBRARY.filter((d) => d.category === c).length;
      return `<button type="button" class="kb-chip${c === category ? " active" : ""}" data-kb-cat="${esc(c)}" aria-pressed="${c === category}">
          ${esc(c)}<span class="kb-chip-n">${n}</span>
        </button>`;
    }).join("");
  }

  function card(item) {
    return `<article class="tile kb-card">
        <div class="kb-card-top">
          <span class="news-ico"><svg class="ico"><use href="#i-library" /></svg></span>
          <span class="pill muted">${esc(item.category)}</span>
          ${isRecent(item.updated) ? '<span class="pill kb-new">Updated</span>' : ""}
        </div>
        <strong>${esc(item.title)}</strong>
        <small>${esc(item.description)}</small>
        <span class="kb-meta">${esc(item.version)} · ${esc(item.format)} · ${esc(item.size)}<br />${esc(item.owner)} · reviewed ${prettyDate(item.updated)}</span>
        <span class="kb-actions">
          <button class="btn primary" type="button" data-kb-open="${esc(item.id)}">Read</button>
          <button class="btn" type="button" data-kb-download="${esc(item.id)}">Download</button>
        </span>
      </article>`;
  }

  function render() {
    const list = results();
    elGrid.innerHTML = list.map(card).join("");
    elGrid.hidden = list.length === 0;
    elEmpty.hidden = list.length > 0;
    const scope = category === "All" ? "" : ` in ${category}`;
    elCount.textContent = `${list.length} of ${LIBRARY.length} document${LIBRARY.length === 1 ? "" : "s"}${scope}${query ? ` matching “${query}”` : ""}`;
  }

  /* ---------- Opening a document ----------
     Every library document is registered in DOCS (js/features.js) below, so
     opening one goes through the intranet's own openDoc(): same modal, same pin
     star, and the same touchRecent() that feeds the dashboard's Recent list.
     Nothing about Recent is reimplemented here. */
  const KIND = "Knowledge Hub"; // shown as the modal kicker and under the title in Recent
  const ICON = `<svg class="ico"><use href="#i-library" /></svg>`;

  function docHtml(item) {
    return `
      <dl class="meta kb-doc-meta">
        <dt>Category</dt><dd>${esc(item.category)}</dd>
        <dt>Version</dt><dd>${esc(item.version)}</dd>
        <dt>Owner</dt><dd>${esc(item.owner)}</dd>
        <dt>Last reviewed</dt><dd>${prettyDate(item.updated)}</dd>
        <dt>File</dt><dd>${esc(item.format)} · ${esc(item.size)}</dd>
      </dl>
      ${bodyOf(item)}
      <div class="modal-foot">
        <button class="btn" type="button" data-kb-download="${esc(item.id)}">Download ${esc(item.format)}</button>
        <button class="btn primary" type="button" data-kb-ask="${esc(item.id)}">Ask QualiChat about this</button>
      </div>`;
  }

  /* Build every body first (a borrowed body reads DOCS), then hand them over in one go. */
  if (window.qp && window.qp.addDocs) {
    const entries = {};
    LIBRARY.forEach((item) => {
      entries[item.id] = { title: item.title, kind: KIND, icon: ICON, keys: item.keys, html: docHtml(item) };
    });
    window.qp.addDocs(entries);
  }

  function open(id) {
    if (window.qp) window.qp.openDoc(id); // opens, pins and records it under Recent
  }

  /* ---------- Download: the document is written in the browser ---------- */
  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", hellip: "\u2026", mdash: "\u2014", ndash: "\u2013" };
  function plainText(html) {
    return html
      .replace(/<div class="modal-foot"[\s\S]*?<\/div>/g, "") // buttons do not belong in a file
      .replace(/<li\b[^>]*>/g, "\n  - ")
      .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g, (m, t) => "\n\n" + t.replace(/<[^>]+>/g, "").trim().toUpperCase() + "\n")
      .replace(/<\/(p|ul|div|h4|button)>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&([a-z#0-9]+);/gi, (m, e) => (e.toLowerCase() in ENTITIES ? ENTITIES[e.toLowerCase()] : m))
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  function download(id) {
    const item = LIBRARY.find((d) => d.id === id);
    if (!item) return;
    const text = [
      item.title,
      "=".repeat(item.title.length),
      `Category: ${item.category}`,
      `Version: ${item.version}`,
      `Owner: ${item.owner}`,
      `Last reviewed: ${prettyDate(item.updated)}`,
      "",
      item.description,
      "",
      plainText(bodyOf(item)),
      "",
      "— QualiPro Knowledge Hub",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${item.id}-${item.version}.txt` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (window.notify) notify(`Downloading ${item.title} (${item.version})`);
  }

  /* ---------- Events ---------- */
  elQuery.addEventListener("input", () => {
    query = elQuery.value.trim();
    render();
  });
  elQuery.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && elQuery.value) {
      e.stopPropagation();
      elQuery.value = "";
      query = "";
      render();
    }
  });
  elSort.addEventListener("change", () => {
    sort = elSort.value;
    render();
  });
  elFilters.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-kb-cat]");
    if (!chip) return;
    category = chip.dataset.kbCat;
    try {
      localStorage.setItem(STORE_KEY, category);
    } catch (err) {}
    renderFilters();
    render();
  });
  /* Read / Download work from the grid and from inside the open modal */
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-kb-open]");
    if (openBtn) return open(openBtn.dataset.kbOpen);
    const dl = e.target.closest("[data-kb-download]");
    if (dl) return download(dl.dataset.kbDownload);
    const ask = e.target.closest("[data-kb-ask]");
    if (ask) {
      const item = LIBRARY.find((d) => d.id === ask.dataset.kbAsk);
      if (!item) return;
      window.qp.closeModal();
      if (window.qpChat) window.qpChat.ask(`What do I need to know about the ${item.title}?`);
    }
  });

  renderFilters();
  render();

  /* Other scripts (command palette, QualiChat citations) can reach the library */
  window.qpKnowledge = { LIBRARY, open, download };
})();
