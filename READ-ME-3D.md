# 3D mascot update

Copy these files into your `qp-dashboard` folder, keeping the folder structure
(replace the existing files when asked).

```
index.html                         changed: <model-viewer> in the chat card + flying robot, 2 new script tags
css/mascot.css                     changed: "3D mascot" section added at the end
js/mascot3d.js                     NEW: poses, eyes, quotes and all robot behaviour
js/vendor/model-viewer-umd.min.js  NEW: <model-viewer> 4.0.0, local copy (no internet needed)
js/robot.js                        changed: click = wave / jump instead of starting the tour
js/chat.js                         changed: tells the robot when a question is sent / answered
js/tour.js                         changed: last tour step text
assets/qp.glb                      your model (already in your folder; included for completeness)
```

## Important: open it through a web server

Browsers refuse to load a `.glb` when `index.html` is opened by double-click
(`file://`). Then the page still works and shows the 2D robot instead.
To see the 3D robot, serve the folder, for example:

    cd qp-dashboard && python3 -m http.server 5178

and open http://localhost:5178

## Where to change things (all in js/mascot3d.js)

- `POSES`   body poses, angles in degrees per joint
- `EYES`    eye shapes (happy, thinking, curious, calm …)
- `QUOTES`  what QBot says when clicked
- `IDLE_AFTER` (30 s) and `TYPING_HOLD` near "Director"
- Camera: the `camera-orbit` / `field-of-view` attributes in index.html
  (keep `CAMERA` in mascot3d.js the same as `camera-orbit`)
- Size per screen: `.mascot-anchor` width/height in css/base.css and css/mascot.css
