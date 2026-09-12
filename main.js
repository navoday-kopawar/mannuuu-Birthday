/**
 * Mannuu's Cosmic Birthday Universe — main.js
 *
 * 360° Interactive Birthday Memory Gallery:
 *  - 49 Local Photos × 3 = 147 distributed across the full 360° 3D sphere
 *  - Native image aspect ratio preservation (no distortion or cropping)
 *  - Animated multi-colour running / chasing border + colourful glow halo
 *  - Smooth floating micro-animation
 *  - Smooth in-space zoom (click/tap photo to fly up close)
 *  - True pinch-to-zoom (pinch-out = zoom in, pinch-in = zoom out)
 *  - Firecracker / fireworks celebration with real audio SFX
 *  - BGM plays automatically from first screen interaction
 */

/* ═══════════════════════════════════════════════════════
   PHOTO MANIFEST — ALL IMAGES FROM ./assets/
   ═══════════════════════════════════════════════════════ */
/* ── 49 real photos (photo-01 … photo-49), each appearing ONLY ONCE ── */
const BASE_PHOTOS = (() => {
  const arr = [];
  for (let i = 1; i <= 49; i++) {
    arr.push(`./assets/photo-${String(i).padStart(2,'0')}.jpg`);
  }
  return arr;
})();
const PHOTO_FILES = [...BASE_PHOTOS]; // 49 entries total — exactly one instance per photo!

/* Rich neon & pastel border glow colours */
const BORDER_COLOURS = [
  'rgba(255, 77, 136, 0.95)',  // rose neon
  'rgba(181, 111, 255, 0.95)', // electric purple
  'rgba(76, 201, 240, 0.95)',  // cyber cyan
  'rgba(255, 209, 102, 0.95)', // starlight gold
  'rgba(255, 159, 67, 0.95)',  // sunset orange
  'rgba(72, 149, 239, 0.95)',  // cosmic blue
  'rgba(247, 0, 255, 0.95)',   // magenta ray
  'rgba(114, 239, 221, 0.95)', // aquamarine
  'rgba(255, 110, 199, 0.95)', // flaming pink
  'rgba(163, 102, 255, 0.95)', // lavender glow
];

/* ═══════════════════════════════════════════════════════
   Canvas roundRect polyfill — for browsers without native support
   (Samsung Internet < 19, Safari < 15.4, older WebViews)
   ═══════════════════════════════════════════════════════ */
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    typeof CanvasRenderingContext2D.prototype.roundRect !== 'function') {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
    if (r <= 0) { this.rect(x, y, w, h); return; }
    this.moveTo(x + r, y);
    this.arcTo(x + w, y,     x + w, y + h, r);
    this.arcTo(x + w, y + h, x,     y + h, r);
    this.arcTo(x,     y + h, x,     y,     r);
    this.arcTo(x,     y,     x + w, y,     r);
    this.closePath();
  };
}

/* ═══════════════════════════════════════════════════════
   PRIMARY AUDIO ENGINE & SFX
   ═══════════════════════════════════════════════════════ */
