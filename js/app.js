/* app.js
 * General page behaviour: helpers, toasts, chat box, card tilt,
 * light/dark mode switch, and the notification + profile dropdowns.
 */
const $ = (s) => document.querySelector(s),
  $$ = (s) => document.querySelectorAll(s);
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Toasts & prototype actions ---------- */
const toast = $("#toast");
let toastTimer;
function notify(m) {
  toast.textContent = m;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
$$("[data-toast]").forEach((el) =>
  el.addEventListener("click", () => {
    notify(el.dataset.toast);
    closeMenus();
  }),
);
$$("[data-prompt]").forEach((el) =>
  el.addEventListener("click", () => {
    $("#chat-input").value = el.dataset.prompt;
    $("#chat-input").focus();
  }),
);
$("#chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#chat-form").requestSubmit();
  }
});
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-input"),
    text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  input.value = "";
  qpChat.ask(text); // adds it to the thread and opens the AI drawer (js/chat.js)
});

const stage = document.querySelector(".tilt");
stage.addEventListener("pointermove", (e) => {
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.body.classList.contains("is-holding")
  )
    return;
  const r = stage.getBoundingClientRect(),
    x = (e.clientX - r.left) / r.width - 0.5,
    y = (e.clientY - r.top) / r.height - 0.5;
  stage.style.transform = `rotateX(${(-y * 1.8).toFixed(2)}deg) rotateY(${(x * 2.1).toFixed(2)}deg)`;
});
stage.addEventListener("pointerleave", () => (stage.style.transform = ""));

/* ---------- Language (English / Svenska) ----------
 * The page is written in English. In Swedish, every text on the page (and the title, aria-label
 * and placeholder attributes) is looked up in window.QP_SV (js/lang-sv.js, English text -> Swedish),
 * including text the scripts add later (pop-ups, chat answers, calendar…): a MutationObserver
 * translates it as it appears. Switching back restores the English originals.
 * Texts with changing parts (dates, "5 min ago", "Step 2 of 12"…) are handled by LANG_PATTERNS below.
 * Mark anything that must stay as it is with data-no-tr. The choice is saved as "qp-lang". */
