# QualiPro Knowledge Hub – dashboard

Serve this folder with a web server and open it in a browser:

    cd qp-dashboard && python3 -m http.server 5178      →  http://localhost:5178

(Opening index.html by double-click also works, but the browser then blocks the
3D model and the 2D robot image is shown instead.)

To run on terminal use: python3 -m http.server 5178

```
index.html          Page markup (sections are marked with <!-- ===== ... ===== --> comments)
css/
  base.css          Layout + DARK mode (default). Colour tokens are at the top in :root
  mascot.css        QBot robot in the chat card, its speech bubble, and the 3D model
  topbar.css        Theme toggle, tour button, notifications + profile dropdowns
  tour.css          First-time tour: spotlight, flying robot, tooltip
  features.css      Search field, command palette, modal, dashboard widgets, AI drawer, Admin Panel,
                    Customize dashboard (drag-and-drop)
  knowledge.css     Knowledge Hub only: toolbar, category chips and document cards
  light.css         LIGHT mode (qualipro.se style). Only applies when light mode is on
js/
  app.js            Toasts, chat box, theme switch, dropdown menus, views, role (who sees the Admin Panel),
                    sidebar: mobile drawer (<= 768px) + "Hide navigation" icon rail on desktop
  calendar.js       Calendar card: week strip + agenda + event details popover (edit the EVENTS array)
  robot.js          Robot flight animation + drag-and-drop
  tour.js           Tour steps (edit the STEPS array) and tour logic
  features.js       Command palette (Cmd/Ctrl+K), modal + DOCS, checklist, quick access,
                    activity feed, sidebar quick links + their Edit button,
                    News (dashboard slideshow, article reader, NEWS_DEFAULTS),
                    Admin Panel (publish news with a cover image + calendar events),
                    Customize dashboard (drag the boxes into a new order)
  knowledge.js      Knowledge Hub view: the LIBRARY of documents, search, category filters,
                    sorting, the document modal and the .txt download. Registers every
                    document in DOCS (qp.addDocs), so they pin and appear under Recent
  chat.js           QualiChat drawer: simulated answers with citations + citation inspector
  mascot3d.js       3D robot: POSES, EYES, QUOTES and its behaviour
  vendor/           <model-viewer> 4.0.0, local copy (no internet needed)
assets/
  qp.glb            The 3D robot
  qp-robot.webp     2D robot, shown while the model loads or if it cannot load
  news/             Default news covers, one per category (photos from Unsplash, free to use)
```

Load order matters: CSS and scripts as listed in `index.html`.

Handy:
- Sidebar icons: SVG `<symbol>`s at the top of `index.html` (quick links: `LINK_ICONS` in `js/features.js`).
- News: the starting articles are `NEWS_DEFAULTS` in `js/features.js` (copied into the browser on the first
  visit), covers per category in `NEWS_COVERS`, slideshow length/speed in `HOME_SLIDES` / `SLIDE_EVERY`.
- Shortcuts: Cmd/Ctrl + K search, D light/dark mode, S open / hide the Settings popover (js/app.js).
- News articles have their own address (`#news/<id>`). The article view has Share via Email (a `mailto:` draft) and Copy link (js/features.js, "Share an article").
- Language: the gear (top right) switches between English and Svenska. The Swedish texts are in
  `js/lang-sv.js` (English text -> Swedish); `js/app.js` ("Language") swaps every text on the page,
  including text added later by the scripts. Texts with changing parts (dates, "5 min ago") are
  handled by `LANG_PATTERNS` in `js/app.js`. Anything missing from the list simply stays in English.
- Brand colours: `--gold`, `--bg`, `--panel`… in `base.css` (dark) and `light.css` (light).
- See the tour again: run `qpTour.reset()` in the browser console and reload.
- Add a tool or document: add an entry to `DOCS` in `js/features.js`.
- Add a Knowledge Hub document: add an entry to `LIBRARY` in `js/knowledge.js`. A new `category` becomes a new
  filter chip on its own. Give it `doc: "<id>"` to reuse the body of a `DOCS` entry, or `body:` to write its own.
- Checklist: `TASKS` in `js/features.js`. Activity feed: `FEED_SEED` / `FEED_POOL`.
- Chat answers are simulated: `KB` and `TOPICS` in `js/chat.js`.
- Robot: `POSES`, `EYES`, `QUOTES`, `IDLE_AFTER` in `js/mascot3d.js`.
- Admin Panel: only shown for the HR and Manager roles. Switch role under Settings (`ADMIN_ROLES` in
  `js/app.js`). News categories: `NEWS_CATS` in `js/features.js`.
- Dashboard boxes: the `data-dash` sections in `index.html`, in one two-column grid (`.widgets`). The one with
  `data-dash-wide` (Quick access) fills a whole row. Default order: `DASH_DEFAULT` in `js/features.js`.
- Quick access: Favorites are drawn by `js/features.js` ("Quick access"). The six default cards are `FAV_CARDS`
  (title, subtitle, icon); users add more with Edit → Add favorite or the ☆ in a document. Recent fills itself
  from what is opened (documents, and pages opened from a card or the search).
- Saved in the browser (localStorage): `qp-theme`, `qp-favorites`, `qp-lang`, `qp-chats` (QualiChat's previous chats: the questions only), `qp-recent`,
  `qp-onboarding`, `qp-quicklinks`, `qp-role`, `qp-news`, `qp-events`, `qp-dashboard-order-v2`,
  `qp-nav-collapsed`, `qp-kb-filter`, `qp-news-v2` (all news, newest first; uploaded cover images are
  stored in it, so the browser's ~5 MB limit applies).
