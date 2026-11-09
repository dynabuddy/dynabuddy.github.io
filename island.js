// The buddy at the top of the page: a small canvas version of DynaBuddy's bot face. Second-order springs (the app's
// feel: eyes lead, the head follows), blinks, glances around the island, the eyes following your cursor, and pokes.
(() => {
  const island = document.getElementById("island");
  const canvas = document.getElementById("face");
  const speech = document.getElementById("speech");
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EYE = [107, 237, 255];

  // t3ssel8r's second-order dynamics, one per value.
  class Spring {
    constructor(x, f, z, r) { this.y = x; this.yd = 0; this.xp = x; this.set(f, z, r); }
    set(f, z, r) {
      this.k1 = z / (Math.PI * f);
      this.k2 = 1 / ((2 * Math.PI * f) ** 2);
      this.k3 = (r * z) / (2 * Math.PI * f);
    }
    step(x, t) {
      const xd = (x - this.xp) / t;
      this.xp = x;
      const k2 = Math.max(this.k2, t * t / 2 + t * this.k1 / 2, t * this.k1);
      this.y += t * this.yd;
      this.yd += t * (x + this.k3 * xd - this.y - this.k1 * this.yd) / k2;
      return this.y;
    }
  }

  const s = {
    faceX: new Spring(0, 1.25, 0.82, 0), faceY: new Spring(0, 1.25, 0.82, 0),
    lookX: new Spring(0, 2.6, 0.78, 0.15), lookY: new Spring(0, 2.6, 0.78, 0.15),
    w: new Spring(1, 1.35, 0.66, 0), h: new Spring(1, 1.35, 0.66, 0),
    lid: new Spring(0, 1.9, 0.9, 0), slant: new Spring(0, 1.9, 0.9, 0), cheek: new Spring(0, 1.9, 0.9, 0),
    red: new Spring(0, 2, 1, 0), scale: new Spring(0.95, 2.8, 0.68, 0), cy: new Spring(20, 3.2, 0.7, 0),
  };

  const poses = {
    idle: { w: 1, h: 1, lid: 0, slant: 0, cheek: 0, red: 0 },
    happy: { w: 1, h: 1, lid: 0, slant: 0, cheek: 0.46, red: 0 },
    surprised: { w: 1.18, h: 1.32, lid: 0, slant: 0, cheek: 0, red: 0 },
    annoyed: { w: 1, h: 0.86, lid: 0.46, slant: 0.35, cheek: 0, red: 0.3 },
    angry: { w: 1.06, h: 0.95, lid: 0.4, slant: 0.85, cheek: 0, red: 0.9 },
    smug: { w: 1, h: 1, lid: 0.5, slant: -0.15, cheek: 0.22, red: 0 },
    sleepy: { w: 1, h: 0.92, lid: 0.58, slant: 0, cheek: 0, red: 0 },
  };
  let mood = "sleepy", moodUntil = 0;
  const play = (name, seconds) => { mood = name; moodUntil = now() + seconds; };

  let cursor = { x: -1e4, y: -1e4, moved: -100 };
  let wander = { x: 0, y: 0.4 }, nextGlance = 1, nextBlink = 1.4, blinkStart = -10, pokes = [], open = false;
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;

  addEventListener("pointermove", (e) => { cursor = { x: e.clientX, y: e.clientY, moved: now() }; });

  const say = (text, seconds = 2.4) => {
    speech.textContent = text;
    speech.classList.add("show");
    clearTimeout(say.timer);
    say.timer = setTimeout(() => speech.classList.remove("show"), seconds * 1000);
  };

  // Wakes up like the app: asleep, a sleepy look, surprised, then happy with a greeting.
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning!" : hour < 18 && hour >= 12 ? "Good afternoon!" : hour < 23 && hour >= 18 ? "Good evening!" : "Up late, huh?";
  setTimeout(() => play("surprised", 0.5), 900);
  setTimeout(() => { play("happy", 1.8); say(greeting, 2.6); }, 1400);
  moodUntil = 1;

  island.addEventListener("click", (e) => {
    if (e.target.closest("a")) { setOpen(false); return; }
    const t = now();
    pokes = pokes.filter((p) => t - p < 2.2).concat(t);
    const n = pokes.length;
    s.w.yd -= 2; s.h.yd += 3; blinkStart = t;
    if (n >= 8) { pokes = []; play("smug", 2.4); say("Lucky this page can't throw your cursor.", 3); setOpen(false); return; }
    if (n >= 6) { play("angry", 1.6); setOpen(false); return; }
    if (n >= 4) { play("annoyed", 1.4); setOpen(false); return; }
    if (n === 3) { play("surprised", 0.8); return; }
    setOpen(!open);
    if (open) play("happy", 1.2);
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  document.addEventListener("click", (e) => { if (open && !island.contains(e.target)) setOpen(false); });
  function setOpen(v) { open = v; island.setAttribute("aria-expanded", String(v)); }

  let last = now();
  function frame() {
    const t = now();
    const dt = Math.min(Math.max(t - last, 1 / 240), 1 / 30);
    last = t;
    if (t > moodUntil && mood !== "idle") mood = "idle";
    const pose = poses[mood];
    const rect = island.getBoundingClientRect();
    const halfW = rect.width / 2;
    const expanded = open;

    // Where it looks: at the cursor while it moves nearby, otherwise around the island on its own.
    const cx = rect.left + halfW, cy = rect.top + s.cy.y;
    const dx = cursor.x - cx, dy = cursor.y - cy;
    const near = Math.hypot(dx, dy) < 700;
    const resting = t - cursor.moved;
    const follow = near && resting < 3.2 && !reduce ? 1 : 0;
    if (t > nextGlance) {
      const r = Math.random();
      wander = r < 0.3 ? { x: Math.random() < 0.5 ? -1 : 1, y: Math.random() * 0.8 - 0.3 } : { x: Math.random() * 1.7 - 0.85, y: Math.random() * 1.4 - 0.7 };
      nextGlance = t + 1.3 + Math.random() * 2.6;
    }
    const gx = follow ? dx / (Math.abs(dx) + 260) : reduce ? 0 : wander.x;
    const gy = follow ? dy / (Math.abs(dy) + 160) : reduce ? 0.2 : wander.y;

    const scale = s.scale.step(expanded ? 1.45 : rect.height > 42 ? 1.05 : 0.95, dt);
    const roomX = Math.max(0, halfW - 31 * scale - 22);
    s.faceX.step(gx * roomX * (expanded ? 0.5 : 1), dt);
    s.faceY.step(expanded ? 0 : gy * 3, dt);
    s.lookX.step(gx * 0.3, dt);
    s.lookY.step(gy * 0.26, dt);
    s.cy.step(expanded ? 36 : rect.height / 2, dt);
    for (const k of ["w", "h", "lid", "slant", "cheek", "red"]) s[k].step(pose[k], dt);

    if (t > nextBlink && mood !== "sleepy") {
      blinkStart = t;
      nextBlink = t + 2.2 + Math.random() * 3.6;
    }
    const e = t - blinkStart;
    const blink = e < 0 || e > 0.24 ? 0 : e < 0.06 ? e / 0.06 : e < 0.09 ? 1 : 1 - (e - 0.09) / 0.15;

    draw(scale, blink, mood === "angry" ? Math.sin(t * 47) * 1.4 : 0);
    requestAnimationFrame(frame);
  }

  function draw(k, blink, shake) {
    const dpr = devicePixelRatio || 1;
    if (canvas.width !== 300 * dpr) { canvas.width = 300 * dpr; canvas.height = 80 * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 300, 80);
    const red = Math.max(0, Math.min(1, s.red.y));
    const col = EYE.map((c, i) => Math.round(c + ([255, 80, 70][i] - c) * red * 0.8));
    const color = `rgb(${col.join(",")})`;
    const base = { w: 14 * k, h: 17 * k };
    const spacing = 31 * k;
    for (const side of [-1, 1]) {
      const cx = 150 + s.faceX.y + side * spacing / 2 + s.lookX.y * base.w + shake;
      const cy = s.cy.y + s.faceY.y + s.lookY.y * base.h;
      const w = base.w * s.w.y, h = base.h * s.h.y;
      const up = Math.min(1, s.lid.y + (1 - s.lid.y) * blink * 0.62);
      const lo = Math.min(1, s.cheek.y + (1 - s.cheek.y) * blink * 0.42);
      ctx.save();
      ctx.translate(cx, cy);
      // Lids: clip away the top (slanted toward the nose when cross) and a curved cheek from below.
      ctx.beginPath();
      ctx.rect(-w * 2, -h * 2, w * 4, h * 4);
      const inner = side === -1 ? 1 : -1;
      const slant = s.slant.y * h * 0.38 * Math.min(1, up * 4);
      const lidY = (x) => -h / 2 + up * h + slant * inner * (x / (w / 2));
      if (up > 0.001) {
        ctx.moveTo(-w * 2, -h * 2); ctx.lineTo(w * 2, -h * 2); ctx.lineTo(w * 2, lidY(w * 2)); ctx.lineTo(-w * 2, lidY(-w * 2)); ctx.closePath();
      }
      if (lo > 0.001) {
        const lw = w * 1.8, lh = h * 1.4, top = h / 2 - lo * h * 1.05;
        ctx.ellipse(0, top + lh / 2, lw / 2, lh / 2, 0, 0, Math.PI * 2);
      }
      ctx.clip("evenodd");
      const r = Math.min(w, h) / 2 * 0.62;
      ctx.shadowColor = color;
      ctx.shadowBlur = 9 * k;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, r);
      ctx.fill();
      ctx.restore();
    }
  }

  requestAnimationFrame(frame);
})();