const SV = window.QP_SV || {};
const SV_MONTHS = {
  January: "januari", February: "februari", March: "mars", April: "april", May: "maj", June: "juni",
  July: "juli", August: "augusti", September: "september", October: "oktober", November: "november", December: "december",
  Jan: "jan", Feb: "feb", Mar: "mar", Apr: "apr", Jun: "jun", Jul: "jul", Aug: "aug", Sep: "sep", Oct: "okt", Nov: "nov", Dec: "dec",
};
const SV_DAYS = {
  Monday: "måndag", Tuesday: "tisdag", Wednesday: "onsdag", Thursday: "torsdag", Friday: "fredag", Saturday: "lördag", Sunday: "söndag",
  Mon: "mån", Tue: "tis", Wed: "ons", Thu: "tors", Fri: "fre", Sat: "lör", Sun: "sön",
};
const DATE_WORD = new RegExp(`\\b(${[...Object.keys(SV_MONTHS), ...Object.keys(SV_DAYS)].join("|")})\\b`, "g");
const MONTH = `(${Object.keys(SV_MONTHS).join("|")})`;
const plural = (n, one, many) => (+n === 1 ? one : many);
const LANG_PATTERNS = [
  [/^just now$/, () => "nyss"],
  [/^(\d+) min ago$/, (m) => `${m[1]} min sedan`],
  [/^(\d+) ?h ago$/, (m) => `${m[1]} h sedan`],
  [/^(\d+) d ago$/, (m) => `${m[1]} d sedan`],
  [/^started (.+)$/, (m) => `startade ${trText(m[1])}`],
  [/^reviewed (.+)$/, (m) => `granskad ${trText(m[1])}`],
  [/^due (.+)$/, (m) => `senast ${m[1]}`],
  [/^(\d+) failed$/, (m) => `${m[1]} misslyckades`],
  [/^expires in (\d+) days$/i, (m) => `går ut om ${m[1]} dagar`],
  [/^(\d+) items?$/, (m) => `${m[1]} ${plural(m[1], "händelse", "händelser")}`],
  [/^(.+), (\d+) items?$/, (m) => `${trText(m[1])}, ${m[2]} ${plural(m[2], "händelse", "händelser")}`],
  [/^Step (\d+) of (\d+)$/, (m) => `Steg ${m[1]} av ${m[2]}`],
  [/^(\d+) of (\d+)$/, (m) => `${m[1]} av ${m[2]}`],
  [/^(\d+) of (\d+): (.+)$/, (m) => `${m[1]} av ${m[2]}: ${trText(m[3])}`],
  [/^Show news (\d+): (.+)$/, (m) => `Visa nyhet ${m[1]}: ${trText(m[2])}`],
  [
    /^(\d+) of (\d+) documents?(?: in (.+?))?(?: matching “(.*)”)?$/,
    (m) => `${m[1]} av ${m[2]} dokument${m[3] ? ` i ${trText(m[3])}` : ""}${m[4] != null ? ` som matchar ”${m[4]}”` : ""}`,
  ],
  [/^Week (\d+)$/, (m) => `Vecka ${m[1]}`],
  [/^Source (\d+)$/, (m) => `Källa ${m[1]}`],
  [/^(\d+) chunks? retrieved$/, (m) => `${m[1]} ${plural(m[1], "textdel hämtad", "textdelar hämtade")}`],
  [/^(\d+) chunks? above the ([\d.]+) similarity threshold$/, (m) => `${m[1]} textdelar över likhetströskeln ${m[2]}`],
  [/^Notifications, (\d+) unread$/, (m) => `Aviseringar, ${m[1]} olästa`],
  [/^Move (.+): position (\d+) of (\d+)\. Use the arrow keys\.$/, (m) => `Flytta ${trText(m[1])}: plats ${m[2]} av ${m[3]}. Använd piltangenterna.`],
  [/^Move (.+) (earlier|later)$/, (m) => `Flytta ${trText(m[1])} ${m[2] === "earlier" ? "bakåt" : "framåt"}`],
  [/^Remove (.+) from favorites$/, (m) => `Ta bort ${trText(m[1])} från favoriter`],
  [/^Add (.+) to favorites$/, (m) => `Lägg till ${trText(m[1])} i favoriter`],
  [/^Added (.+) to favorites$/, (m) => `${trText(m[1])} har lagts till i favoriter`],
  [/^Removed (.+) from favorites$/, (m) => `${trText(m[1])} har tagits bort från favoriter`],
  [/^You can have up to (\d+) favorites\. Remove one first\.$/, (m) => `Du kan ha upp till ${m[1]} favoriter. Ta bort en först.`],
  [/^Choose what appears as a card under Favorites\. (\d+) of (\d+) used\.$/, (m) => `Välj vad som visas som kort under Favoriter. ${m[1]} av ${m[2]} används.`],
  [/^Published “(.+)” in the calendar$/, (m) => `”${m[1]}” har publicerats i kalendern`],
  [/^Published “(.+)”$/, (m) => `”${m[1]}” har publicerats`],
  [/^Opening “(.+)” \(prototype\)$/, (m) => `Öppnar ”${trText(m[1])}” (prototyp)`],
  [/^Downloading (.+) \((.+)\)$/, (m) => `Laddar ner ${trText(m[1])} (${m[2]})`],
  [/^(.+): add a web address with Edit$/, (m) => `${trText(m[1])}: lägg till en webbadress med Redigera`],
  [/^(Open|Read) (.+)$/, (m) => `${m[1] === "Open" ? "Öppna" : "Läs"} ${trText(m[2])}`],
  [/^(.+) (on|off)$/, (m) => (SV[m[1]] ? `${SV[m[1]]} ${m[2] === "on" ? "på" : "av"}` : null)],
  [/^\[(.+)\]$/, (m) => `[${trText(m[1])}]`], // chat source labels: "[Core v4.2 release notes]"
  /* dates: "June 3, 2026" -> "3 juni 2026", "Jun 8" -> "8 jun"; other dates keep their order */
  [new RegExp(`^${MONTH} (\\d{1,2}), (\\d{4})$`), (m) => `${m[2]} ${SV_MONTHS[m[1]]} ${m[3]}`],
  [new RegExp(`^${MONTH} (\\d{1,2})$`), (m) => `${m[2]} ${SV_MONTHS[m[1]]}`],
];
/* English text (whitespace already tidied) -> Swedish; unknown text comes back unchanged */
function trText(s) {
  if (Object.prototype.hasOwnProperty.call(SV, s)) return SV[s];
  for (const [re, fn] of LANG_PATTERNS) {
    const m = s.match(re),
      out = m && fn(m);
    if (out) return out;
  }
  if (s.includes(" · ")) return s.split(" · ").map(trText).join(" · ");
  /* only date words, numbers and punctuation left: "Monday 16 November" -> "Måndag 16 november" */
  if (/^[A-Za-z0-9\s,.:–\-]+$/.test(s) && /\d/.test(s) && s.replace(DATE_WORD, "").replace(/[\d\s,.:–\-]/g, "") === "") {
    const out = s.replace(DATE_WORD, (w) => SV_MONTHS[w] || SV_DAYS[w]);
    return /^[A-Z]/.test(s) ? out[0].toUpperCase() + out.slice(1) : out;
  }
  return s;
}
let lang = (() => {
  try {
    return localStorage.getItem("qp-lang") === "sv" ? "sv" : "en";
  } catch (e) {
    return "en";
  }
})();
/* tr("English text") -> the chosen language (for texts outside the page, like the tab title) */
const tr = (en) => (lang === "sv" ? trText(en) : en);
const LANG_SKIP = "script,style,svg,code,pre,textarea,[data-no-tr]";
const LANG_ATTRS = ["title", "aria-label", "placeholder"];
const langOrig = new WeakMap(), // text node / element -> its English text (attributes: { attr: text })
  langSet = new WeakMap(); // what we last wrote there, so a change made by the page itself is noticed