const Audio = (() => {
  const BGM_SRC        = './assets/Happy_Birthday_Instrumental.mp3';
  const FIREWORKS_SRC  = './assets/dragon-studio-fireworks-02-419019.mp3';
  const CRACKER_SRC    = './assets/alex_jauk-firecracker-sparkling-202928.mp3';

  let ctx = null, sfxGain = null;
  let bgAudio = null;
  let fxAudioPool = []; // pool of preloaded sfx Audio objects
  let isEnabled = true;
  let isPlaying = false;
  let lastStar = 0;
  let unlockBound = false;

  /* Pre-create HTML Audio elements for firework SFX so they fire instantly */
  function preloadSfx(src, count) {
    const pool = [];
    for (let i = 0; i < count; i++) {
      try {
        const a = new window.Audio(src);
        a.preload = 'auto';
        a.volume = 0.75;
        pool.push(a);
      } catch(_) {}
    }
    return pool;
  }

  /* Preload both SFX files: 3 instances each for quick repeated firing */
  const fireworksPool = preloadSfx(FIREWORKS_SRC, 3);
  const crackerPool   = preloadSfx(CRACKER_SRC, 4);

  function playSfxFrom(pool) {
    /* Find a pool member that is not playing, or reset the first one */
    let target = pool.find(a => a.paused || a.ended);
    if (!target) {
      target = pool[0];
      try { target.pause(); target.currentTime = 0; } catch(_) {}
    }
    if (target) {
      target.currentTime = 0;
      target.play().catch(() => {});
    }
  }

  function initBgAudio() {
    if (bgAudio) return;
    try {
      bgAudio = new window.Audio(BGM_SRC);
      bgAudio.loop = true;
      bgAudio.volume = 0.55;
      bgAudio.preload = 'auto';

      bgAudio.addEventListener('play',   () => { isPlaying = true;  updateUi(true);  });
      bgAudio.addEventListener('pause',  () => { isPlaying = false; updateUi(false); });
      bgAudio.addEventListener('ended',  () => {
        if (bgAudio.loop && isEnabled) bgAudio.play().catch(() => {});
      });
    } catch (_) {}
  }

  function bootCtx() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC();
        sfxGain = ctx.createGain();
        sfxGain.gain.value = 0.35;
        sfxGain.connect(ctx.destination);
      }
    } catch (_) {}
  }

  function resumeCtx() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function updateUi(on) {
    const btn    = document.getElementById('audio-btn');
    const iconOn = document.getElementById('audio-icon-on');
    const iconOff= document.getElementById('audio-icon-off');
    if (btn)     btn.classList.toggle('on', on);
    if (iconOn)  iconOn.classList.toggle('hidden', !on);
    if (iconOff) iconOff.classList.toggle('hidden', on);
  }

  function setupAutoplayUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    const unlock = () => {
      if (isEnabled && (!bgAudio || bgAudio.paused)) Audio.play();
      ['pointerdown','click','touchstart','keydown'].forEach(ev =>
        window.removeEventListener(ev, unlock));
    };
    ['pointerdown','click','touchstart','keydown'].forEach(ev =>
      window.addEventListener(ev, unlock, { once: true, passive: true }));
  }

  return {
    get isOn() { return isPlaying || isEnabled; },

    play() {
      isEnabled = true;
      initBgAudio();
      bootCtx(); resumeCtx();
      if (bgAudio) {
        bgAudio.play().then(() => {
          isPlaying = true; updateUi(true);
        }).catch(() => {
          setupAutoplayUnlock(); updateUi(true);
        });
      }
      return true;
    },

    pause() {
      isEnabled = false;
      if (bgAudio) { bgAudio.pause(); isPlaying = false; updateUi(false); }
      return false;
    },

    toggle() {
      initBgAudio(); bootCtx(); resumeCtx();
      return (isPlaying || (bgAudio && !bgAudio.paused)) ? this.pause() : this.play();
    },

    /* Candle blow — soft white-noise breath */
    blow() {
      bootCtx(); resumeCtx();
      if (!ctx || !sfxGain) return;
      try {
        const sz  = ctx.sampleRate * 0.75;
        const buf = ctx.createBuffer(1, sz, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
        const src  = ctx.createBufferSource(); src.buffer = buf;
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700;
        filt.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.7);
        const g = ctx.createGain(); g.gain.value = 0.28;
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
        src.connect(filt); filt.connect(g); g.connect(sfxGain);
        src.start(); src.stop(ctx.currentTime + 0.75);
      } catch (_) {}
    },

    /* ── FIRECRACKER celebration — plays real audio SFX ── */
    firecracker() {
      /* Play fireworks boom first, stagger cracker snaps */
      playSfxFrom(fireworksPool);
      setTimeout(() => playSfxFrom(crackerPool),    350);
      setTimeout(() => playSfxFrom(crackerPool),    850);
      setTimeout(() => playSfxFrom(fireworksPool), 1100);
      setTimeout(() => playSfxFrom(crackerPool),   1600);
    },

    /* Celebration fanfare (synth tones as fallback/overlay) */
    fanfare() {
      bootCtx(); resumeCtx();
      if (!ctx || !sfxGain) return;
      try {
        [[523.25,0],[659.25,.12],[783.99,.24],[1046.50,.42]].forEach(([f,t]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = f;
          g.gain.setValueAtTime(0.14, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.65);
          o.connect(g); g.connect(sfxGain);
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.7);
        });
      } catch (_) {}
    },

    /* Shooting-star shimmer — subtle, rate-limited */
    starChime() {
      if (!isPlaying) return;
      const now = Date.now();
      if (now - lastStar < 2800) return;
      lastStar = now;
      bootCtx(); resumeCtx();
      if (!ctx || !sfxGain) return;
      try {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(2000 + Math.random() * 800, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.85);
        g.gain.setValueAtTime(0.07, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
        o.connect(g); g.connect(sfxGain);
        o.start(); o.stop(ctx.currentTime + 0.95);
      } catch (_) {}
    },

    /* Quick soft chime for zoom focus */
    zoomPing() {
      bootCtx(); resumeCtx();
      if (!ctx || !sfxGain) return;
      try {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        o.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.3);
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
        o.connect(g); g.connect(sfxGain);
        o.start(); o.stop(ctx.currentTime + 0.4);
      } catch (_) {}
    },
  };
})();

/* ═══════════════════════════════════════════════════════
   FX CANVAS — enhanced fireworks / confetti / cracker sparks
   ═══════════════════════════════════════════════════════ */
