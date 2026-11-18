/* robot.js
 * QBot robot: flight animation (shared with the tour) and drag-and-drop.
 * Drag the robot anywhere; on release it flies back to its spot in the chat card.
 */
/* ================= QBot guide robot: shared flight helpers ================= */
const mascot = $("#mascot"),
  note = $("#mascot-note"),
  guide = $("#guide"),
  gBody = guide.querySelector(".guide-body");
let pos = { x: 0, y: 0 };
function setGuide(x, y, rot = 0) {
  pos = { x, y };
  guide.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`;
}
async function flyTo(x, y) {
  const from = { ...pos },
    dx = x - from.x,
    dy = y - from.y,
    dist = Math.hypot(dx, dy);
  if (dist < 2 || reduce()) {
    setGuide(x, y);
    return;
  }
  const dur = clamp(dist * 1.6, 550, 1300),
    lift = clamp(dist * 0.28, 40, 150),
    tilt = clamp(dx / 12, -16, 16),
    midX = from.x + dx / 2,
    midY = Math.min(from.y, y) - lift;
  guide.classList.add("flying");
  const anim = guide.animate(
    [
      { transform: `translate(${from.x}px,${from.y}px) rotate(0deg)` },
      {
        transform: `translate(${from.x + dx * 0.15}px,${from.y - lift * 0.35}px) rotate(${tilt * 0.8}deg)`,
        offset: 0.18,
      },
      { transform: `translate(${midX}px,${midY}px) rotate(${tilt}deg)`, offset: 0.5 },
      { transform: `translate(${x}px,${y - 8}px) rotate(${-tilt * 0.3}deg)`, offset: 0.88 },
      { transform: `translate(${x}px,${y}px) rotate(0deg)` },
    ],
    { duration: dur, easing: "cubic-bezier(.45,.05,.35,1)" },
  );
  await anim.finished.catch(() => {});
  setGuide(x, y);
  guide.classList.remove("flying");
  guide.classList.remove("wave");
  void guide.offsetWidth;
  guide.classList.add("wave");
}
const homeOf = () => {
  const m = mascot.getBoundingClientRect();
  return { x: m.left + (m.width - guide.offsetWidth) / 2, y: m.bottom - guide.offsetHeight };
};

/* ================= Drag the robot around; it flies home when released ================= */
const NOTE_IDLE = note.innerHTML;
let noteTimer;
function say(html, ms) {
  clearTimeout(noteTimer);
  note.innerHTML = html;
  if (ms) noteTimer = setTimeout(() => (note.innerHTML = NOTE_IDLE), ms);
}
let drag = null,
  justDragged = false,
  returning = false;
mascot.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || tour.active || returning) return;
  const r = mascot.getBoundingClientRect();
  drag = {
    id: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    offX: e.clientX - r.left,
    offY: e.clientY - r.top,
    w: r.width,
    h: r.height,
    started: false,
    lx: e.clientX,
    lt: performance.now(),
    rot: 0,
  };
});
addEventListener(
  "pointermove",
  (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
      drag.started = true;
      closeMenus();
      stage.style.transform = "";
      guide.style.width = drag.w + "px";
      guide.style.height = drag.h + "px";
      gBody.style.transformOrigin = `${(drag.offX / drag.w) * 100}% ${(drag.offY / drag.h) * 100}%`;
      guide.classList.add("on", "held");
      document.body.classList.add("is-holding", "grabbing");
      say("<b>QBot:</b> Wheee! Put me down!");
    }
    e.preventDefault();
    const now = performance.now(),
      vx = ((e.clientX - drag.lx) / Math.max(now - drag.lt, 8)) * 16;
    drag.lx = e.clientX;
    drag.lt = now;
    drag.rot += (clamp(-vx * 2.2, -28, 28) - drag.rot) * 0.35; /* dangles like it's held by the hand */
    gBody.style.transform = `rotate(${drag.rot.toFixed(2)}deg)`;
    setGuide(e.clientX - drag.offX, e.clientY - drag.offY);
  },
  { passive: false },
);
async function release(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.started) return;
  justDragged = true;
  returning = true;
  document.body.classList.remove("grabbing");
  gBody.style.transition = "transform .3s";
  gBody.style.transform = "";
  guide.classList.remove("held");
  say("<b>QBot:</b> Okay, flying home…");
  const h = homeOf();
  await flyTo(h.x, h.y);
  guide.classList.remove("on", "wave");
  guide.style.width = guide.style.height = "";
  gBody.style.transition = "";
  gBody.style.transformOrigin = "";
  document.body.classList.remove("is-holding");
  returning = false;
  say("<b>QBot:</b> Home sweet home!", 1800);
}
addEventListener("pointerup", release);
addEventListener("pointercancel", release);
mascot.addEventListener("click", () => {
  if (justDragged) {
    justDragged = false;
    return;
  }
  /* click = wave, double-click = jump (js/mascot3d.js). The tour starts from the speech bubble or the ? button. */
  if (window.qpMascot) qpMascot.click();
  else tour.start();
});
note.addEventListener("click", () => tour.start());
