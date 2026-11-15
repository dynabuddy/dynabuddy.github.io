// Paints the impressionist layer behind the page and runs the GSAP motion.
// Strokes follow a flow field, drift on their own timers, drift again as you scroll, and shy away from the cursor.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("paint");
  if (typeof gsap === "undefined") return;
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const palette = [
    [143, 168, 196], // dusty blue
    [157, 179, 154], // sage
    [185, 163, 201], // lilac
    [232, 169, 138], // peach
    [217, 184, 106], // ochre
    [201, 139, 139], // rose
    [127, 159, 163], // pond teal
  ];
  const margin = 160;
  const stirRadius = 170;
  let dabs = [];
  let paintScope = null;
  let width = 0;
  let height = 0;
  let ctx = null;
  const pointer = { x: -9999, y: -9999, seen: false };

  const seeded = (seed) => {
    let s = seed >>> 0;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  };
  const flow = (x, y) => Math.sin(x * 0.0045 + y * 0.0031) * 1.1 + Math.cos(y * 0.0058 - x * 0.0021) * 0.9;

  function buildDabs() {
    const rand = seeded(20261113);
    const small = width < 700;
    const count = Math.max(70, Math.min(small ? 110 : 240, Math.round((width * height) / (small ? 9000 : 7000))));
    const list = [];
    for (let i = 0; i < count; i++) {
      const wash = rand() < 0.24;
      const x = rand() * width;
      const y = rand() * (height + margin * 2) - margin;
      list.push({
        x,
        y,
        angle: flow(x, y) + (rand() - 0.5) * 0.5,
        length: wash ? 150 + rand() * 120 : 26 + rand() * 44,
        thickness: wash ? 40 + rand() * 34 : 13 + rand() * 12,
        alpha: wash ? 0.08 + rand() * 0.06 : 0.15 + rand() * 0.12,
        color: palette[Math.floor(rand() * palette.length)],
        depth: 0.5 + rand() * 1.1,
        sway: 6 + rand() * 16,
        curve: (rand() - 0.5) * 18,
        p: 0.5,
      });
    }
    return list;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const scroll = reduce ? 0 : window.scrollY * 0.11;
    const span = height + margin * 2;
    ctx.lineCap = "round";
    for (const d of dabs) {
      const sway = (d.p - 0.5) * 2 * d.sway;
      let x = d.x + Math.cos(d.angle + 1.57) * sway;
      let y = d.y + Math.sin(d.angle + 1.57) * sway - scroll * d.depth;
      y = ((((y + margin) % span) + span) % span) - margin;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < stirRadius && dist > 0.001) {
        const push = Math.pow(1 - dist / stirRadius, 2) * 30;
        x += (dx / dist) * push;
        y += (dy / dist) * push;
      }
      const half = d.length / 2;
      const cx = Math.cos(d.angle) * half;
      const cy = Math.sin(d.angle) * half;
      const nx = -Math.sin(d.angle) * d.curve;
      const ny = Math.cos(d.angle) * d.curve;
      const [r, g, b] = d.color;
      ctx.strokeStyle = `rgba(${r},${g},${b},${(d.alpha * (0.78 + 0.44 * d.p)).toFixed(3)})`;
      ctx.lineWidth = d.thickness;
      ctx.beginPath();
      ctx.moveTo(x - cx, y - cy);
      ctx.quadraticCurveTo(x + nx, y + ny, x + cx, y + cy);
      ctx.stroke();
    }
  }

  let lastFrame = 0;
  const tick = () => {
    const now = performance.now();
    if (now - lastFrame < 32) return;
    lastFrame = now;
    draw();
  };

  function build() {
    if (!canvas) return;
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1 : 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (paintScope) paintScope.revert();
    dabs = buildDabs();
    if (reduce) {
      draw();
      return;
    }
    paintScope = gsap.context(() => {
      for (const d of dabs) {
        gsap.to(d, { p: 1, duration: gsap.utils.random(6, 14), ease: "sine.inOut", repeat: -1, yoyo: true }).progress(Math.random());
      }
    });
  }

  function startPainting() {
    if (!canvas) return;
    width = window.innerWidth;
    height = window.innerHeight;
    build();
    if (reduce) {
      let lastWidth = width;
      window.addEventListener("resize", () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        build();
      });
      return;
    }
    gsap.ticker.add(tick);

    const moveX = gsap.quickTo(pointer, "x", { duration: 0.6, ease: "power3" });
    const moveY = gsap.quickTo(pointer, "y", { duration: 0.6, ease: "power3" });
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      if (!pointer.seen) {
        pointer.seen = true;
        gsap.set(pointer, { x: e.clientX, y: e.clientY });
      }
      moveX(e.clientX);
      moveY(e.clientY);
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => {
      pointer.seen = false;
      pointer.x = pointer.y = -9999;
    });

    let resizeTimer;
    let lastWidth = width;
    let lastHeight = height;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Phone address bars change the height while you scroll; only a real size change repaints.
        if (window.innerWidth === lastWidth && Math.abs(window.innerHeight - lastHeight) < 140) return;
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;
        build();
      }, 220);
    });
  }

  function reveal(el, index) {
    const heading = /^H[23]$/.test(el.tagName) || el.classList.contains("section-lede");
    gsap.fromTo(
      el,
      heading
        ? { y: 22, opacity: 0 }
        : { y: 36, opacity: 0, rotation: gsap.utils.random(-1.8, 1.8), scale: 0.97 },
      {
        y: 0,
        opacity: 1,
        rotation: 0,
        scale: 1,
        duration: heading ? 0.8 : 0.95,
        delay: (index % 4) * 0.07,
        ease: heading ? "power3.out" : "back.out(1.5)",
        clearProps: "transform,opacity",
        scrollTrigger: window.ScrollTrigger ? { trigger: el, start: "top 90%", once: true } : undefined,
      }
    );
  }

  function startMotion() {
    const heroParts = gsap.utils.toArray(".hero > *");
    if (heroParts.length) {
      gsap.from(heroParts, { y: 26, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.1, delay: 0.15, clearProps: "transform,opacity" });
    }
    const groups = [".tool-list li", ".look-grid li", ".install-card", "main h2", ".section-lede", ".doc-block"];
    for (const selector of groups) gsap.utils.toArray(selector).forEach((el, i) => reveal(el, i));

    const changelog = document.getElementById("changelog");
    if (changelog) {
      new MutationObserver((records) => {
        let index = 0;
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType === 1 && node.classList.contains("release")) reveal(node, index++);
          }
        }
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      }).observe(changelog, { childList: true });
    }
  }

  const start = () => {
    startPainting();
    if (!reduce) startMotion();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
