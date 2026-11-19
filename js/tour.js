/* tour.js
 * First-time user tour. Edit the STEPS array to change the text or add steps.
 * Each step points at a CSS selector; the robot flies there and shows the tooltip.
 * Tip: run qpTour.reset() in the console, then reload, to see it again.
 */
/* ================= First-time user tour ================= */
const tour = (function () {
  const TOUR_KEY = "qp-tour-done-v2";
  const STEPS = [
    {
      target: null,
      title: "Hi Alex, I’m <span class=\"name\">QBot!</span>",
      text: "I’m your guide to the QualiPro Knowledge Hub. Let me show you around. It only takes 30 seconds.",
      next: "Let’s go",
    },
    {
      target: "#chat-form",
      title: "Ask anything",
      text: "Type a question about policies, projects or developer guides. Press Enter to ask, Shift + Enter for a new line.",
    },
    {
      target: ".suggestions",
      title: "Not sure where to start?",
      text: "Tap a suggestion and I’ll fill in a ready-made question for you.",
    },
    {
      target: ".rail .nav",
      title: "Find your way",
      text: "Jump between News, the Employee handbook, IT support and Projects from this menu.",
    },
    {
      target: ".quick-nav",
      title: "Your shortcuts",
      text: "One click to Jira, GitHub and the architecture wiki. Use Edit to make them your own.",
    },
    {
      target: "#notif-btn",
      title: "Notifications",
      text: "New updates and mentions land here. The yellow badge shows how many you haven’t read yet.",
    },
    {
      target: "#profile-btn",
      title: "Your profile",
      text: "Your profile and sign-out live up here.",
    },
    {
      target: "#settings-btn",
      title: "Your settings",
      text: "The gear opens your settings: light or dark mode (or press D), language, and help. We’ll remember your choices.",
    },
    {
      target: "#news-home",
      title: "Stay in the loop",
      text: "The newest company updates, as a slideshow. Click one to read it.",
    },
    {
      target: "#cal",
      title: "What’s coming up",
      text: "Meetings, events and deadlines for the week. Pick a day to see its agenda, or use the arrows to change week.",
    },
    {
      target: "#search-trigger",
      title: "Jump anywhere",
      text: "Search pages, tools and actions here, or press Cmd/Ctrl + K from anywhere.",
    },
    {
      target: "#settings-btn",
      title: "That’s the tour!",
      text: "Replay it any time from the gear (Take the tour), or click my speech bubble. Psst: click me for a wave, double-click for a jump, or grab me and drag me around!",
      next: "Finish",
    },
  ];
  const layer = $("#tour-layer"),
    spot = $("#tour-spot"),
    tip = $("#tip");
  let steps = [],
    i = 0,
    busy = false,
    lastFocus = null;
  const api = { active: false };
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      getComputedStyle(el).visibility !== "hidden" &&
      getComputedStyle(el).display !== "none"
    );
  };
  const store = {
    get() {
      try {
        return localStorage.getItem(TOUR_KEY);
      } catch (e) {
        return null;
      }
    },
    set() {
      try {
        localStorage.setItem(TOUR_KEY, "1");
      } catch (e) {}
    },
  };

  function renderTip() {
    const s = steps[i],
      last = i === steps.length - 1;
    tip.innerHTML = `<button class="tip-skip" data-act="skip" aria-label="Skip tour">${last ? "Close" : "Skip tour"}</button>
  <div class="tip-step">Step ${i + 1} of ${steps.length}</div><h3 id="tip-title">${s.title}</h3><p>${s.text}</p>
  <div class="tip-foot"><div class="tip-dots">${steps.map((_, n) => `<i class="${n === i ? "on" : ""}"></i>`).join("")}</div>
  <div class="tip-btns">${i > 0 ? '<button data-act="back">Back</button>' : ""}<button class="primary" data-act="next">${s.next || "Next"}</button></div></div>`;
  }
  function layout() {
    const s = steps[i],
      el = s.target ? $(s.target) : null,
      vw = innerWidth,
      vh = innerHeight,
      m = 14,
      g = 14;
    const rw = guide.offsetWidth,
      rh = guide.offsetHeight,
      tw = tip.offsetWidth,
      th = tip.offsetHeight,
      stack = vw < 620;
    tip.classList.toggle("stack", stack);
    const gw = stack ? tw : rw + 10 + tw,
      gh = stack ? th + rh - 22 : Math.max(rh, th);
    let r = null;
    if (el) {
      const b = el.getBoundingClientRect(),
        p = 8;
      r = { left: b.left - p, top: b.top - p, width: b.width + p * 2, height: b.height + p * 2 };
      r.right = r.left + r.width;
      r.bottom = r.top + r.height;
    }
    let gx, gy;
    if (!r) {
      gx = (vw - gw) / 2;
      gy = (vh - gh) / 2;
    } else if (r.bottom + g + gh < vh - m) {
      gx = clamp(r.left + r.width / 2 - gw / 2, m, vw - gw - m);
      gy = r.bottom + g;
    } else if (r.top - g - gh > m) {
      gx = clamp(r.left + r.width / 2 - gw / 2, m, vw - gw - m);
      gy = r.top - g - gh;
    } else if (r.right + g + gw < vw - m) {
      gx = r.right + g;
      gy = clamp(r.top + r.height / 2 - gh / 2, m, vh - gh - m);
    } else if (r.left - g - gw > m) {
      gx = r.left - g - gw;
      gy = clamp(r.top + r.height / 2 - gh / 2, m, vh - gh - m);
    } else {
      gx = (vw - gw) / 2;
      gy = vh - gh - m;
    }
    if (r && r.width > gw * 1.6 && r.bottom + g + gh < vh - m)
      gx = clamp(r.left, m, vw - gw - m); /* wide targets: align to left edge */
    const robot = stack ? { x: gx + tw - rw - 6, y: gy } : { x: gx, y: gy + gh - rh };
    const t = stack ? { x: gx, y: gy + rh - 22 } : { x: gx + rw + 10, y: gy + gh - th };
    return { r, robot, t };
  }
  function placeSpot(r) {
    if (!r) {
      spot.classList.add("empty");
      Object.assign(spot.style, {
        left: innerWidth / 2 + "px",
        top: innerHeight / 2 + "px",
        width: "0px",
        height: "0px",
      });
      return;
    }
    spot.classList.remove("empty");
    Object.assign(spot.style, {
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      height: r.height + "px",
    });
  }
  async function go(n) {
    if (busy) return;
    busy = true;
    i = clamp(n, 0, steps.length - 1);
    tip.classList.remove("on");
    const s = steps[i],
      el = s.target ? $(s.target) : null;
    if (el) {
      const b = el.getBoundingClientRect();
      if (b.top < 70 || b.bottom > innerHeight - 70) {
        el.scrollIntoView({ block: "center", behavior: reduce() ? "auto" : "smooth" });
        await sleep(reduce() ? 30 : 450);
      }
    }
    renderTip();
    const L = layout();
    placeSpot(L.r);
    await flyTo(L.robot.x, L.robot.y);
    tip.style.left = L.t.x + "px";
    tip.style.top = L.t.y + "px";
    tip.classList.add("on");
    tip.querySelector('[data-act="next"]').focus({ preventScroll: true });
    busy = false;
  }
  function reflow() {
    if (!api.active || busy) return;
    const L = layout();
    placeSpot(L.r);
    setGuide(L.robot.x, L.robot.y);
    tip.style.left = L.t.x + "px";
    tip.style.top = L.t.y + "px";
  }
  async function start() {
    if (api.active || returning || drag) return;
    api.active = true;
    busy = true;
    lastFocus = document.activeElement;
    closeMenus();
    if (window.qp) window.qp.closeOverlays();
    showView("dashboard"); // the tour points at dashboard elements
    steps = STEPS.filter((s) => !s.target || visible($(s.target)));
    if (scrollY > 10) {
      scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" });
      await sleep(reduce() ? 30 : 500);
    }
    guide.classList.add("on");
    const h = homeOf();
    setGuide(h.x, h.y);
    document.body.classList.add("is-touring");
    layer.classList.add("on");
    spot.classList.add("on");
    tip.setAttribute("role", "dialog");
    tip.setAttribute("aria-modal", "true");
    tip.setAttribute("aria-labelledby", "tip-title");
    busy = false;
    go(0);
  }
  async function end() {
    if (!api.active) return;
    busy = true;
    store.set();
    tip.classList.remove("on");
    spot.classList.remove("on");
    const sb = $(".chat-stage").getBoundingClientRect();
    if (sb.bottom < 0 || sb.top > innerHeight) {
      scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" });
      await sleep(reduce() ? 30 : 450);
    }
    const h = homeOf();
    await flyTo(h.x, h.y);
    layer.classList.remove("on");
    guide.classList.remove("on", "wave");
    document.body.classList.remove("is-touring");
    api.active = false;
    busy = false;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  tip.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (!a || busy) return;
    const act = a.dataset.act;
    if (act === "next") {
      i === steps.length - 1 ? end() : go(i + 1);
    } else if (act === "back") go(i - 1);
    else if (act === "skip") end();
  });
  document.addEventListener("keydown", (e) => {
    if (!api.active || busy) return;
    if (e.key === "Escape") end();
    else if (e.key === "ArrowRight") i === steps.length - 1 ? end() : go(i + 1);
    else if (e.key === "ArrowLeft" && i > 0) go(i - 1);
  });
  addEventListener("resize", reflow);
  addEventListener("scroll", reflow, { passive: true });
  $("#settings-tour").addEventListener("click", start);
  if (!store.get()) addEventListener("load", () => setTimeout(start, 900));
  api.start = start;
  api.reset = () => {
    try {
      localStorage.removeItem(TOUR_KEY);
    } catch (e) {}
  };
  window.qpTour = api;
  return api;
})();
