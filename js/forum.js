/* forum.js
 * BULLETIN BOARD: the "Bulletin Board" sidebar view (#forum).
 *
 * What it does:
 *   - Feed of posts: pinned first, then by latest activity. Category pills, search, + New post.
 *   - New post: opens in the shared window (js/features.js showModal). Title, category,
 *     optional link (shown as a resource card), message.
 *   - Thread: clicking a post (or Comments) opens it at "#forum/<id>", so it can be linked
 *     and Back / Forward work. Comments are listed oldest first, with a box to add one.
 *   - Like a post (one like per person), delete your own posts / comments. An admin (HR / Manager)
 *     who has unlocked Admin Mode (padlock in the top bar, js/app.js) can also pin / unpin and
 *     remove anyone's: moderation. Locked, admins see the board like everyone else.
 *     Deleting asks first, in the shared "Delete?" window (window.qp.confirmDelete).
 *
 * Everything is saved in the browser ("qp-forum"). Four sample discussions are added the
 * first time, so the board isn't empty. There is no server: other people's posts are only
 * these samples; a real intranet would load and save posts through an API, and check on the
 * server who may delete what.
 * Language: sample posts and the interface are translated through js/lang-sv.js; what people
 * type themselves is never translated (data-no-tr).
 * Styling: css/forum.css, plus the Knowledge Hub's toolbar and filter pills (.kb-*).
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('.view[data-view="forum"]');
  if (!view || !window.qp) return;
  const { showModal, closeModal, confirmDelete, esc } = window.qp;

  /* The signed-in person (the prototype has one user: the profile in the top bar) */
  const ME = { id: "me", name: "Alex Lindqvist", title: "Software Engineer", initials: "AL" };

  const CATS = {
    tech: "Tech & AI",
    tips: "Tips & Workflows",
    links: "Useful Links",
    general: "General",
  };
  const KEY = "qp-forum";
  const MIN = 6e4,
    HOUR = 36e5,
    DAY = 864e5;

  /* ---------- Sample discussions (added the first time the board is opened) ---------- */
  function samples() {
    const now = Date.now();
    const p = (name, title, initials) => ({ id: "u-" + name.toLowerCase().replace(/\W+/g, "-"), name, title, initials }); // never "me" (the signed-in user)
    const maria = p("Maria Ek", "People & Culture", "ME"),
      jonas = p("Jonas Berg", "Platform team", "JB"),
      sara = p("Sara Holm", "IT Security", "SH"),
      ali = p("Ali Haddad", "UX Designer", "AH"),
      lina = p("Lina Sjöberg", "Project Manager", "LS");
    return [
      {
        id: "welcome",
        pinned: true,
        cat: "general",
        title: "Welcome to the Bulletin Board: read this first",
        body: "This is the place to share useful links, tips and questions with the whole company. Pick a category so people can find your post, and add a link when you share a resource.\n\nKeep it friendly and work related. Anything confidential (client details, passwords, salaries) stays out of the board.",
        author: maria,
        t: now - 6 * DAY,
        likes: 24,
        comments: [{ id: "c1", author: jonas, text: "Great idea. Much better than links getting lost in Teams chats.", t: now - 6 * DAY + 3 * HOUR }],
      },
      {
        id: "rag-citations",
        cat: "tech",
        title: "How we make QualiChat answers cite their sources",
        body: "A short write-up of the retrieval setup behind QualiChat. Documents are split into small chunks, and each chunk gets a bit of context about its document before it is indexed. That alone made the answers point to the right policy far more often.\n\nThe article below explains the technique well. Happy to walk anyone through our version.",
        url: "https://www.anthropic.com/news/contextual-retrieval",
        author: jonas,
        t: now - 2 * DAY - 3 * HOUR,
        likes: 15,
        comments: [
          { id: "c2", author: ali, text: "Could we show the matching paragraph when you hover a source?", t: now - 2 * DAY },
          { id: "c3", author: jonas, text: "Yes, that is on the list. The citation window already shows the chunk.", t: now - 1 * DAY - 20 * HOUR },
        ],
      },
      {
        id: "git-sync",
        cat: "tips",
        title: "Tip: sync with main without losing your work",
        body: "Commit your own changes first, then pull with a merge instead of a rebase: git pull --no-rebase origin main. If there is a conflict, keep both sides where you can, test, and commit the merge.\n\nIt has saved our team a lot of lost work since several of us edit the same files.",
        author: lina,
        t: now - 20 * HOUR,
        likes: 9,
        comments: [{ id: "c4", author: sara, text: "And never force push to main, please.", t: now - 18 * HOUR }],
      },
      {
        id: "a11y-checklist",
        cat: "links",
        title: "The accessibility checklist we use for client projects",
        body: "A practical, free checklist for accessible websites: contrast, keyboard use, forms, images and more. We go through it before every client handover.",
        url: "https://www.a11yproject.com/checklist/",
        author: ali,
        t: now - 3 * HOUR,
        likes: 6,
        comments: [],
      },
    ];
  }

  /* ---------- Saved posts ---------- */
  let posts = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(v)) return v.filter((x) => x && x.id && x.title);
    } catch (e) {}
    return null;
  })();
  if (!posts) {
    posts = samples();
    save();
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(posts));
      return true;
    } catch (e) {
      notify("Couldn't save: the browser's storage is full.");
      return false;
    }
  }
  const find = (id) => posts.find((x) => x.id === id);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const canDelete = (author) => author.id === ME.id || isAdminMode();
  const lastActivity = (p) => Math.max(p.t, ...p.comments.map((c) => c.t));

  /* ---------- Small helpers ---------- */
  function ago(t) {
    const d = Date.now() - t;
    if (d < MIN) return "just now";
    if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
    if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
    if (d < 7 * DAY) return `${Math.floor(d / DAY)} d ago`;
    const lang = document.documentElement.lang === "sv" ? "sv-SE" : "en-GB";
    return new Date(t).toLocaleDateString(lang, { day: "numeric", month: "short" });
  }
  /* sample text is translated through js/lang-sv.js; what people type is shown exactly as written */
  const noTr = (x) => (x.user ? " data-no-tr" : "");
  const paras = (text, x) =>
    String(text)
      .split(/\n{2,}/)
      .map((t) => `<p${noTr(x)}>${esc(t.trim()).replace(/\n/g, "<br />")}</p>`)
      .join("");
  const avatar = (a) => `<span class="fm-avatar${a.id === ME.id ? " is-me" : ""}" aria-hidden="true">${esc(a.initials)}</span>`;
  const byline = (a, t) =>
    `<div class="fm-by">${avatar(a)}<span><span class="fm-name"><strong data-no-tr>${esc(a.name)}</strong>${a.id === ME.id ? `<span class="fm-you">You</span>` : ""}</span><small><span>${esc(
      a.title,
    )}</span> · <time datetime="${new Date(t).toISOString()}">${ago(t)}</time></small></span></div>`;
  const commentsLabel = (n) => `${n} ${n === 1 ? "comment" : "comments"}`;
  function linkCard(url) {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return "";
    }
    const path = (u.pathname + u.search).replace(/\/$/, "");
    return `<a class="fm-link" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">
        <span class="fm-link-ico"><svg class="ico"><use href="#i-link" /></svg></span>
        <span class="fm-link-txt"><strong data-no-tr>${esc(u.hostname.replace(/^www\./, ""))}</strong><small data-no-tr>${esc(path || "/")}</small></span>
        <svg class="ico fm-link-ext"><use href="#i-ext" /></svg>
      </a>`;
  }
  const likeBtn = (p) =>
    `<button type="button" class="fm-act fm-like${p.liked ? " on" : ""}" data-fm-like="${esc(p.id)}" aria-pressed="${!!p.liked}" aria-label="Like (${p.likes})">
        <svg class="ico"><use href="#i-heart" /></svg><span>${p.likes}</span></button>`;
  const delBtn = (what, id, label) =>
    `<button type="button" class="fm-act fm-del" ${what}="${esc(id)}" aria-label="${label}" title="${label}"><svg class="ico"><use href="#i-trash" /></svg></button>`;

  /* ---------- Feed ---------- */
  const feed = $("#fm-feed"),
    chips = $("#fm-filters"),
    q = $("#fm-q"),
    count = $("#fm-count"),
    thread = $("#fm-thread"),
    board = $("#fm-board");
  let cat = "all";

  function renderChips() {
    const n = (c) => (c === "all" ? posts.length : posts.filter((p) => p.cat === c).length);
    chips.innerHTML = ["all", ...Object.keys(CATS)]
      .map(
        (c) =>
          `<button type="button" class="kb-chip${c === cat ? " active" : ""}" data-fm-cat="${c}" aria-pressed="${c === cat}">${c === "all" ? "All" : CATS[c]}<span class="kb-chip-n">${n(c)}</span></button>`,
      )
      .join("");
  }
  function renderFeed() {
    renderChips();
    const term = q.value.trim().toLowerCase();
    const list = posts
      .filter((p) => cat === "all" || p.cat === cat)
      .filter(
        (p) =>
          !term ||
          [p.title, p.body, p.url, p.author.name, CATS[p.cat], ...p.comments.map((c) => c.text)]
            .concat([p.title, p.body].map((x) => tr(x)))
            .join(" ")
            .toLowerCase()
            .includes(term),
      )
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || lastActivity(b) - lastActivity(a));
    count.textContent = list.length === 1 ? "1 post" : `${list.length} posts`;
    feed.innerHTML = list.length
      ? list
          .map(
            (p) => `<article class="fm-card${p.pinned ? " is-pinned" : ""}" data-fm-card="${esc(p.id)}">
          <div class="fm-card-top">
            ${byline(p.author, p.t)}
            <div class="fm-tags">${p.pinned ? `<span class="fm-pin"><svg class="ico"><use href="#i-pin" /></svg>Pinned</span>` : ""}<span class="fm-cat" data-cat="${p.cat}">${CATS[p.cat]}</span></div>
          </div>
          <h3><button type="button" class="fm-title" data-fm-open="${esc(p.id)}"${noTr(p)}>${esc(p.title)}</button></h3>
          <div class="fm-excerpt">${paras(p.body, p)}</div>
          ${p.url ? linkCard(p.url) : ""}
          <div class="fm-actions">
            ${likeBtn(p)}
            <button type="button" class="fm-act" data-fm-open="${esc(p.id)}" data-fm-focus="comment"><svg class="ico"><use href="#i-chat" /></svg><span>${commentsLabel(p.comments.length)}</span></button>
            ${isAdminMode() ? `<button type="button" class="fm-act fm-pin-btn${p.pinned ? " on" : ""}" data-fm-pin="${esc(p.id)}" aria-pressed="${!!p.pinned}"><svg class="ico"><use href="#i-pin" /></svg><span>${p.pinned ? "Unpin" : "Pin"}</span></button>` : ""}
            ${canDelete(p.author) ? delBtn("data-fm-del-post", p.id, "Delete post") : ""}
          </div>
        </article>`,
          )
          .join("")
      : `<div class="fm-empty"><strong>No posts found.</strong><span>Try another category or search, or start the discussion yourself.</span></div>`;
  }

  /* ---------- Thread (one post with its comments) ---------- */
  let openId = null;
  function renderThread() {
    const p = find(openId);
    if (!p) return closeThread();
    thread.innerHTML = `<button type="button" class="btn fm-back" data-fm-back><svg class="ico"><use href="#i-chev" /></svg>All posts</button>
      <article class="fm-post">
        <div class="fm-card-top">
          ${byline(p.author, p.t)}
          <div class="fm-tags">${p.pinned ? `<span class="fm-pin"><svg class="ico"><use href="#i-pin" /></svg>Pinned</span>` : ""}<span class="fm-cat" data-cat="${p.cat}">${CATS[p.cat]}</span></div>
        </div>
        <h2 id="fm-thread-title" tabindex="-1"${noTr(p)}>${esc(p.title)}</h2>
        <div class="fm-body">${paras(p.body, p)}</div>
        ${p.url ? linkCard(p.url) : ""}
        <div class="fm-actions">
          ${likeBtn(p)}
          <span class="fm-act is-static"><svg class="ico"><use href="#i-chat" /></svg><span>${commentsLabel(p.comments.length)}</span></span>
          ${isAdminMode() ? `<button type="button" class="fm-act fm-pin-btn${p.pinned ? " on" : ""}" data-fm-pin="${esc(p.id)}" aria-pressed="${!!p.pinned}"><svg class="ico"><use href="#i-pin" /></svg><span>${p.pinned ? "Unpin" : "Pin"}</span></button>` : ""}
          ${canDelete(p.author) ? delBtn("data-fm-del-post", p.id, "Delete post") : ""}
        </div>
      </article>
      <section class="fm-comments" aria-labelledby="fm-comments-title">
        <h3 class="fm-sub" id="fm-comments-title">Comments</h3>
        ${
          p.comments.length
            ? `<ol class="fm-comment-list">${p.comments
                .slice()
                .sort((a, b) => a.t - b.t)
                .map(
                  (c) => `<li class="fm-comment" data-fm-comment="${esc(c.id)}">
                ${byline(c.author, c.t)}
                <div class="fm-comment-text">${paras(c.text, c)}</div>
                ${canDelete(c.author) ? delBtn("data-fm-del-comment", c.id, "Delete comment") : ""}
              </li>`,
                )
                .join("")}</ol>`
            : `<p class="fm-none">No comments yet. Be the first to reply.</p>`
        }
        <form class="fm-reply" id="fm-reply" autocomplete="off">
          ${avatar(ME)}
          <label class="sr-only" for="fm-reply-text">Write a comment</label>
          <textarea class="field" id="fm-reply-text" rows="2" maxlength="1000" placeholder="Write a comment…" required></textarea>
          <button type="submit" class="btn primary">Comment</button>
        </form>
      </section>`;
  }
  function openThread(id, { fromHistory = false, focus = "title" } = {}) {
    if (!find(id)) return;
    if (view.hidden) showView("forum", { push: !fromHistory });
    const hash = "#forum/" + encodeURIComponent(id);
    if (!fromHistory && location.hash !== hash) history.pushState(null, "", hash);
    openId = id;
    renderThread();
    board.hidden = true;
    thread.hidden = false;
    scrollTo({ top: 0 });
    (focus === "comment" ? $("#fm-reply-text") : $("#fm-thread-title")).focus({ preventScroll: focus !== "comment" });
  }
  function closeThread({ fromHistory = false } = {}) {
    if (thread.hidden) return;
    const was = openId;
    if (!fromHistory && !view.hidden && location.hash.startsWith("#forum/")) history.replaceState(null, "", "#forum");
    openId = null;
    thread.hidden = true;
    board.hidden = false;
    renderFeed();
    if (!view.hidden) {
      const back = feed.querySelector(`[data-fm-open="${CSS.escape(was || "")}"]`);
      if (back) back.focus({ preventScroll: true });
    }
  }
  const linked = () => {
    const m = location.hash.match(/^#forum\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  addEventListener("popstate", () => {
    if (linked()) openThread(linked(), { fromHistory: true });
    else if (location.hash === "#forum") closeThread({ fromHistory: true });
  });
  /* leaving the view puts the thread away (the address already belongs to the new view) */
  new MutationObserver(() => view.hidden && closeThread({ fromHistory: true })).observe(view, { attributeFilter: ["hidden"] });

  /* ---------- New post (in the shared window) ---------- */
  function openComposer() {
    showModal({
      kicker: "Bulletin Board",
      title: "New post",
      html: `<form class="admin-form fm-compose" id="fm-compose" autocomplete="off" novalidate>
          <label class="admin-field"><span>Title</span><input class="field" name="title" type="text" maxlength="120" placeholder="What do you want to share?" required /></label>
          <label class="admin-field"><span>Category</span><select class="field" name="cat">${Object.entries(CATS)
            .map(([k, v]) => `<option value="${k}"${k === (cat === "all" ? "general" : cat) ? " selected" : ""}>${v}</option>`)
            .join("")}</select></label>
          <label class="admin-field"><span>Link <i>(optional)</i></span><input class="field" name="url" type="url" inputmode="url" placeholder="https://…" /></label>
          <label class="admin-field"><span>Message</span><textarea class="field" name="body" rows="6" maxlength="4000" placeholder="Add details, a tip or a question…" required></textarea></label>
          <p class="fm-error" id="fm-error" role="alert" hidden></p>
          <div class="modal-foot">
            <button type="button" class="btn" data-fm-cancel>Cancel</button>
            <button type="submit" class="btn primary">Publish post</button>
          </div>
        </form>`,
    });
    $("#fm-compose [name=title]").focus();
  }
  /* "example.com/page" becomes "https://example.com/page"; only http(s) links are accepted */
  function cleanUrl(v) {
    v = v.trim();
    if (!v) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
    try {
      const u = new URL(v);
      return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.href : null;
    } catch (e) {
      return null;
    }
  }
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "fm-compose") return;
    e.preventDefault();
    const f = e.target,
      err = $("#fm-error"),
      title = f.title.value.trim(),
      body = f.body.value.trim(),
      url = cleanUrl(f.url.value);
    const problem = !title ? ["title", "Add a title."] : !body ? ["body", "Write a message."] : url === null ? ["url", "The link doesn't look right. Use a web address like https://example.com."] : null;
    if (problem) {
      err.textContent = problem[1];
      err.hidden = false;
      f[problem[0]].focus();
      return;
    }
    const p = { id: newId(), user: true, cat: f.cat.value, title, body, author: ME, t: Date.now(), likes: 0, comments: [] };
    if (url) p.url = url;
    posts.unshift(p);
    if (!save()) return posts.shift();
    closeModal();
    cat = "all";
    q.value = "";
    renderFeed();
    notify("Post published");
    feed.querySelector(`[data-fm-open="${CSS.escape(p.id)}"]`)?.focus();
  });

  /* ---------- Comments ---------- */
  view.addEventListener("submit", (e) => {
    if (e.target.id !== "fm-reply") return;
    e.preventDefault();
    const p = find(openId),
      box = $("#fm-reply-text"),
      text = box.value.trim();
    if (!p || !text) return box.focus();
    p.comments.push({ id: newId(), user: true, author: ME, text, t: Date.now() });
    if (!save()) return p.comments.pop();
    renderThread();
    notify("Comment added");
    $("#fm-reply-text").focus({ preventScroll: true });
    view.querySelector(".fm-comment:last-child")?.scrollIntoView({ block: "nearest" });
  });
  /* Cmd/Ctrl + Enter sends the comment */
  view.addEventListener("keydown", (e) => {
    if (e.target.id === "fm-reply-text" && e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("#fm-reply").requestSubmit();
  });

  /* ---------- Clicks: open, like, delete, filters ---------- */
  function deletePost(id) {
    const p = find(id);
    if (!p) return;
    confirmDelete({
      kicker: "Bulletin Board",
      title: "Delete this post?",
      item: { name: tr(p.title), sub: `${p.author.name} · ${commentsLabel(p.comments.length)}` },
      text: p.author.id === ME.id ? "The post and all its comments will be deleted. This can’t be undone." : "You are removing another person's post as a moderator. The post and all its comments will be deleted. This can’t be undone.",
      onConfirm: () => {
        posts = posts.filter((x) => x.id !== id);
        save();
        if (openId === id) closeThread();
        renderFeed();
        notify("Post deleted");
      },
    });
  }
  function deleteComment(cid) {
    const p = find(openId),
      c = p && p.comments.find((x) => x.id === cid);
    if (!c) return;
    confirmDelete({
      kicker: "Bulletin Board",
      title: "Delete this comment?",
      item: { name: c.text.length > 90 ? c.text.slice(0, 90) + "…" : c.text, sub: c.author.name },
      text: "The comment will be deleted. This can’t be undone.",
      onConfirm: () => {
        p.comments = p.comments.filter((x) => x.id !== cid);
        save();
        renderThread();
        notify("Comment deleted");
        $("#fm-reply-text").focus({ preventScroll: true });
      },
    });
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-fm-cancel]")) closeModal();
  });
  view.addEventListener("click", (e) => {
    const t = e.target;
    let b;
    if (t.closest("#fm-new")) return openComposer();
    if ((b = t.closest("[data-fm-cat]"))) {
      cat = b.dataset.fmCat;
      renderFeed();
      return chips.querySelector(`[data-fm-cat="${cat}"]`).focus();
    }
    if ((b = t.closest("[data-fm-like]"))) {
      const p = find(b.dataset.fmLike);
      p.liked = !p.liked;
      p.likes += p.liked ? 1 : -1;
      save();
      b.outerHTML = likeBtn(p);
      return view.querySelector(`[data-fm-like="${CSS.escape(p.id)}"]`).focus();
    }
    if ((b = t.closest("[data-fm-pin]")) && isAdminMode()) {
      const p = find(b.dataset.fmPin);
      p.pinned = !p.pinned;
      save();
      if (openId && !thread.hidden) renderThread();
      else renderFeed();
      notify(p.pinned ? "Post pinned to the top" : "Post unpinned");
      return view.querySelector(`[data-fm-pin="${CSS.escape(p.id)}"]`)?.focus();
    }
    if ((b = t.closest("[data-fm-del-post]"))) return deletePost(b.dataset.fmDelPost);
    if ((b = t.closest("[data-fm-del-comment]"))) return deleteComment(b.dataset.fmDelComment);
    if (t.closest("[data-fm-back]")) return closeThread();
    if ((b = t.closest("[data-fm-open]"))) return openThread(b.dataset.fmOpen, { focus: b.dataset.fmFocus });
    /* a click anywhere else on a card (not on its link or buttons) opens it too */
    const card = t.closest("[data-fm-card]");
    if (card && !t.closest("a, button") && !getSelection().toString()) openThread(card.dataset.fmCard);
  });
  q.addEventListener("input", renderFeed);

  /* locking / unlocking Admin Mode (or changing role) shows or hides pin / delete on everyone's posts */
  const syncMod = () => ($("#fm-mod").hidden = !isAdminMode());
  document.addEventListener("qp:adminmode", () => {
    syncMod();
    renderFeed();
    if (openId && !thread.hidden) renderThread();
  });

  renderFeed();
  syncMod();
  if (linked()) openThread(linked(), { fromHistory: true }); // the page was opened from a "#forum/<id>" link
  window.qpForum = { openThread, openComposer };
})();