const FX = (() => {
  const canvas = document.getElementById('fx-canvas');
  const ctx2   = canvas.getContext('2d');
  let W = 0, H = 0;
  const particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* Standard radial burst (firework shell explosion) */
  function burst(x, y, count = 90, speedMult = 1) {
    const cols = ['#ffd166','#ff4d88','#b56fff','#4cc9f0','#ffffff','#ff9f43','#ff3860','#f7d794'];
    for (let i = 0; i < count; i++) {
      const a  = (i / count) * Math.PI * 2 + (Math.random() - .5) * .4;
      const sp = (2.5 + Math.random() * 9) * speedMult;
      particles.push({
        x, y,
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        color: cols[Math.random()*cols.length|0],
        r: 1.8 + Math.random()*2.8, alpha: 1,
        decay: .011 + Math.random()*.016, gravity: .055,
        trail: Math.random() > 0.5,
      });
    }
  }

  /* Firecracker spark shower — tight bright sparks shooting upward */
  function crackerBurst(x, y) {
    const cols = ['#fff','#ffd700','#ff4500','#ffA500','#ff69b4','#00ffff'];
    const count = 55;
    for (let i = 0; i < count; i++) {
      /* Bias angle upward (between -150° and -30° from positive-x = mostly upward) */
      const a  = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const sp = 4 + Math.random() * 11;
      particles.push({
        x, y,
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        color: cols[Math.random()*cols.length|0],
        r: 1.2 + Math.random()*2.0, alpha: 1,
        decay: .016 + Math.random()*.022, gravity: .08,
        isSpark: true,
      });
    }
  }

  /* Full-screen confetti rain */
  function confetti() {
    const cols = ['#ffd166','#ff4d88','#b56fff','#4cc9f0','#ffffff','#ff9f43'];
    for (let i = 0; i < 130; i++) {
      particles.push({
        x: Math.random()*W, y: -20 - Math.random()*120,
        vx: (Math.random()-.5)*4, vy: 2.5 + Math.random()*4.5,
        color: cols[Math.random()*cols.length|0],
        r: 4 + Math.random()*5, alpha: 1,
        decay: .004, gravity: .022,
        isRect: true, rot: Math.random()*360, rs: (Math.random()-.5)*9,
      });
    }
  }

  /* ── Firecracker celebration sequence:
     Multiple bursts + cracker sparks in quick succession ── */
  function firecrackerShow() {
    const cx = W / 2, cy = H / 2;

    /* Wave 1 — immediate double-burst at screen centre */
    burst(cx * 0.5,  cy * 0.4, 100, 1.2);
    burst(cx * 1.5,  cy * 0.4, 100, 1.2);

    /* Wave 2 — cracker sparks from lower positions */
    setTimeout(() => {
      crackerBurst(W * 0.25, H * 0.7);
      crackerBurst(W * 0.75, H * 0.7);
    }, 300);

    /* Wave 3 — big central burst */
    setTimeout(() => {
      burst(cx, cy * 0.35, 120, 1.4);
      crackerBurst(W * 0.5, H * 0.65);
    }, 650);

    /* Wave 4 — side bursts */
    setTimeout(() => {
      burst(W * 0.15, cy * 0.5, 80, 1.0);
      burst(W * 0.85, cy * 0.5, 80, 1.0);
    }, 1000);

    /* Wave 5 — final confetti rain */
    setTimeout(() => {
      confetti();
      burst(cx, cy * 0.3, 90, 1.1);
    }, 1350);

    /* Trailing extra bursts */
    setTimeout(() => { burst(W * 0.3, H * 0.25, 70, 0.9); }, 1700);
    setTimeout(() => { burst(W * 0.7, H * 0.25, 70, 0.9); }, 2000);
    setTimeout(() => {
      burst(cx, cy * 0.2, 100, 1.3);
      confetti();
    }, 2300);
  }

  (function loop() {
    requestAnimationFrame(loop);
    ctx2.clearRect(0, 0, W, H);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.alpha -= p.decay;
      if (p.alpha <= 0 || p.y > H + 40) { particles.splice(i, 1); continue; }

      ctx2.save();
      ctx2.globalAlpha = p.alpha;
      ctx2.fillStyle   = p.color;

      if (p.isRect) {
        p.rot += p.rs;
        ctx2.translate(p.x, p.y);
        ctx2.rotate(p.rot * Math.PI / 180);
        ctx2.fillRect(-p.r/2, -p.r/2, p.r, p.r*1.5);
      } else if (p.isSpark) {
        /* Draw a bright elongated spark line */
        ctx2.strokeStyle = p.color;
        ctx2.lineWidth   = p.r * 0.8;
        ctx2.lineCap = 'round';
        ctx2.shadowColor = p.color;
        ctx2.shadowBlur  = 6;
        ctx2.beginPath();
        ctx2.moveTo(p.x, p.y);
        ctx2.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
        ctx2.stroke();
      } else {
        /* Circular particle with optional glow */
        if (p.trail) {
          ctx2.shadowColor = p.color;
          ctx2.shadowBlur  = 8;
        }
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx2.fill();
      }
      ctx2.restore();
    }
  })();

  return { burst, crackerBurst, confetti, firecrackerShow };
})();

/* ═══════════════════════════════════════════════════════
   3-D UNIVERSE CANVAS ENGINE (360° Memory Galaxy)
   ═══════════════════════════════════════════════════════ */
