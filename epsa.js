(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('epsaCanvas');
  const ctx = canvas.getContext('2d');
  let W = 800, H = 400, dpr = 1;

  function resize() {
    const r = $('epsaCanvasWrap').getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(220, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  const screens = { start: $('epsaStart'), game: $('epsaGame'), end: $('epsaEnd') };
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  const GRAVITY = 1900;
  const MOVE = 230;
  const JUMP = 690;
  const PW = 28, PH = 36;
  const groundY = () => H * 0.85;

  const LEVEL = {
    width: 3200,
    goalX: 3070,
    ground: [
      { x: 0, w: 620 }, { x: 720, w: 420 }, { x: 1250, w: 480 },
      { x: 1830, w: 470 }, { x: 2400, w: 800 },
    ],
    platforms: [
      { x: 260, y: 250, w: 130 }, { x: 500, y: 190, w: 120 },
      { x: 840, y: 255, w: 140 }, { x: 1040, y: 195, w: 130 },
      { x: 1390, y: 250, w: 160 }, { x: 1650, y: 180, w: 130 },
      { x: 1990, y: 245, w: 140 }, { x: 2230, y: 175, w: 130 },
      { x: 2580, y: 250, w: 150 }, { x: 2830, y: 190, w: 120 },
    ],
    enemies: [
      { name: 'Mikail Abi', x: 400, min: 340, max: 560, color: '#ef4444' },
      { name: 'Aycan Hanım', x: 900, min: 830, max: 1090, color: '#a855f7' },
      { name: 'Esin Hanım', x: 1460, min: 1380, max: 1640, color: '#0ea5e9' },
      { name: 'Mikail Abi', x: 2100, min: 2020, max: 2250, color: '#ef4444' },
      { name: 'Aycan Hanım', x: 2660, min: 2560, max: 2830, color: '#a855f7' },
    ],
    coinXs: [180, 300, 520, 860, 960, 1080, 1280, 1420, 1500, 1670, 1860, 2020, 2120, 2250, 2440, 2600, 2700, 2860, 2980],
  };

  const keys = { left: false, right: false, jump: false };
  let state = null;
  let rafId = null;
  let lastTime = 0;
  let animTime = 0;
  let accumulator = 0;
  const FIXED = 1 / 60;

  function solids() {
    const g = groundY();
    const list = LEVEL.ground.map((x) => ({ x: x.x, y: g, w: x.w, h: H - g, ground: true }));
    LEVEL.platforms.forEach((p) => list.push({ x: p.x, y: p.y, w: p.w, h: 16, ground: false }));
    return list;
  }

  function fresh() {
    return {
      x: 60, y: groundY() - PH, vx: 0, vy: 0, onGround: true,
      lives: 3, score: 0, time: 90, camera: 0, invuln: 0,
      enemies: LEVEL.enemies.map((e, i) => ({
        ...e, y: groundY() - 30, vx: i % 2 === 0 ? 55 : -55, dead: false, phase: i * 0.7,
      })),
      coins: LEVEL.coinXs.map((x, i) => ({ x, y: i % 3 === 0 ? groundY() - 70 : groundY() - 45, got: false })),
      floaters: [],
      finished: false,
    };
  }

  function start() {
    state = fresh();
    paused = false;
    $('epsaPauseBox').hidden = true;
    updateHud(true);
    show('game');
    resize();
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    accumulator = 0;
    rafId = requestAnimationFrame(loop);
  }

  let paused = false;
  function loop(now) {
    if (!state || state.finished) return;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (!paused) {
      accumulator += dt;
      while (accumulator >= FIXED && !state.finished) {
        animTime += FIXED;
        update(FIXED);
        accumulator -= FIXED;
      }
      draw();
    }
    rafId = requestAnimationFrame(loop);
  }

  function updateHud(force) {
    if (!state) return;
    $('epsaScore').textContent = state.score;
    $('epsaLives').textContent = state.lives;
    $('epsaTime').textContent = Math.max(0, Math.ceil(state.time));
  }

  function jump() {
    if (state && state.onGround && !paused) {
      state.vy = -JUMP;
      state.onGround = false;
    }
  }

  function loseLife() {
    state.lives--;
    if (state.lives <= 0) { finish(false); return; }
    state.x = 60;
    state.y = groundY() - PH;
    state.vx = 0;
    state.vy = 0;
    state.camera = 0;
    state.invuln = 1.5;
    updateHud();
  }

  function finish(won) {
    state.finished = true;
    if (rafId) cancelAnimationFrame(rafId);
    $('epsaEndIcon').textContent = won ? '🏆' : '💀';
    $('epsaEndTitle').textContent = won ? 'EPSA’DAN KAÇTIN!' : 'EPSA YAKALADI!';
    $('epsaEndText').textContent = won
      ? 'Mikail Abi, Aycan Hanım ve Esin Hanım’ı atlattın.'
      : 'Canavarlara yakalandın. Bir kez daha dene!';
    $('epsaFinalScore').textContent = state.score;
    show('end');
  }

  function update(dt) {
    const s = state;
    s.time -= dt;
    if (s.time <= 0) { finish(false); return; }
    s.invuln = Math.max(0, s.invuln - dt);

    // yatay
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    s.vx = dir * MOVE;
    s.x += s.vx * dt;
    for (const b of solids()) {
      if (s.x < b.x + b.w && s.x + PW > b.x && s.y < b.y + b.h && s.y + PH > b.y) {
        if (s.vx > 0) s.x = b.x - PW;
        else if (s.vx < 0) s.x = b.x + b.w;
      }
    }
    s.x = Math.max(0, Math.min(LEVEL.width - PW, s.x));

    // dikey
    const prevBottom = s.y + PH;
    s.vy += GRAVITY * dt;
    s.y += s.vy * dt;
    s.onGround = false;
    for (const b of solids()) {
      if (s.x < b.x + b.w && s.x + PW > b.x && s.y < b.y + b.h && s.y + PH > b.y) {
        if (s.vy > 0) { s.y = b.y - PH; s.vy = 0; s.onGround = true; }
        else if (s.vy < 0) { s.y = b.y + b.h; s.vy = 0; }
      }
    }
    if (s.y > H + 60) { loseLife(); return; }

    // canavarlar
    for (const e of s.enemies) {
      if (e.dead) continue;
      e.x += e.vx * dt;
      if (e.x < e.min) { e.x = e.min; e.vx = Math.abs(e.vx); }
      if (e.x > e.max) { e.x = e.max; e.vx = -Math.abs(e.vx); }
      const hit = s.x < e.x + 28 && s.x + PW > e.x && s.y < e.y + 30 && s.y + PH > e.y;
      if (hit) {
        if (s.vy > 0 && prevBottom <= e.y + 10) {
          e.dead = true;
          s.score += 100;
          s.vy = -430;
          s.floaters.push({ x: e.x + 14, y: e.y - 8, text: '+100', life: 1 });
        } else if (s.invuln <= 0) {
          loseLife();
          return;
        }
      }
    }

    // rozetler
    for (const c of s.coins) {
      if (c.got) continue;
      if (s.x < c.x + 18 && s.x + PW > c.x && s.y < c.y + 20 && s.y + PH > c.y) {
        c.got = true;
        s.score += 10;
        s.floaters.push({ x: c.x + 9, y: c.y - 6, text: '+10', life: 0.8 });
      }
    }

    if (s.x + PW > LEVEL.goalX) { finish(true); return; }

    // yazılar
    for (let i = s.floaters.length - 1; i >= 0; i--) {
      s.floaters[i].life -= dt * 1.5;
      s.floaters[i].y -= 30 * dt;
      if (s.floaters[i].life <= 0) s.floaters.splice(i, 1);
    }

    const target = Math.max(0, Math.min(LEVEL.width - W, s.x - W * 0.35));
    s.camera += (target - s.camera) * Math.min(1, dt * 8);
    updateHud();
  }

  /* ---------- Çizim ---------- */
  function drawHero(x, y) {
    const facing = state.vx >= 0 ? 1 : -1;
    const step = state.onGround ? Math.sin(animTime * 14) * 4 : 0;
    ctx.save();
    ctx.translate(x + PW / 2, y + PH / 2);
    ctx.scale(facing, 1);
    // bacaklar
    ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-5 + step, 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(5 - step, 18); ctx.stroke();
    // gövde
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(-10, -6, 20, 16);
    // kol
    ctx.strokeStyle = '#f0a468'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(13 + step * 0.6, 7); ctx.stroke();
    // kafa
    ctx.fillStyle = '#f0a468';
    ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill();
    // şapka
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(0, -16, 9, Math.PI, 0); ctx.fill();
    ctx.fillRect(2, -17, 11, 3);
    // göz
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(4, -14, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e) {
    const x = e.x - state.camera;
    const bob = Math.sin(animTime * 8 + e.phase) * 2;
    const y = e.y + bob;
    ctx.save();
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.ellipse(14, y + 18, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(9, y + 14, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(19, y + 14, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(10, y + 14, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(20, y + 14, 2, 0, Math.PI * 2); ctx.fill();
    // isim
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const tw = ((ctx.measureText && ctx.measureText(e.name)) || {}).width || e.name.length * 6;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(14 - tw / 2 - 4, y - 22, tw + 8, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(e.name, 14, y - 12);
    ctx.restore();
  }

  function draw() {
    const s = state;
    const g = groundY();
    const cam = s.camera;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#7dd3fc');
    sky.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // bulutlar
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 5; i++) {
      let cx = i * 260 + 60 - (cam * 0.2) % (LEVEL.width);
      cx = ((cx % (W + 300)) + (W + 300)) % (W + 300) - 150;
      ctx.beginPath();
      ctx.ellipse(cx, 60, 38, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 26, 55, 28, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // zeminler
    for (const b of LEVEL.ground) {
      const x = b.x - cam;
      if (x + b.w < 0 || x > W) continue;
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x, g, b.w, H - g);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, g, b.w, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let bx = x + 10; bx < x + b.w; bx += 26) ctx.fillRect(bx, g + 18, 12, 6);
    }

    // platformlar
    for (const p of LEVEL.platforms) {
      const x = p.x - cam;
      if (x + p.w < 0 || x > W) continue;
      ctx.fillStyle = '#166534';
      ctx.fillRect(x, p.y, p.w, 16);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(x, p.y, p.w, 4);
    }

    // rozetler
    ctx.font = '22px sans-serif';
    ctx.textBaseline = 'alphabetic';
    for (const c of s.coins) {
      if (c.got) continue;
      const x = c.x - cam;
      if (x < -30 || x > W + 30) continue;
      const bob = Math.sin(animTime * 4 + c.x) * 3;
      ctx.fillText('💰', x, c.y + 16 + bob);
    }

    // bayrak
    const gx = LEVEL.goalX - cam;
    if (gx > -60 && gx < W + 60) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx, g - 110, 4, 110);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(gx + 4, g - 108);
      ctx.lineTo(gx + 50, g - 96);
      ctx.lineTo(gx + 4, g - 84);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText('ÇIKIŞ', gx + 8, g - 116);
    }

    for (const e of s.enemies) if (!e.dead && e.x - cam > -60 && e.x - cam < W + 60) drawEnemy(e);

    if (s.invuln <= 0 || Math.floor(animTime * 12) % 2 === 0) {
      drawHero(s.x - cam, s.y);
    }

    ctx.textAlign = 'left';
    s.floaters.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const fx = f.x - cam;
      ctx.strokeText(f.text, fx, f.y);
      ctx.fillText(f.text, fx, f.y);
      ctx.restore();
    });
  }

  /* ---------- Girdi ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight') { keys.right = true; e.preventDefault(); }
    if (e.code === 'ArrowUp' || e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) jump();
    }
    if (e.code === 'Escape' && screens.game.classList.contains('active')) {
      paused = !paused;
      $('epsaPauseBox').hidden = !paused;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
  });

  function pad(id, key, isJump) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (isJump) jump(); else keys[key] = true;
    });
    const off = () => { if (!isJump) keys[key] = false; };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  }
  pad('epsaLeft', 'left', false);
  pad('epsaRight', 'right', false);
  pad('epsaJump', 'jump', true);

  $('epsaStartBtn').addEventListener('click', start);
  $('epsaRetryBtn').addEventListener('click', start);
  $('epsaPauseBtn').addEventListener('click', () => {
    paused = !paused;
    $('epsaPauseBox').hidden = !paused;
  });
  $('epsaResumeBtn').addEventListener('click', () => {
    paused = false;
    $('epsaPauseBox').hidden = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state && !state.finished && !paused) {
      paused = true;
      $('epsaPauseBox').hidden = false;
    }
  });
})();
