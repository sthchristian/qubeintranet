/* calendar.js
 * "Calendar" card on the dashboard: a week strip + the agenda for the picked day.
 * Edit the EVENTS array to change what shows up. `day` is an offset from today
 * (0 = today, 1 = tomorrow, -1 = yesterday) so the prototype always looks current.
 * type: "meeting" | "event" | "deadline"
 *
 * Clicking an agenda item opens a details popover (#cal-pop). It shows:
 *   desc    one or two sentences about the item
 *   people  attendees, organiser first (ME is shown as "You")
 *   links   buttons at the bottom; the first one is the primary (gold) button.
 *           The URLs are made up, so a click only shows a toast (see "Prototype links" below).
 *
 * Events published in the Admin Panel (js/features.js) are saved in localStorage under "qp-events"
 * with a real date and are added to EVENTS by loadSaved(). window.qpCalendar.reload() re-reads them.
 */
(function () {
  const ME = "Alex Lindqvist";
  const teams = (id) => ({ label: "Join in Teams", url: `https://teams.example.com/meet/qp-${id}` });
  const meet = (id) => ({ label: "Join with Meet", url: `https://meet.example.com/qp-${id}` });
  const notes = (label, id) => ({ label, url: `https://notes.example.com/qualipro/${id}` });
  const EVENTS = [
    { day: 0, time: "09:30", end: "09:45", title: "Engineering stand-up", type: "meeting", where: "Teams",
      desc: "Daily sync: what you did yesterday, what is next, and anything blocking you.",
      people: ["Maja Berg", ME, "Jonas Ek", "Linnea Sjöberg", "Omar Haddad"],
      links: [teams("standup"), notes("Stand-up notes", "eng-standup")] },
    { day: 0, time: "13:00", end: "14:00", title: "POC plan review with Maja", type: "meeting", where: "Room Kepler",
      desc: "Walk through the Retail AI proof-of-concept plan: scope, timeline and open risks.",
      people: ["Maja Berg", ME, "Linnea Sjöberg"],
      links: [meet("poc-review"), notes("POC plan", "poc-retail-ai-plan")] },
    { day: 0, time: "16:00", end: "", title: "Security key registration closes", type: "deadline", where: "IT support",
      desc: "Last day to register your YubiKey before multi-factor authentication becomes mandatory.",
      people: ["Omar Haddad", "Elias Holm"],
      links: [notes("Register a key", "it-security-key"), notes("MFA guide", "handbook-mfa")] },
    { day: 1, time: "10:00", end: "11:30", title: "QualiPro Core v4.2 walkthrough", type: "event", where: "Auditorium + stream",
      desc: "Engineering demos what is new in Core v4.2, followed by questions.",
      people: ["Jonas Ek", "Maja Berg", "Omar Haddad", ME],
      links: [teams("core-42-stream"), notes("Release notes", "core-v4-2")] },
    { day: 1, time: "15:00", end: "15:30", title: "1:1 with team lead", type: "meeting", where: "Teams",
      desc: "Your regular check-in: priorities, feedback and anything on your mind.",
      people: ["Maja Berg", ME],
      links: [teams("1on1-maja"), notes("Shared 1:1 notes", "1on1-alex-maja")] },
    { day: 2, time: "12:00", end: "13:00", title: "Lunch & learn: secure prompts", type: "event", where: "Kitchen",
      desc: "Omar shows how to write prompts that keep client data safe. Lunch is provided.",
      people: ["Omar Haddad", "Sara Nyström", "Linnea Sjöberg", ME],
      links: [meet("lunch-learn"), notes("Slides", "secure-prompts")] },
    { day: 4, time: "09:00", end: "10:00", title: "Sprint planning", type: "meeting", where: "Room Kepler",
      desc: "Agree on the sprint goal and pull stories from the backlog.",
      people: ["Maja Berg", ME, "Jonas Ek", "Linnea Sjöberg", "Omar Haddad"],
      links: [teams("sprint-planning"), notes("Sprint board", "sprint-47")] },
    { day: 4, time: "17:00", end: "", title: "Q4 OKR draft due", type: "deadline", where: "Projects",
      desc: "Send your team's draft objectives and key results to Maja for review.",
      people: ["Maja Berg", ME],
      links: [notes("Open OKR draft", "okr-q4-draft"), notes("OKR template", "okr-template")] },
    { day: 6, time: "16:00", end: "18:00", title: "Friday after-work", type: "event", where: "Rooftop",
      desc: "Drinks and snacks on the rooftop. Bring a colleague.",
      people: ["Sara Nyström", "Karin Åberg", "Elias Holm", ME],
      links: [notes("RSVP", "after-work-rsvp")] },
    { day: 8, time: "11:00", end: "12:00", title: "Architecture guild", type: "meeting", where: "Teams",
      desc: "Monthly guild: this time event-driven integrations and the v4.3 service map.",
      people: ["Jonas Ek", "Omar Haddad", "Maja Berg", ME],
      links: [teams("arch-guild"), notes("Guild notes", "architecture-guild")] },
    { day: -2, time: "14:00", end: "15:00", title: "Retro", type: "meeting", where: "Room Kepler",
      desc: "Sprint retrospective: what went well, what did not, and what to try next sprint.",
      people: ["Maja Berg", ME, "Jonas Ek", "Linnea Sjöberg", "Omar Haddad"],
      links: [teams("retro"), notes("Retro notes", "retro-sprint-46")] },
  ];
  const TYPE_LABEL = { meeting: "Meeting", event: "Event", deadline: "Deadline" };
  const el = {
    month: document.getElementById("cal-month"),
    week: document.getElementById("cal-week"),
    agenda: document.getElementById("cal-agenda"),
    pop: document.getElementById("cal-pop"),
  };
  if (!el.week) return;
  const say = (m) => typeof notify === "function" && notify(m);
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const DAY = 864e5;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const offset = (d) => Math.round((startOfDay(d) - today) / DAY);
  const eventsOn = (d) => EVENTS.filter((e) => e.day === offset(d)).sort((a, b) => a.time.localeCompare(b.time));
  /* ISO week number (weeks start on Monday, week 1 holds the first Thursday of the year) */
  const isoWeek = (d) => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
  };

  let selected = today;
  let weekStart = mondayOf(today);

  /* ---------- Events saved by the Admin Panel: { id, date: "YYYY-MM-DD", time, end, title, type, where } ---------- */
  const BUILT_IN = EVENTS.length;
  const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || "");
  const fromISO = (s) => {
    const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || "");
    return m ? new Date(+m[1], m[2] - 1, +m[3]) : null;
  };
  function loadSaved() {
    EVENTS.length = BUILT_IN; // drop the saved ones, then add them again
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("qp-events"));
    } catch (e) {}
    if (!Array.isArray(saved)) return;
    saved.forEach((ev) => {
      const d = ev && fromISO(ev.date);
      if (!d || !ev.title || !TYPE_LABEL[ev.type] || !isTime(ev.time)) return; // skip anything malformed
      const end = ev.type !== "deadline" && isTime(ev.end) && ev.end > ev.time ? ev.end : "";
      EVENTS.push({ day: offset(d), time: ev.time, end, title: String(ev.title), type: ev.type, where: String(ev.where || "") });
    });
  }
  /* Used by the Admin Panel. Pass a date ("YYYY-MM-DD") to also jump to that day. */
  window.qpCalendar = {
    reload(date) {
      loadSaved();
      const d = fromISO(date);
      if (d) {
        selected = d;
        weekStart = mondayOf(d);
      }
      render();
    },
  };

  function render() {
    closePop(false); // the agenda is rebuilt below, so an open popover would lose its event
    const days = Array.from({ length: 7 }, (_, n) => addDays(weekStart, n));
    const months = [...new Set(days.map((d) => d.toLocaleDateString("en-GB", { month: "long" })))];
    el.month.innerHTML = `${months.join(" – ")} ${days[6].getFullYear()} <span class="pill muted">Week ${isoWeek(weekStart)}</span>`;

    el.week.innerHTML = days
      .map((d) => {
        const evs = eventsOn(d),
          isSel = +d === +selected,
          isToday = +d === +today;
        const dots = evs
          .slice(0, 3)
          .map((e) => `<i class="t-${e.type}"></i>`)
          .join("");
        return `<button type="button" role="tab" class="cal-day${isSel ? " sel" : ""}${isToday ? " today" : ""}"
          aria-selected="${isSel}" data-off="${offset(d)}"
          aria-label="${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${evs.length} item${evs.length === 1 ? "" : "s"}">
          <small>${d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}</small>
          <b>${d.getDate()}</b><span class="dots">${dots}</span></button>`;
      })
      .join("");

    const evs = eventsOn(selected);
    const off = offset(selected);
    const heading =
      off === 0 ? "Today" : off === 1 ? "Tomorrow" : off === -1 ? "Yesterday"
        : selected.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
    el.agenda.innerHTML =
      `<div class="cal-agenda-head">${heading}<span>${evs.length || "No"} item${evs.length === 1 ? "" : "s"}</span></div>` +
      (evs.length
        ? evs
            .map(
              (e) => `<button type="button" class="cal-event t-${e.type}" data-id="${EVENTS.indexOf(e)}" aria-haspopup="dialog" aria-expanded="false">
              <span class="cal-time">${e.time}${e.end ? `<small>${e.end}</small>` : ""}</span>
              <span class="cal-copy"><strong>${esc(e.title)}</strong><small>${TYPE_LABEL[e.type]}${e.where ? ` · ${esc(e.where)}` : ""}</small></span>
            </button>`,
            )
            .join("")
        : `<div class="cal-empty">Nothing scheduled. Enjoy the focus time.</div>`);
  }

  /* ---------- Event details popover ---------- */
  let popFor = null; // the agenda button the open popover belongs to
  const initials = (n) =>
    n
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2);
  function duration(e) {
    if (!e.end) return "";
    const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
    const m = mins(e.end) - mins(e.time);
    return [m >= 60 && `${Math.floor(m / 60)} h`, m % 60 && `${m % 60} min`].filter(Boolean).join(" ");
  }
  function popHtml(e) {
    const date = selected.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const time = e.end ? `${e.time}–${e.end}` : e.type === "deadline" ? `due ${e.time}` : e.time;
    const people = e.people || [],
      links = e.links || [];
    return `<div class="cal-pop-head">
        <div>
          <div class="cal-pop-kicker"><i></i>${TYPE_LABEL[e.type]}</div>
          <h3 id="cal-pop-title">${esc(e.title)}</h3>
        </div>
        <button type="button" class="icon-btn cal-pop-close" aria-label="Close details">✕</button>
      </div>
      <dl class="cal-pop-meta">
        <div><dt>When</dt><dd>${date} · ${time}${e.end ? `<small>${duration(e)}</small>` : ""}</dd></div>
        ${e.where ? `<div><dt>Where</dt><dd>${esc(e.where)}</dd></div>` : ""}
      </dl>
      ${e.desc ? `<p class="cal-pop-desc">${esc(e.desc)}</p>` : ""}
      ${
        people.length
          ? `<div class="widget-sub">${e.type === "deadline" ? "Contacts" : "Attendees"} · ${people.length}</div>
      <ul class="cal-people">${people
        .map(
          (n, i) =>
            `<li${i === 0 ? ' title="Organiser"' : ""}><span class="avatar">${esc(initials(n))}</span>${n === ME ? "You" : esc(n)}${i === 0 ? "<small>organiser</small>" : ""}</li>`,
        )
        .join("")}</ul>`
          : ""
      }
      ${
        links.length
          ? `<div class="cal-pop-foot">${links
              .map((l, i) => `<a class="btn${i === 0 ? " primary" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} <svg class="ico ico-inline"><use href="#i-ext" /></svg></a>`)
              .join("")}</div>`
          : ""
      }`;
  }
  /* Sits beside the calendar card when there is room on its left (desktop), otherwise below or above the event (tablet, phone). */
  function placePop() {
    if (!popFor) return;
    const r = popFor.getBoundingClientRect(),
      card = (popFor.closest(".cal") || popFor).getBoundingClientRect(),
      w = el.pop.offsetWidth,
      h = el.pop.offsetHeight,
      vw = document.documentElement.clientWidth,
      vh = innerHeight,
      gap = 10,
      pad = 12;
    let x, y;
    if (card.left - gap - w >= pad) {
      x = card.left - gap - w;
      y = Math.min(r.top + r.height / 2 - h / 2, vh - h - pad);
    } else {
      x = Math.min(r.left, vw - w - pad);
      y = r.bottom + gap + h <= vh - pad || r.top - gap - h < pad ? r.bottom + gap : r.top - gap - h;
    }
    el.pop.style.left = `${Math.max(pad, x) + scrollX}px`;
    el.pop.style.top = `${Math.max(pad, y) + scrollY}px`;
  }
  function openPop(btn) {
    const e = EVENTS[+btn.dataset.id];
    if (!e) return;
    if (!el.pop) return say(`Opening “${e.title}”`); // no #cal-pop in the page: fall back to a toast
    closePop(false);
    popFor = btn;
    btn.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    el.pop.className = `cal-pop t-${e.type}`;
    el.pop.innerHTML = popHtml(e);
    el.pop.hidden = false;
    placePop();
    el.pop.querySelector(".cal-pop-close").focus({ preventScroll: true });
  }
  function closePop(refocus = true) {
    if (!popFor) return;
    const btn = popFor;
    popFor = null;
    el.pop.hidden = true;
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    if (refocus && btn.isConnected) btn.focus({ preventScroll: true });
  }
  if (el.pop) {
    el.pop.addEventListener("click", (e) => {
      if (e.target.closest(".cal-pop-close")) return closePop();
      /* Prototype links: the URLs are made up, so show a toast instead of opening them.
         Remove these three lines when the events carry real links. */
      const a = e.target.closest("a[href]");
      if (!a) return;
      e.preventDefault();
      say(`Opening “${a.textContent.trim()}” (prototype)`);
    });
    /* keep Tab inside the open popover */
    el.pop.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = [...el.pop.querySelectorAll("button, [href]")],
        first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    /* click outside closes it (another agenda item swaps the content instead) */
    document.addEventListener("pointerdown", (e) => {
      if (popFor && !el.pop.contains(e.target) && !e.target.closest(".cal-event")) closePop(false);
    });
    /* Esc closes the popover first; search and the modal sit on top of it, so they go before it */
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || !popFor || document.querySelector(".overlay:not([hidden])")) return;
        e.stopPropagation();
        closePop();
      },
      true,
    );
    addEventListener("resize", placePop);
    /* leaving the dashboard view (sidebar, search) hides the calendar: close the popover too */
    const view = el.week.closest(".view");
    if (view) new MutationObserver(() => view.hidden && closePop(false)).observe(view, { attributeFilter: ["hidden"] });
  }

  el.week.addEventListener("click", (e) => {
    const b = e.target.closest(".cal-day");
    if (!b) return;
    selected = addDays(today, +b.dataset.off);
    render();
    el.week.querySelector(".cal-day.sel")?.focus();
  });
  el.week.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    selected = addDays(selected, step);
    if (selected < weekStart || selected >= addDays(weekStart, 7)) weekStart = mondayOf(selected);
    render();
    el.week.querySelector(".cal-day.sel")?.focus();
  });
  el.agenda.addEventListener("click", (e) => {
    const b = e.target.closest(".cal-event");
    if (!b) return;
    if (b === popFor) closePop();
    else openPop(b);
  });
  const shiftWeek = (n) => {
    weekStart = addDays(weekStart, 7 * n);
    selected = addDays(selected, 7 * n);
    render();
  };
  document.getElementById("cal-prev").addEventListener("click", () => shiftWeek(-1));
  document.getElementById("cal-next").addEventListener("click", () => shiftWeek(1));
  document.getElementById("cal-today").addEventListener("click", () => {
    selected = today;
    weekStart = mondayOf(today);
    render();
  });

  loadSaved();
  render();
})();
