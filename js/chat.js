/* chat.js
 * QualiChat drawer with SIMULATED answers (no real AI or search behind it).
 *
 * How the simulation works:
 *   KB      = example text chunks, as a vector index would store them
 *   TOPICS  = keyword lists; the topic with most keyword hits "wins"
 *   answer  = the topic's text, where [[chunk-id]] becomes a citation badge
 * Clicking a citation opens the inspector (chunk text, similarity score,
 * source and the RBAC filter). Replace reply() with a call to your real
 * assistant endpoint when it exists.
 */
(function () {
  const { showModal, esc, DOCS } = window.qp;

  /* The signed-in user's access, used as the metadata filter for retrieval */
  const RBAC = {
    user: "alex.lindqvist",
    groups: ["all-employees", "engineering"],
    filter: `{
  "access_group":   { "$in": ["all-employees", "engineering"] },
  "classification": { "$in": ["public", "internal"] },
  "office":         { "$in": ["global", "stockholm"] }
}`,
  };
  const INDEX = "qp-knowledge-v3";

  /* ---------- Example chunks ---------- */
  const KB = {
    "hb-2a": {
      label: "Personalhandbok 2026 §2",
      doc: "Personalhandbok 2026",
      section: "§2 Distansarbete",
      open: "remote",
      group: "all-employees",
      updated: "2026-01-15",
      text: "Employees may work remotely up to three days per week after agreement with their manager. Core hours are 09:30–15:00 CET, during which everyone is expected to be reachable.",
    },
    "hb-2b": {
      label: "Personalhandbok 2026 §2.4",
      doc: "Personalhandbok 2026",
      section: "§2.4 Arbete från utlandet",
      open: "remote",
      group: "all-employees",
      updated: "2026-01-15",
      text: "Remote work from abroad is limited to 20 working days per calendar year within the EU/EEA and must be approved in advance. The company VPN and a managed device are required at all times.",
    },
    "sec-41": {
      label: "IT Security Policy §4.1",
      doc: "IT Security Policy",
      section: "§4.1 Hardware security keys",
      open: "security",
      group: "all-employees",
      updated: "2026-05-20",
      text: "From June 15, multi-factor authentication with a hardware security key (YubiKey) is mandatory for all accounts. Each employee registers two keys: one primary and one backup stored separately.",
    },
    "sec-43": {
      label: "IT Security Policy §4.3",
      doc: "IT Security Policy",
      section: "§4.3 Lost or stolen keys",
      open: "security",
      group: "all-employees",
      updated: "2026-05-20",
      text: "A lost or stolen security key must be reported to IT support within 24 hours. The key is revoked immediately and a replacement is issued from the service desk.",
    },
    "run-3": {
      label: "CI/CD Runbook §3",
      doc: "CI/CD Runbook",
      section: "§3 Production deployments",
      open: "cicd",
      group: "engineering",
      updated: "2026-04-02",
      text: "Production deployments run from the main branch after a green pipeline and one approving review. Deploy windows are weekdays 09:00–16:00; deployments outside the window need on-call approval.",
    },
    "run-5": {
      label: "CI/CD Runbook §5",
      doc: "CI/CD Runbook",
      section: "§5 Rollback",
      open: "cicd",
      group: "engineering",
      updated: "2026-04-02",
      text: "To roll back, re-run the last successful deploy job from the pipeline view. Database migrations are forward-only, so a rollback must be paired with a compensating migration when the schema changed.",
    },
    "rel-42": {
      label: "Core v4.2 release notes",
      doc: "QualiPro Core v4.2 release notes",
      section: "Highlights",
      open: "devportal",
      group: "engineering",
      updated: "2026-06-05",
      text: "Core v4.2 introduces event-driven notifications, a 35% faster search API and the new role-based access layer. The legacy /v1/auth endpoints are deprecated and will be removed in v4.4.",
    },
    "dev-1": {
      label: "Developer onboarding guide §1",
      doc: "Developer onboarding guide",
      section: "§1 Your first day",
      open: "devportal",
      group: "engineering",
      updated: "2026-03-11",
      text: "Clone the platform monorepo, run the bootstrap script and request access to the staging environment in the Dev Portal. Most developers have a working local environment within two hours.",
    },
    "hb-1": {
      label: "Personalhandbok 2026 §1",
      doc: "Personalhandbok 2026",
      section: "§1 Onboarding",
      open: "onboarding",
      group: "all-employees",
      updated: "2026-01-15",
      text: "New employees receive a laptop, accounts and a security key on day one. During the first week you meet your onboarding buddy and your manager, and in week two you join a guild.",
    },
    "hb-5": {
      label: "Personalhandbok 2026 §5",
      doc: "Personalhandbok 2026",
      section: "§5 Ledighet",
      open: "leave",
      group: "all-employees",
      updated: "2026-01-15",
      text: "All employees have 30 vacation days per year. Summer vacation requests are submitted before April 30. Sick leave is reported to your manager before 09:00, and a doctor's note is required from day 8.",
    },
    "hb-7": {
      label: "Personalhandbok 2026 §7",
      doc: "Personalhandbok 2026",
      section: "§7 Utlägg",
      open: "expenses",
      group: "all-employees",
      updated: "2026-01-15",
      text: "Receipts are submitted within 30 days. Purchases above 2,000 SEK require approval in advance. Home-office equipment is reimbursed up to 5,000 SEK every three years.",
    },
    "news-mfa": {
      label: "News: MFA rollout",
      doc: "News & information",
      section: "Multi-factor authentication rollout · Jun 8",
      open: "security",
      group: "all-employees",
      updated: "2026-06-08",
      text: "Register your security key before June 15 to keep access to company systems. Keys are handed out at the service desk on weekdays 08–17.",
    },
  };

  /* ---------- Topics: keywords -> answer with [[chunk]] citations ---------- */
  const TOPICS = [
    {
      keys: ["remote", "hybrid", "from home", "wfh", "distans", "abroad", "home office"],
      answer:
        "You can work remotely <strong>up to three days a week</strong>, agreed with your manager, and core hours are 09:30–15:00 CET [[hb-2a]]. Working from abroad is limited to 20 days a year inside the EU/EEA and needs approval first [[hb-2b]].",
    },
    {
      keys: ["security key", "yubikey", "mfa", "multi-factor", "2fa", "authentication", "lost key", "security"],
      answer:
        "A hardware security key becomes <strong>mandatory on June 15</strong>, and you register two: a primary and a backup [[sec-41]]. Keys are handed out at the service desk [[news-mfa]]. If you lose one, report it to IT within 24 hours [[sec-43]].",
    },
    {
      keys: ["deploy", "ci/cd", "cicd", "pipeline", "rollback", "roll back", "production", "release"],
      answer:
        "Production deployments run from <strong>main</strong> after a green pipeline and one approving review, on weekdays 09:00–16:00 [[run-3]]. To roll back, re-run the last successful deploy job [[run-5]]. The latest release is Core v4.2 [[rel-42]].",
    },
    {
      keys: ["onboarding", "new hire", "developer guide", "dev environment", "getting started", "first day", "first week"],
      answer:
        "Start by cloning the monorepo, running the bootstrap script and requesting staging access in the Dev Portal [[dev-1]]. On the people side you get your laptop, accounts and security key on day one, and meet your buddy in week one [[hb-1]].",
    },
    {
      keys: ["vacation", "leave", "time off", "semester", "sick", "holiday", "ledighet"],
      answer:
        "You have <strong>30 vacation days</strong> a year, and summer requests are due before April 30. Report sick leave to your manager before 09:00 [[hb-5]].",
    },
    {
      keys: ["expense", "receipt", "reimburse", "equipment", "utlägg", "travel"],
      answer:
        "Submit receipts within 30 days. Anything over 2,000 SEK needs approval first, and home-office equipment is covered up to 5,000 SEK every three years [[hb-7]].",
    },
    {
      keys: ["update", "news", "latest", "changed", "announcement", "recent", "what's new"],
      answer:
        "Two things stand out. Security keys become mandatory on June 15, so register yours now [[news-mfa]]. And Core v4.2 is out, with faster search and the new access layer [[rel-42]].",
    },
  ];

  /* ---------- "Retrieval": pick a topic and score its chunks ---------- */
  function retrieve(question) {
    const q = question.toLowerCase();
    let best = null,
      hits = [];
    TOPICS.forEach((t) => {
      const h = t.keys.filter((k) => q.includes(k));
      if (h.length > hits.length) {
        best = t;
        hits = h;
      }
    });
    if (!best) return null;
    const ids = [...best.answer.matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1]);
    const top = Math.min(0.94, 0.79 + 0.05 * hits.length);
    return {
      topic: best,
      hits,
      chunks: ids.map((id, n) => ({ id, ...KB[id], score: +(top - n * 0.047).toFixed(2), rank: n + 1 })),
    };
  }

  /* ---------- Drawer ---------- */
  const drawer = $("#ai-drawer"),
    thread = $("#thread"),
    dInput = $("#drawer-input");
  const retrievals = new Map(); // message id -> its retrieved chunks
  let msgId = 0,
    drawerFocus = null;
  function open() {
    if (drawer.classList.contains("open")) return;
    drawerFocus = document.activeElement;
    drawer.classList.add("open");
    drawer.inert = false;
    drawer.setAttribute("aria-hidden", "false");
    setTimeout(() => dInput.focus({ preventScroll: true }), 60);
  }
  function close() {
    if (!drawer.classList.contains("open")) return;
    drawer.classList.remove("open");
    drawer.inert = true;
    drawer.setAttribute("aria-hidden", "true");
    if (drawerFocus && drawerFocus.focus) drawerFocus.focus({ preventScroll: true });
  }
  function add(html, cls) {
    const empty = thread.querySelector(".thread-empty");
    if (empty) empty.remove();
    const el = document.createElement("div");
    el.className = "msg " + cls;
    el.innerHTML = html;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }
  function reply(question) {
    const r = retrieve(question);
    if (!r)
      return `<p>I couldn't find anything in the knowledge base that matches closely enough. Try asking about remote work, security keys, deployments, time off or expenses.</p><small class="msg-meta">0 chunks above the 0.60 similarity threshold</small>`;
    const id = ++msgId;
    retrievals.set(id, r);
    let n = 0;
    const text = r.topic.answer.replace(
      /\s*\[\[(.+?)\]\]/g,
      () => ` <button type="button" class="cite-n" data-cite="${id}:${n}" aria-label="Source ${n + 1}">${++n}</button>`,
    );
    const badges = r.chunks
      .map(
        (c, i) =>
          `<button type="button" class="cite" data-cite="${id}:${i}"><b>${i + 1}</b>[${esc(c.label)}]</button>`,
      )
      .join("");
    return `<p>${text}</p><div class="cites">${badges}</div><small class="msg-meta">${r.chunks.length} chunks retrieved · filtered by your access (${RBAC.groups.join(", ")})</small>`;
  }
  function ask(question) {
    question = String(question || "").trim();
    if (!question) return;
    window.qp.closeModal();
    open();
    add(`<div class="bubble"></div>`, "user").firstChild.textContent = question;
    const wait = add(
      `<div class="bot-dot">✳</div><div class="bubble"><span class="typing" aria-label="QualiChat is typing"><i></i><i></i><i></i></span></div>`,
      "bot",
    );
    document.dispatchEvent(new CustomEvent("qp:chat", { detail: "waiting" })); // the robot starts thinking
    setTimeout(
      () => {
        wait.querySelector(".bubble").innerHTML = reply(question);
        thread.scrollTop = thread.scrollHeight;
        document.dispatchEvent(new CustomEvent("qp:chat", { detail: "answered" }));
      },
      reduce() ? 150 : 1500,
    );
  }
  function reset() {
    retrievals.clear();
    thread.innerHTML = `<div class="thread-empty">Ask about policies, projects or developer guides. Answers show their sources.</div>`;
  }

  /* ---------- Citation inspector ---------- */
  function inspect(id, i) {
    const r = retrievals.get(id),
      c = r && r.chunks[i];
    if (!c) return;
    let text = esc(c.text);
    r.hits.forEach((k) => {
      text = text.replace(new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + "\\w*)", "gi"), "<mark>$1</mark>");
    });
    showModal({
      kicker: `Retrieved chunk · ${c.rank} of ${r.chunks.length}`,
      title: c.label,
      html: `<div class="insp-score"><span>Similarity score (cosine)</span><b>${c.score.toFixed(2)}</b><div class="bar"><i style="width:${c.score * 100}%"></i></div></div>
        <blockquote class="chunk">${text}</blockquote>
        <dl class="meta">
          <dt>Source</dt><dd>${esc(c.doc)}</dd>
          <dt>Section</dt><dd>${esc(c.section)}</dd>
          <dt>Chunk ID</dt><dd>${esc(c.id)}</dd>
          <dt>Updated</dt><dd>${c.updated}</dd>
          <dt>Index</dt><dd>${INDEX}</dd>
          <dt>Access group</dt><dd>${esc(c.group)} <span class="pill ok">Allowed</span></dd>
        </dl>
        <h4>Active RBAC metadata filter</h4>
        <pre class="code">${esc(RBAC.filter)}</pre>
        <p>Applied for ${RBAC.user} before the similarity search, so only chunks you may read are retrieved.</p>
        <div class="modal-foot">${DOCS[c.open] ? `<button type="button" class="btn primary" data-doc="${c.open}">Open source document</button>` : ""}</div>`,
    });
  }

  /* ---------- Events ---------- */
  thread.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cite]");
    if (!b) return;
    const [id, i] = b.dataset.cite.split(":").map(Number);
    inspect(id, i);
  });
  $("#drawer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = dInput.value;
    dInput.value = "";
    ask(text);
  });
  dInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#drawer-form").requestSubmit();
    }
  });
  $("#drawer-close").addEventListener("click", close);
  $("#drawer-new").addEventListener("click", () => {
    reset();
    dInput.focus();
  });
  $("#open-thread").addEventListener("click", open);
  drawer.inert = true;
  reset();

  window.qpChat = { ask, open, close, reset };
})();