const Universe = (() => {

  const canvas = document.getElementById('universe-canvas');
  const ctx    = canvas.getContext('2d', { alpha: false });

  /* ── Mobile detection ── */
  const isMobileDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);

  let W, H, DPR, FOCAL;
  let time = 0;
  const cam    = { x:0, y:0, z:0, yaw:0, pitch:0 };
  const target = { x:0, y:0, z:0, yaw:0, pitch:0 };

  let stars    = [];
  let photos   = [];
  let shooters = [];

  /* Warp state */
  let warping = false, warpProg = 0;

  /* Zoom / focus state */
  let focusedPhoto = null;

  /* ── Universe camera optical zoom & distance limits ─ */
  let camZoom    = 1.0;
  let targetZoom = 1.0;
  const ZOOM_MIN = 0.55;
  const ZOOM_MAX = 2.40;

  /* ── Resize ──────────────────────────────────────────── */
  function resize() {
    DPR   = Math.min(window.devicePixelRatio || 1, 2);
    W     = window.innerWidth;
    H     = window.innerHeight;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    FOCAL = isMobileDevice ? Math.min(W, H) * 1.4 : Math.min(W, H) * 1.1;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Stars — INFINITE TOROIDAL FIELD (Spacious Universe) ── */
  const STAR_RANGE  = 3800;
  const STAR_RANGE2 = STAR_RANGE * 2;

  const STAR_COLS = [
    '#ffffff','#ffffff','#ffffff','#ffffff','#ffffff',
    '#f0f4ff','#e8ecff','#fffbe6',
    '#b56fff','#4cc9f0','#ffd166','#ff758f','#a8edff',
  ];

  function buildStars() {
    stars = [];
    const layers = [
      { count: W < 768 ? 900  : 1800, sizeMin:.28, sizeMax:1.2, aMin:.15, aMax:.55 }, // far
      { count: W < 768 ? 350  :  750, sizeMin:.8,  sizeMax:2.0, aMin:.35, aMax:.80 }, // mid
      { count: W < 768 ? 100  :  220, sizeMin:1.6, sizeMax:3.4, aMin:.55, aMax:1.0 }, // near
    ];
    for (const L of layers) {
      for (let i = 0; i < L.count; i++) {
        stars.push({
          x: (Math.random() * 2 - 1) * STAR_RANGE,
          y: (Math.random() * 2 - 1) * STAR_RANGE,
          z: (Math.random() * 2 - 1) * STAR_RANGE,
          size:  L.sizeMin + Math.random() * (L.sizeMax - L.sizeMin),
          color: STAR_COLS[Math.random() * STAR_COLS.length | 0],
          a0:    L.aMin + Math.random() * (L.aMax - L.aMin),
          ps:    .5 + Math.random() * 3,
        });
      }
    }
  }
  buildStars();

  function recycleStars() {
    for (const s of stars) {
      const dx = s.x - cam.x, dy = s.y - cam.y, dz = s.z - cam.z;
      if (dx >  STAR_RANGE) s.x -= STAR_RANGE2;
      if (dx < -STAR_RANGE) s.x += STAR_RANGE2;
      if (dy >  STAR_RANGE) s.y -= STAR_RANGE2;
      if (dy < -STAR_RANGE) s.y += STAR_RANGE2;
      if (dz >  STAR_RANGE) s.z -= STAR_RANGE2;
      if (dz < -STAR_RANGE) s.z += STAR_RANGE2;
    }
  }

  /* ── Photos — Spacious 3D Universe with Stationary Fixed Coordinates ── */
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  function buildPhotos() {
    photos = [];
    const N = PHOTO_FILES.length;

    /* Expansive 3D universe bounds: spread in all directions (front, back, left, right, top, bottom) */
    const isMob = isMobileDevice;
    const rMin = isMob ? 850 : 1100;
    const rMax = isMob ? 2400 : 3400;

    /* 1. Distribute points across 3 deep cosmic zones with Fibonacci spherical spread */
    const pts = [];
    for (let i = 0; i < N; i++) {
      const yUnit = 1 - (2 * i + 1) / N; // vertical spread from -0.98 to +0.98
      const rAtY  = Math.sqrt(Math.max(0.001, 1 - yUnit * yUnit));
      const phi   = i * GOLDEN_ANGLE;
      const ux    = rAtY * Math.cos(phi);
      const uy    = yUnit;
      const uz    = rAtY * Math.sin(phi);

      /* Multi-depth tiers for true cosmic depth */
      const tier = i % 3;
      const tierFraction = tier === 0 ? 0.25 : (tier === 1 ? 0.60 : 1.0);
      const depthJitter = (((i * 37) % 100) / 100) * 0.25;
      const r = rMin + (rMax - rMin) * Math.min(1.0, tierFraction + depthJitter);

      pts.push({
        ux, uy, uz, r,
        x: ux * r,
        y: uy * r * 0.85,
        z: uz * r,
        phi,
      });
    }

    /* 2. Strict pairwise collision avoidance pass:
          Guarantees minimum >= 550px (mobile) / >= 750px (desktop) 3D clearance between ANY two images
          so images never overlap, merge, or collide */
    const min3DDist = isMob ? 550 : 720;
    for (let iter = 0; iter < 15; iter++) {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const p1 = pts[i], p2 = pts[j];
          const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
          const dist = Math.hypot(dx, dy, dz);
          if (dist < min3DDist && dist > 0.001) {
            const shift = (min3DDist - dist) * 0.5 / dist;
            p1.x -= dx * shift; p1.y -= dy * shift; p1.z -= dz * shift;
            p2.x += dx * shift; p2.y += dy * shift; p2.z += dz * shift;
          }
        }
      }
    }

    /* 3. Instantiate exactly 49 stationary photos with fixed universe positions */
    PHOTO_FILES.forEach((rawUrl, i) => {
      const pt = pts[i];
      const baseDim = isMob ? 150 : 185;
      const photoObj = {
        id: i,
        rawUrl,
        url: encodeURI(rawUrl),
        img: null,
        loaded: false,
        loading: false,
        failed: false,
        w: baseDim,
        h: Math.round(baseDim * 1.25),
        aspectRatioLoaded: false,
        sc: 1.0,
        phi: pt.phi,
        /* Fixed natural photo tilt (NO continuous rotation oscillation) */
        rot: ((i * 17) % 21 - 10) * 0.006,
        border: BORDER_COLOURS[i % BORDER_COLOURS.length],
        borderSpeed: 0.16 + ((i * 7) % 10) * 0.015,
        borderDir: i % 2 === 0 ? 1 : -1,
        fadeAlpha: 0,
        /* Fixed, stationary coordinates in the 3D universe */
        x: pt.x,
        y: pt.y,
        z: pt.z,
        bX: pt.x,
        bY: pt.y,
        bZ: pt.z,
      };
      photos.push(photoObj);
    });

    /* Progressive queue loader with concurrency limit */
    const MAX_CONCURRENT = isMobileDevice ? 4 : 6;
    let activeLoads = 0;
    const loadQueue = [...photos].sort((a, b) => Math.hypot(a.x, a.y, a.z) - Math.hypot(b.x, b.y, b.z));

    function pumpQueue() {
      while (activeLoads < MAX_CONCURRENT && loadQueue.length > 0) {
        const p = loadQueue.shift();
        if (p.loaded || p.loading) continue;
        p.loading = true;
        activeLoads++;

        const img = new Image();
        if ('decoding' in img) img.decoding = 'async';

        const applyAspect = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const aspect  = img.naturalWidth / img.naturalHeight;
            const baseDim = isMobileDevice ? 150 : 185;
            if (aspect >= 1) {
              p.w = baseDim;
              p.h = Math.round(baseDim / aspect);
            } else {
              p.h = Math.round(baseDim * 1.22);
              p.w = Math.round(p.h * aspect);
            }
            p.aspectRatioLoaded = true;
          }
        };

        const onComplete = () => {
          p.img = img;
          p.loaded = true;
          p.loading = false;
          applyAspect();
          activeLoads--;
          pumpQueue();
        };

        img.onload = onComplete;
        img.onerror = () => {
          if (img.src !== p.rawUrl) {
            img.onerror = () => { p.failed = true; p.loading = false; activeLoads--; pumpQueue(); };
            img.src = p.rawUrl;
          } else {
            p.failed = true;
            p.loading = false;
            activeLoads--;
            pumpQueue();
          }
        };
        img.src = p.url;
      }
    }
    pumpQueue();
  }
  buildPhotos();

  /* ── 3-D Projection with Near-Clip Smooth Fading ── */
  function project(p) {
    let x = p.x - cam.x, y = p.y - cam.y, z = p.z - cam.z;
    const cy = Math.cos(cam.yaw),   sy = Math.sin(cam.yaw);
    let nx = x*cy - z*sy, nz = x*sy + z*cy;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let ny = y*cp - nz*sp, zz = y*sp + nz*cp;

    if (zz <= 25) return null; // Behind or right on the camera lens
    const sc = FOCAL / zz;
    const nearFade = Math.min(1, Math.max(0, (zz - 25) / 110)); // Gracefully fade when camera passes close
    return { x: W/2 + nx*sc, y: H/2 + ny*sc, sc, depth: zz, nearFade };
  }

  /* ── Shooting-star spawner ── */
  function spawnShooter() {
    const cols    = ['#ffd166','#ffffff','#4cc9f0','#ff9f43','#b56fff','#ff758f'];
    const goRight = Math.random() > .5;
    const speed   = 24 + Math.random() * 22;
    const angle   = (Math.random() * .55 + .18) * Math.PI;
    shooters.push({
      x: cam.x + (goRight ? -1 : 1) * (W*.45 + Math.random()*W*.3),
      y: cam.y - H*.3 - Math.random()*H*.2,
      z: cam.z + 160 + Math.random()*340,
      vx: Math.cos(angle)*speed*(goRight ? 1 : -1),
      vy: Math.sin(angle)*speed,
      vz: (Math.random()-.5)*6,
      color: cols[Math.random()*cols.length|0],
      trailLen: 90 + Math.random()*100,
      life: 1.0, decay: .005 + Math.random()*.007,
      soundPlayed: false,
    });
  }

  let ssTimer = null;
  function startShooters() {
    if (ssTimer) return;
    (function sched() {
      spawnShooter();
      ssTimer = setTimeout(sched, 9000 + Math.random() * 14000);
    })();
  }

  /* ── Warp transition ── */
  function warp() {
    warping = true; warpProg = 0;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / 1400);
      warpProg = Math.sin(p * Math.PI);
      if (p < 1) requestAnimationFrame(step);
      else { warping = false; warpProg = 0; }
    })(t0);
  }

  /* ── In-Space Exploration: Travel Smoothly in Front of a Discovered Photo ── */
  function focusPhoto(p) {
    if (focusedPhoto === p) {
      resetFocus();
      return;
    }
    focusedPhoto = p;

    // Optimal viewing stand-off distance
    const standOff = isMobileDevice ? 280 : 340;
    const distFromOrigin = Math.hypot(p.bX, p.bY, p.bZ) || 1;

    // Smoothly fly camera to comfortable viewing distance directly facing the photo
    target.x = p.bX - (p.bX / distFromOrigin) * standOff;
    target.y = p.bY - (p.bY / distFromOrigin) * standOff;
    target.z = p.bZ - (p.bZ / distFromOrigin) * standOff;

    // Aim gaze directly at the memory from camera position
    const dx = p.bX - target.x, dy = p.bY - target.y, dz = p.bZ - target.z;
    target.yaw   = Math.atan2(dx, dz);
    const horizDist = Math.hypot(dx, dz) || 1;
    target.pitch = Math.max(-1.4, Math.min(1.4, Math.atan2(dy, horizDist)));

    Audio.zoomPing();
  }

  function resetFocus() {
    if (!focusedPhoto) return;
    focusedPhoto = null;
    Audio.zoomPing();
  }

  function zoomCloser() {
    const cy = Math.cos(target.yaw), sy = Math.sin(target.yaw);
    const cp = Math.cos(target.pitch), sp = Math.sin(target.pitch);
    target.x += 160 * sy * cp; target.y += 160 * sp; target.z += 160 * cy * cp;
  }

  function zoomFurther() {
    const cy = Math.cos(target.yaw), sy = Math.sin(target.yaw);
    const cp = Math.cos(target.pitch), sp = Math.sin(target.pitch);
    target.x -= 160 * sy * cp; target.y -= 160 * sp; target.z -= 160 * cy * cp;
  }

  /* ── Main Render Loop — Smooth Physics & Camera Locomotion ── */
  (function loop() {
    requestAnimationFrame(loop);
    time += 0.016;

    const lerpPos = 0.08;
    const lerpRot = 0.085;
    cam.x += (target.x - cam.x) * lerpPos;
    cam.y += (target.y - cam.y) * lerpPos;
    cam.z += (target.z - cam.z) * lerpPos;
    cam.yaw += (target.yaw - cam.yaw) * lerpRot;
    cam.pitch += (target.pitch - cam.pitch) * lerpRot;

    recycleStars();

    /* Deep Cosmic Nebula Background */
    ctx.fillStyle = '#020308';
    ctx.fillRect(0, 0, W, H);
    const ng = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.85);
    ng.addColorStop(0,   'rgba(20, 11, 48, 0.45)');
    ng.addColorStop(0.5, 'rgba(5, 8, 26, 0.35)');
    ng.addColorStop(1,   'rgba(2, 3, 8, 0.98)');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, W, H);

    drawStars();
    drawShooters();
    drawPhotos();
  })();

  function drawStars() {
    const batches    = {};
    const warpStreaks = [];

    for (const s of stars) {
      const pr = project(s);
      if (!pr) continue;
      if (pr.x < -30 || pr.x > W+30 || pr.y < -30 || pr.y > H+30) continue;

      const alpha    = s.a0 * (0.52 + 0.48 * Math.sin(time * s.ps + s.x * 0.001));
      const sz       = Math.min(5, Math.max(0.45, s.size * Math.sqrt(pr.sc) * 1.6));
      const distFade = Math.min(1, 0.3 + 0.7 * Math.min(1, pr.sc * 4));

      if (warping && warpProg > 0.08) {
        warpStreaks.push({ pr, s, sz, alpha: Math.min(1, alpha * distFade) });
      } else {
        const key = s.color;
        if (!batches[key]) batches[key] = [];
        batches[key].push({ pr, sz, alpha: Math.min(1, alpha * distFade) });
      }
    }

    if (warping && warpProg > 0.08) {
      for (const { pr, s, sz, alpha } of warpStreaks) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = s.color;
        ctx.lineWidth   = sz;
        const ext = 0.09 * warpProg;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x + (pr.x - W*0.5)*ext, pr.y + (pr.y - H*0.5)*ext);
        ctx.stroke();
      }
    } else {
      for (const [color, pts] of Object.entries(batches)) {
        ctx.fillStyle = color;
        for (const { pr, sz, alpha } of pts) {
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, sz, 0, 6.2832);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawShooters() {
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.vx; s.y += s.vy; s.z += s.vz; s.life -= s.decay;
      if (s.life <= 0) { shooters.splice(i, 1); continue; }

      const speed = Math.hypot(s.vx, s.vy, s.vz) || 1;
      const p1 = project(s);
      const p2 = project({
        x: s.x - (s.vx/speed)*s.trailLen,
        y: s.y - (s.vy/speed)*s.trailLen,
        z: s.z - (s.vz/speed)*s.trailLen,
      });
      if (!p1 || !p2) continue;

      const onScreen  = p1.x > -80 && p1.x < W+80 && p1.y > -80 && p1.y < H+80;
      if (onScreen && !s.soundPlayed) { s.soundPlayed = true; Audio.starChime(); }

      const lifeFade = Math.min(1, Math.min(s.life * 8, (1 - s.life) * 8 + 0.1));
      const headR    = Math.max(1.5, 3.5 * p1.sc);

      const headGlow = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, headR * 4);
      headGlow.addColorStop(0, `rgba(255,255,255,${lifeFade})`);
      headGlow.addColorStop(0.35, s.color.replace(')', `,${lifeFade * 0.85})`).replace('rgb','rgba'));
      headGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(p1.x, p1.y, headR * 4, 0, 6.2832);
      ctx.fillStyle = headGlow; ctx.fill();

      ctx.beginPath(); ctx.arc(p1.x, p1.y, headR, 0, 6.2832);
      ctx.fillStyle = `rgba(255,255,255,${lifeFade})`; ctx.fill();

      const gr = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      gr.addColorStop(0,    `rgba(255,255,255,${lifeFade * 0.9})`);
      gr.addColorStop(0.25, s.color);
      gr.addColorStop(0.7,  `rgba(181,111,255,${lifeFade * 0.2})`);
      gr.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = gr;
      ctx.lineWidth   = Math.max(0.8, 2.8 * p1.sc);
      ctx.shadowColor = s.color; ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawPhotos() {
    const visible = [];
    photos.forEach(p => {
      /* Each image is 100% stationary at its fixed 3D coordinates — NO continuous drift */
      p.x = p.bX;
      p.y = p.bY;
      p.z = p.bZ;
      const pr = project(p);
      const fr = isMobileDevice ? 500 : 400;
      if (pr && pr.x > -fr && pr.x < W+fr && pr.y > -fr && pr.y < H+fr)
        visible.push({ p, pr });
    });

    visible.sort((a,b) => b.pr.depth - a.pr.depth);

    visible.forEach(({ p, pr }) => {
      const isFoc = p === focusedPhoto;
      const sc    = pr.sc * (isFoc ? 1.18 : 1.0);
      const w     = p.w * sc;
      const h     = p.h * sc;
      const minPx = isMobileDevice ? 2 : 4;
      if (w < minPx || h < minPx) return;

      ctx.save();
      ctx.translate(pr.x, pr.y);
      /* Fixed elegant tilt (NO continuous rotation oscillation) */
      ctx.rotate(isFoc ? 0 : p.rot);
      if (pr.nearFade !== undefined) ctx.globalAlpha = pr.nearFade;

      const pPhi = Number.isFinite(p.phi) ? p.phi : (p.id * GOLDEN_ANGLE);
      const glowBlur = isFoc
        ? (isMobileDevice ? 10 : 16)
        : (isMobileDevice ? 4 : 6) + Math.sin(time * 1.2 + pPhi) * 1.5;
      ctx.shadowColor = p.border;
      ctx.shadowBlur  = glowBlur;

      const radius = Math.min(10, Math.min(w, h) * 0.08);
      ctx.fillStyle = 'rgba(10, 14, 40, 0.94)';
      ctx.beginPath();
      ctx.roundRect(-w/2 - 4, -h/2 - 4, w + 8, h + 8, radius + 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2, w, h, radius);
      ctx.clip();

      if (p.loaded && p.img && p.img.complete && p.img.naturalWidth) {
        p.fadeAlpha = Math.min(1, p.fadeAlpha + 0.1);
        ctx.globalAlpha = p.fadeAlpha;
        ctx.drawImage(p.img, -w/2, -h/2, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#0e1234';
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.fillStyle = 'rgba(255, 209, 102, 0.45)';
        ctx.font = `${Math.max(10, Math.min(18, w * 0.14))}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✦', 0, 0);
      }
      ctx.restore();

      const borderW = isFoc ? (isMobileDevice ? 2.4 : 3.0) : Math.max(1.4, Math.min(2.4, sc * 1.8));
      const speed   = Number.isFinite(p.borderSpeed) ? p.borderSpeed : 0.2;
      const dir     = Number.isFinite(p.borderDir) ? p.borderDir : 1;
      const hueOff  = (time * speed * dir * 60 + pPhi * 57.3) % 360;
      drawRunningBorder(ctx, w, h, hueOff, borderW, isFoc ? 8 : (isMobileDevice ? 3 : 5), radius);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth   = 0.7;
      ctx.beginPath();
      ctx.roundRect(-w/2 + 1.5, -h/2 + 1.5, w - 3, h - 3, Math.max(0, radius - 1.5));
      ctx.stroke();

      ctx.restore();
    });
  }

  function drawRunningBorder(ctx, w, h, hueOff, bw, glow, r) {
    const hw = w / 2, hh = h / 2;
    const perimeter = 2 * (w + h);
    const sides = [
      { x1:-hw, y1:-hh, x2: hw, y2:-hh, len: w, off: 0     },
      { x1: hw, y1:-hh, x2: hw, y2: hh, len: h, off: w     },
      { x1: hw, y1: hh, x2:-hw, y2: hh, len: w, off: w+h   },
      { x1:-hw, y1: hh, x2:-hw, y2:-hh, len: h, off: 2*w+h },
    ];
    const hsl   = (hue, a) => {
      const h = Number.isFinite(hue) ? (((hue % 360) + 360) % 360) : 0;
      return `hsla(${h},100%,65%,${a})`;
    };
    const STOPS = 8;
    ctx.lineWidth = bw;
    ctx.lineCap   = 'round';
    for (const side of sides) {
      const gr = ctx.createLinearGradient(side.x1, side.y1, side.x2, side.y2);
      for (let i = 0; i <= STOPS; i++) {
        const t = i / STOPS;
        gr.addColorStop(t, hsl((side.off + t * side.len) / perimeter * 360 + hueOff, 0.9));
      }
      ctx.strokeStyle = gr;
      ctx.shadowColor = hsl(((side.off + side.len * 0.5) / perimeter) * 360 + hueOff, 0.45);
      ctx.shadowBlur  = glow;
      ctx.beginPath();
      ctx.moveTo(side.x1, side.y1);
      ctx.lineTo(side.x2, side.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  /* ═══════════════════════════════════════════════════════
     POINTER / WHEEL / TOUCH / PINCH CONTROLS
     ═══════════════════════════════════════════════════════ */
  let isDragging   = false, lastPointer = { x:0, y:0 }, pointerMoved = false;
  let isPinching   = false;
  let pinchStartDist = 0, pinchStartTargetZ = 0;
  let pinchLastDist  = 0;
  let touchStartPt   = { x:0, y:0 }, isTouchMoved = false;

  /* ── Desktop Mouse — Drag to Look Around ── */
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
    isDragging = true;
    pointerMoved = false;
    lastPointer = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
  });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !isDragging) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pointerMoved = true;
    const sens = 0.0022;
    target.yaw   -= dx * sens;
    target.pitch -= dy * sens;
    target.pitch  = Math.max(-1.42, Math.min(1.42, target.pitch));
    lastPointer   = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup',     () => { isDragging = false; });
  canvas.addEventListener('pointercancel', () => { isDragging = false; });

  /* ── Mobile Touch — 1-finger Look Around + 2-finger Pinch to Travel Forward/Backward ── */
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isPinching   = false;
      isTouchMoved = false;
      touchStartPt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPointer  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length >= 2) {
      e.preventDefault();
      isPinching   = true;
      isTouchMoved = true;
      isDragging   = false;
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      ) || 1;
      pinchLastDist = pinchStartDist;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault(); /* Prevent page scrolling */
    if (e.touches.length >= 2) {
      /* ─ True 3D Travel:
           pinch-OUT (fingers apart) = Travel FORWARD through space along gaze!
           pinch-IN  (fingers together) = Travel BACKWARD through space! ─ */
      if (focusedPhoto) resetFocus();
      const curDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchLastDist > 0) {
        const delta = curDist - pinchLastDist;
        const cy = Math.cos(target.yaw),   sy = Math.sin(target.yaw);
        const cp = Math.cos(target.pitch), sp = Math.sin(target.pitch);
        const travelStep = delta * 5.2;
        target.x += travelStep * sy * cp;
        target.y += travelStep * sp;
        target.z += travelStep * cy * cp;
      }
      pinchLastDist = curDist;
      isPinching = true;
    } else if (e.touches.length === 1 && !isPinching) {
      const dx = e.touches[0].clientX - lastPointer.x;
      const dy = e.touches[0].clientY - lastPointer.y;
      const totalDist = Math.hypot(
        e.touches[0].clientX - touchStartPt.x,
        e.touches[0].clientY - touchStartPt.y
      );
      if (totalDist > 8) isTouchMoved = true;

      const sens = 0.0028;
      target.yaw   -= dx * sens;
      target.pitch -= dy * sens;
      target.pitch  = Math.max(-1.42, Math.min(1.42, target.pitch));
      lastPointer   = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      if (!isTouchMoved && !isPinching) {
        handleTap(touchStartPt.x, touchStartPt.y);
      }
      isPinching    = false;
      isTouchMoved  = false;
      pinchLastDist = 0;
    } else if (e.touches.length === 1) {
      isPinching    = true;
      lastPointer   = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pinchLastDist = 0;
    }
  }, { passive: false });

  /* ── Desktop Click — Visit Memory ── */
  canvas.addEventListener('click', e => {
    if (isMobileDevice) return;
    if (pointerMoved) { pointerMoved = false; return; }
    handleTap(e.clientX, e.clientY);
  });

  function handleTap(clientX, clientY) {
    let best = null, bestDist = 120;
    photos.forEach(p => {
      const pr = project(p);
      if (!pr) return;
      const size = Math.max(50, Math.max(p.w, p.h) * 0.8 * pr.sc);
      const d    = Math.hypot(clientX - pr.x, clientY - pr.y);
      if (d < Math.max(bestDist, size * 0.75)) { best = p; bestDist = d; }
    });

    if (best) {
      if (best === focusedPhoto) resetFocus();
      else focusPhoto(best);
    } else if (focusedPhoto) {
      resetFocus();
    }
  }

  /* ── Wheel — Travel Forward / Backward through 3D Space ── */
  window.addEventListener('wheel', e => {
    e.preventDefault();
    if (focusedPhoto) resetFocus();
    const cy = Math.cos(target.yaw),   sy = Math.sin(target.yaw);
    const cp = Math.cos(target.pitch), sp = Math.sin(target.pitch);
    const travelStep = -e.deltaY * 2.2;
    target.x += travelStep * sy * cp;
    target.y += travelStep * sp;
    target.z += travelStep * cy * cp;
  }, { passive: false });

  /* ── Keyboard Navigation (WASD / Arrows Travel Through 3D Universe) ── */
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.key === 'Escape' && focusedPhoto) resetFocus();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  setInterval(() => {
    const cy = Math.cos(target.yaw),   sy = Math.sin(target.yaw);
    const cp = Math.cos(target.pitch), sp = Math.sin(target.pitch);
    const speed = 14;

    if (keys['KeyW'] || keys['ArrowUp']) {
      if (focusedPhoto) resetFocus();
      target.x += speed * sy * cp;
      target.y += speed * sp;
      target.z += speed * cy * cp;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
      if (focusedPhoto) resetFocus();
      target.x -= speed * sy * cp;
      target.y -= speed * sp;
      target.z -= speed * cy * cp;
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
      if (focusedPhoto) resetFocus();
      target.x -= speed * cy;
      target.z += speed * sy;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
      if (focusedPhoto) resetFocus();
      target.x += speed * cy;
      target.z -= speed * sy;
    }
    if (keys['KeyE'] || keys['Space']) {
      if (focusedPhoto) resetFocus();
      target.y -= speed * 0.75;
    }
    if (keys['KeyQ'] || keys['ShiftLeft'] || keys['ShiftRight']) {
      if (focusedPhoto) resetFocus();
      target.y += speed * 0.75;
    }
  }, 16);

  return { warp, startShooters, zoomCloser, zoomFurther, resetFocus };
})();

/* ═══════════════════════════════════════════════════════
   HOME STAGE — CAKE + CANDLE BLOW INTERACTION
   ═══════════════════════════════════════════════════════ */
(function initHome() {
  const homeStage     = document.getElementById('home-stage');
  const universeStage = document.getElementById('universe-stage');
  const blowBtn       = document.getElementById('blow-btn');
  const candles       = document.querySelectorAll('.candle');
  let blown = false;

  function blowOut(e) {
    if (blown) return;
    blown = true;
    blowBtn.style.pointerEvents = 'none';

    /* Immediately unlock audio (user gesture fires here) */
    Audio.play();
    Audio.blow();

    /* Stagger candle flame extinguish + smoke */
    candles.forEach((c, i) => {
      setTimeout(() => c.classList.add('out'), i * 80);
    });

    const fireworkDelay = 220;

    /* ── FIRECRACKER CELEBRATION — real SFX + visual burst ── */
    setTimeout(() => {
      /* Play the real firecracker audio files immediately */
      Audio.firecracker();

      /* Visual fireworks show starts simultaneously */
      FX.firecrackerShow();

      /* Synth fanfare as harmonic overlay */
      Audio.fanfare();
    }, fireworkDelay);

    /* Warp into the 360° memory universe */
    setTimeout(() => {
      homeStage.classList.add('fade-out');
      Universe.warp();
      universeStage.classList.remove('hidden');
      Universe.startShooters();
    }, fireworkDelay + 2700);
  }

  let touchHandled = false;

  blowBtn.addEventListener('touchend', e => {
    e.preventDefault();
    touchHandled = true;
    blowOut(e);
  }, { passive: false });

  blowBtn.addEventListener('click', e => {
    if (touchHandled) { touchHandled = false; return; }
    blowOut(e);
  });

  /* Tapping individual candles also blows out */
  candles.forEach(c => {
    c.addEventListener('touchend', e => {
      e.preventDefault(); blowOut(e);
    }, { passive: false });
    c.addEventListener('click', e => { blowOut(e); });
  });
})();

/* ═══════════════════════════════════════════════════════
   AUDIO PILL TOGGLE
   ═══════════════════════════════════════════════════════ */
(function initAudioBtn() {
  const btn = document.getElementById('audio-btn');
  if (btn) {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      Audio.toggle();
    });
  }

  /* ── Start music immediately on first user interaction (page load).
     Browsers block autoplay until a user gesture. We attach a one-time
     listener to the whole document so the very first tap/click/key
     on the intro screen starts the BGM — no extra button click needed. ── */
  Audio.play(); // attempt immediate start (works on some browsers)

  const firstTouch = () => {
    Audio.play();
    ['pointerdown','touchstart','click','keydown'].forEach(ev =>
      document.removeEventListener(ev, firstTouch));
  };
  ['pointerdown','touchstart','click','keydown'].forEach(ev =>
    document.addEventListener(ev, firstTouch, { once: true, passive: true }));
})();