function swap(en) {
  const m = en.match(/^(\s*)([\s\S]*?)(\s*)$/),
    key = m[2].replace(/\s+/g, " ");
  if (!key || lang === "en") return en;
  const out = trText(key);
  return out === key ? en : m[1] + out + m[3];
}
function langText(n) {
  if (!n.parentElement || n.parentElement.closest(LANG_SKIP)) return;
  if (langSet.get(n) !== n.data) langOrig.set(n, n.data); // new text from the page = new English original
  const out = swap(langOrig.get(n));
  if (out !== n.data) n.data = out;
  langSet.set(n, out);
}
function langAttr(el, a) {
  const v = el.getAttribute(a);
  if (v == null || el.closest("[data-no-tr]")) return; // a text box's placeholder / label is translated, its content is not
  const o = langOrig.get(el) || {},
    s = langSet.get(el) || {};
  if (s[a] !== v) o[a] = v;
  const out = swap(o[a]);
  if (out !== v) el.setAttribute(a, out);
  s[a] = out;
  langOrig.set(el, o);
  langSet.set(el, s);
}
function langTree(root) {
  if (root.nodeType === 3) return langText(root);
  if (root.nodeType !== 1 || root.closest("[data-no-tr]")) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) langText(n);
  [root, ...root.querySelectorAll("[title],[aria-label],[placeholder]")].forEach((el) =>
    LANG_ATTRS.forEach((a) => el.hasAttribute(a) && langAttr(el, a)),
  );
}
const langWatch = new MutationObserver((list) => {
  for (const r of list) {
    if (r.type === "childList") r.addedNodes.forEach(langTree);
    else if (r.type === "characterData") langText(r.target);
    else langAttr(r.target, r.attributeName);
  }
});
function applyLang() {
  document.documentElement.lang = lang;
  langTree(document.body);
  langWatch.disconnect();
  if (lang === "sv")
    langWatch.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: LANG_ATTRS });
  $$("[data-lang-set]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.langSet === lang));
}
function setLang(l) {
  lang = l === "sv" ? "sv" : "en";
  try {
    localStorage.setItem("qp-lang", lang);
  } catch (e) {}
  applyLang();
  syncViewLabel(); // the tab title
}

/* ---------- Light / dark mode ---------- */
const root = document.documentElement;
function syncThemeUI() {
  const dark = root.dataset.theme === "dark";
  /* the switch in the Settings popover: on = dark */
  $("#theme-switch").setAttribute("aria-checked", dark);
  $("#theme-state").textContent = dark ? "Dark mode" : "Light mode";
  $$("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.themeSet === root.dataset.theme));
  // Browser-tab icon follows the theme
  $("#favicon").href = `assets/brand/gold-cream-cube/qube-app-icon-${dark ? "dark" : "light"}-transparent.svg`;
}
function setTheme(t) {
  root.dataset.theme = t;
  try {
    localStorage.setItem("qp-theme", t);
  } catch (e) {}
  syncThemeUI();
}
function toggleTheme() {
  setTheme(root.dataset.theme === "dark" ? "light" : "dark");
}
$("#theme-switch").addEventListener("click", toggleTheme);
document.addEventListener("keydown", (e) => {
  if (
    e.key.toLowerCase() === "d" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !/INPUT|TEXTAREA/.test(document.activeElement.tagName) &&
    !document.body.classList.contains("is-touring")
  )
    toggleTheme();
});
syncThemeUI();

/* ---------- Notification & profile menus ---------- */
const menus = [
  [$("#settings-btn"), $("#settings-pop")],
  [$("#notif-btn"), $("#notif-menu")],
  [$("#profile-btn"), $("#profile-menu")],
];
function closeMenus(except) {
  menus.forEach(([b, m]) => {
    if (m !== except) {
      m.classList.remove("open");
      b.setAttribute("aria-expanded", "false");
    }
  });
}
menus.forEach(([b, m]) =>
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !m.classList.contains("open");
    closeMenus(m);
    m.classList.toggle("open", open);
    b.setAttribute("aria-expanded", open);
  }),
);
menus.forEach(([, m]) => m.addEventListener("click", (e) => e.stopPropagation()));
document.addEventListener("click", () => closeMenus());
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const settingsOpen = $("#settings-pop").classList.contains("open");
  closeMenus();
  if (settingsOpen) $("#settings-btn").focus();
});

