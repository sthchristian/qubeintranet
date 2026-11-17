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

/* ---------- Light / dark mode ---------- */
const root = document.documentElement;
function syncThemeUI() {
  const dark = root.dataset.theme === "dark";
  $("#theme-btn").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  const mi = $("#menu-theme");
  mi.querySelector("span").textContent = dark ? "Light mode" : "Dark mode";
  mi.querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
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
$("#theme-btn").addEventListener("click", toggleTheme);
$("#menu-theme").addEventListener("click", toggleTheme);
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
  if (e.key === "Escape") closeMenus();
});
/* ---------- Sidebar ----------
 * Phones (<= 768px): the sidebar is a slide-out drawer. The hamburger in the top bar opens it;
 * a link, the backdrop, the ✕ button or Esc closes it.
 * Wider screens: "Hide navigation" under the logo shrinks the sidebar to an icon rail and back
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
function setNavCollapsed(c) {
  root.classList.toggle("nav-collapsed", c);
  const label = c ? "Show navigation" : "Hide navigation";
  navCollapse.setAttribute("aria-expanded", !c);
  navCollapse.querySelector(".label").textContent = label;
  navCollapse.title = label;
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

/* ---------- Sidebar views (Dashboard, News, Handbook, IT, Projects, Settings, Admin Panel) ---------- */
const VIEWS = {
  dashboard: "Dashboard",
  news: "News & information",
  handbook: "Employee handbook",
  it: "IT support",
  projects: "Projects",
  settings: "Settings",
  admin: "Admin Panel",
};
function showView(name, { push = true } = {}) {
  if (!VIEWS[name] || (name === "admin" && !isAdmin())) name = "dashboard";
  $$(".view").forEach((v) => (v.hidden = v.dataset.view !== name));
  $$(".nav [data-view-link]").forEach((b) => {
    const on = b.dataset.viewLink === name;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $(".crumb b").textContent = VIEWS[name];
  document.title = (name === "dashboard" ? "" : VIEWS[name] + " · ") + "QualiPro · AI Knowledge Hub";
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
syncThemeUI();