/* ---------- Settings popover (gear next to the notifications bell) ----------
 * Appearance switch (above, "Light / dark mode"), language, tour, and Get help → IT support. */
$("#settings-btn").addEventListener("click", () => {
  if ($("#settings-pop").classList.contains("open")) requestAnimationFrame(() => $("#theme-switch").focus({ preventScroll: true }));
});
$$("[data-lang-set]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.langSet)));
/* Shortcut: S opens the Settings popover, S again (or Esc) hides it.
   Not while typing, not with Cmd / Ctrl / Alt, and not during the tour. */
function toggleSettings() {
  const open = $("#settings-pop").classList.contains("open");
  if (open) {
    closeMenus();
    $("#settings-btn").focus({ preventScroll: true });
  } else {
    if (window.qp) window.qp.closeOverlays(); // search, a document window or the chat drawer
    $("#settings-btn").click();
  }
}
document.addEventListener("keydown", (e) => {
  if (
    e.key.toLowerCase() !== "s" ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    e.repeat ||
    /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) ||
    document.activeElement.isContentEditable ||
    document.body.classList.contains("is-touring")
  )
    return;
  e.preventDefault();
  toggleSettings();
});
$("#sp-help").addEventListener("click", () => showView("it")); // showView closes the popover
$("#sp-tour").addEventListener("click", () => {
  closeMenus();
  if (window.qpTour) window.qpTour.start();
});
/* ---------- Sidebar ----------
 * Phones (<= 768px): the sidebar is a slide-out drawer. The hamburger in the top bar opens it;
 * a link, the backdrop, the ✕ button or Esc closes it.
 * Wider screens: the arrow on the line between the sidebar and the page shrinks the sidebar to an icon rail and back
 * (saved as "qp-nav-collapsed"). Every link has a title, so the icons still say what they are.
 * The classes live on <html> so the saved state applies before the page paints (see the <head> script). */
const sideNav = $("#side-nav"),
  navToggle = $("#nav-toggle"),
  navCollapse = $("#nav-collapse"),
  mobileNav = matchMedia("(max-width: 768px)");
const navIsOpen = () => root.classList.contains("nav-open");
function setNavOpen(open, { focus = true } = {}) {
  if (open === navIsOpen()) return;
  root.classList.toggle("nav-open", open);
  navToggle.setAttribute("aria-expanded", open);
  $(".main").inert = open; // the page behind the drawer cannot be tabbed into or clicked
  if (open) {
    closeMenus();
    (sideNav.querySelector(".nav button.active") || sideNav.querySelector("button")).focus({ preventScroll: true });
  } else if (focus && sideNav.contains(document.activeElement)) navToggle.focus({ preventScroll: true });
}
function syncNavLabel() {
  const label = root.classList.contains("nav-collapsed") ? "Show navigation" : "Hide navigation";
  navCollapse.setAttribute("aria-label", label); // the button is just an arrow on the sidebar edge
  navCollapse.title = label;
}
function setNavCollapsed(c) {
  root.classList.toggle("nav-collapsed", c);
  navCollapse.setAttribute("aria-expanded", !c);
  syncNavLabel();
  try {
    localStorage.setItem("qp-nav-collapsed", c ? "1" : "0");
  } catch (e) {}
}
navToggle.addEventListener("click", () => setNavOpen(!navIsOpen()));
navCollapse.addEventListener("click", () => setNavCollapsed(!root.classList.contains("nav-collapsed")));
$("#nav-close").addEventListener("click", () => setNavOpen(false));
$("#nav-scrim").addEventListener("click", () => {
  setNavOpen(false);
  navToggle.focus({ preventScroll: true }); // the press on the backdrop already moved focus out of the drawer
});
/* any button in the drawer (a view, a quick link, Edit) closes it after doing its job */
sideNav.addEventListener("click", (e) => {
  if (mobileNav.matches && e.target.closest("button")) setNavOpen(false);
});
/* Esc closes the drawer first (unless search or a modal is open on top of it) */
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Escape" || !navIsOpen() || document.querySelector(".overlay:not([hidden])")) return;
    e.stopPropagation();
    setNavOpen(false);
  },
  true,
);
mobileNav.addEventListener("change", (e) => !e.matches && setNavOpen(false, { focus: false }));
addEventListener("popstate", () => setNavOpen(false, { focus: false }));
setNavCollapsed(root.classList.contains("nav-collapsed"));

$("#mark-read").addEventListener("click", () => {
  $$(".notif.unread").forEach((n) => n.classList.remove("unread"));
  $("#notif-badge").hidden = true;
  $("#notif-btn").setAttribute("aria-label", "Notifications");
  notify("All caught up");
});

/* ---------- Time-based greeting ---------- */
function updateGreeting() {
  const h = new Date().getHours();
  const text = h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 18 ? "Good afternoon" : "Good evening";
  const el = $("#greet-text");
  if (el && el.textContent !== text) el.textContent = text;
}
updateGreeting();
setInterval(updateGreeting, 60 * 1000);

/* ---------- Role (prototype) ----------
 * There is no real login here, so the role is picked under Settings and saved in the browser.
 * HR and Manager see the Admin Panel. This only hides the page: a real intranet must also
 * check the role on the server before it accepts any changes. */
const ADMIN_ROLES = ["hr", "manager"];
let role = "manager";
try {
  role = localStorage.getItem("qp-role") || role;
} catch (e) {}
const isAdmin = () => ADMIN_ROLES.includes(role);
function syncRoleUI() {
  $$("[data-admin-only]").forEach((el) => (el.hidden = !isAdmin()));
  $$("[data-role-set]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.roleSet === role));
}
function setRole(r) {
  role = r;
  try {
    localStorage.setItem("qp-role", r);
  } catch (e) {}
  syncRoleUI();
  if (!isAdmin() && !$('.view[data-view="admin"]').hidden) showView("dashboard");
}

/* ---------- Sidebar views (Dashboard, News, Knowledge Hub, IT, Projects, Settings, Admin Panel) ---------- */
const VIEWS = {
  dashboard: "Dashboard",
  news: "News & information",
  knowledge: "Knowledge Hub",
  it: "IT support",
  projects: "Projects",
  settings: "Settings",
  admin: "Admin Panel",
};
let currentView = "dashboard";
function syncViewLabel() {
  $(".crumb b").textContent = VIEWS[currentView];
  document.title = (currentView === "dashboard" ? "" : tr(VIEWS[currentView]) + " · ") + "QualiPro · AI Knowledge Hub";
}
/* pages that moved: an old link or bookmark opens the new place (the Employee handbook is now in the Knowledge Hub) */
const MOVED_VIEWS = { handbook: "knowledge" };
function showView(name, { push = true } = {}) {
  if (MOVED_VIEWS[name]) {
    name = MOVED_VIEWS[name];
    if (!push) history.replaceState(null, "", "#" + name);
  }
  if (!VIEWS[name] || (name === "admin" && !isAdmin())) name = "dashboard";
  currentView = name;
  $$(".view").forEach((v) => (v.hidden = v.dataset.view !== name));
  $$(".nav [data-view-link]").forEach((b) => {
    const on = b.dataset.viewLink === name;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  syncViewLabel();
  if (push && location.hash !== "#" + name) history.pushState(null, "", "#" + name);
  closeMenus();
  scrollTo({ top: 0 });
}
$$("[data-view-link]").forEach((b) => b.addEventListener("click", () => showView(b.dataset.viewLink)));
addEventListener("popstate", () => showView(location.hash.slice(1), { push: false }));
showView(location.hash.slice(1), { push: false });

/* Settings controls */
$$("[data-theme-set]").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));
$$("[data-role-set]").forEach((b) =>
  b.addEventListener("click", () => {
    setRole(b.dataset.roleSet);
    notify(isAdmin() ? "Admin Panel is now in the sidebar" : "Admin Panel hidden for this role");
  }),
);
syncRoleUI();
$$(".switch").forEach((sw) =>
  sw.addEventListener("click", () => {
    const on = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", on);
    notify(`${sw.getAttribute("aria-label")} ${on ? "on" : "off"}`);
  }),
);
applyLang();
syncThemeUI();
