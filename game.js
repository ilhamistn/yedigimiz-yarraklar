(() => {
  'use strict';

  /* ============================================================
     Storage (localStorage ile yedek, erişilemezse hafızada tutar)
     ============================================================ */
  const USERS_KEY = 'yy_users_v1';
  const SESSION_KEY = 'yy_session_v1';
  const mem = {};

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
  };

  function loadUsers() {
    try { return JSON.parse(store.get(USERS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveUsers(u) { store.set(USERS_KEY, JSON.stringify(u)); }

  function hashPass(pw) {
    let h = 5381;
    for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  let users = loadUsers();
  let currentUser = store.get(SESSION_KEY);

  /* ============================================================
     DOM
     ============================================================ */
  const $ = (id) => document.getElementById(id);
  const screens = {
    auth: $('authScreen'),
    menu: $('menuScreen'),
    game: $('gameScreen'),
    over: $('gameOverScreen'),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  /* ============================================================
     Auth
     ============================================================ */
  const authForm = $('authForm');
  const authError = $('authError');
  const authTabs = Array.from(document.querySelectorAll('.auth-tab'));
  const authSubmit = $('authSubmit');
  let authMode = 'login';

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      authMode = tab.dataset.mode;
      authTabs.forEach((t) => t.classList.toggle('active', t === tab));
      authSubmit.textContent = authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
      authError.textContent = '';
    });
  });

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('username').value.trim();
    const pass = $('password').value;
    authError.textContent = '';

    if (!name || !pass) {
      authError.textContent = 'Kullanıcı adı ve şifre gerekli.';
      return;
    }

    if (authMode === 'register') {
      if (users[name]) {
        authError.textContent = 'Bu kullanıcı adı zaten var.';
        return;
      }
      users[name] = {
        pass: hashPass(pass),
        face: null,
        best: 0,
        games: 0,
        totalDodged: 0,
      };
      saveUsers(users);
    } else {
      const u = users[name];
      if (!u || u.pass !== hashPass(pass)) {
        authError.textContent = 'Kullanıcı adı veya şifre yanlış.';
        return;
      }
    }

    currentUser = name;
    store.set(SESSION_KEY, name);
    $('password').value = '';
    enterMenu();
  });

  $('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    store.set(SESSION_KEY, '');
    show('auth');
  });

  /* ============================================================
     Menu & profil
     ============================================================ */
  let faceImg = null; // yüklenen fotoğraf (Image)

  function currentData() { return users[currentUser] || null; }

  function renderFace() {
    const data = currentData();
    const src = data && data.face;
    const preview = $('facePreview');
    const avatar = $('userAvatar');

    if (src) {
      preview.innerHTML = '<img src="' + src + '" alt="yüz" />';
      avatar.innerHTML = '<img src="' + src + '" alt="yüz" />';
      faceImg = new Image();
      faceImg.src = src;
    } else {
      preview.textContent = '😄';
      avatar.textContent = '😎';
      faceImg = null;
    }
  }

  function updateStatsUI() {
    const d = currentData();
    if (!d) return;
    $('bestScore').textContent = d.best;
    $('totalDodged').textContent = d.totalDodged;
    $('gamesPlayed').textContent = d.games;
  }

  function enterMenu() {
    if (!currentUser || !users[currentUser]) { show('auth'); return; }
    $('userNameText').textContent = currentUser;
    renderFace();
    updateStatsUI();
    show('menu');
  }

  // Fotoğraf yükleme: küçültüp data URL olarak sakla (localStorage dostu)
  $('photoInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    const d = currentData();
    if (!file || !d) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        // kare kırpma
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        d.face = c.toDataURL('image/jpeg', 0.82);
        saveUsers(users);
        renderFace();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  /* ============================================================
     Oyun motoru
     ============================================================ */
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W = 800, H = 400, dpr = 1;

  function resizeCanvas() {
    const wrap = $('canvasWrap');
    const r = wrap.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(220, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state && !state.jumping) state.top = groundY() - charH();
  }
  window.addEventListener('resize', resizeCanvas);

  const groundY = () => H * 0.82;
  const charW = () => Math.max(40, Math.min(70, W * 0.1));
  const charH = () => charW() * 1.4;
  const charX = () => W * 0.16;
  const eggSize = () => charW() * 0.92;

  const GRAVITY = 2100;
  const JUMP_V = 780;

  let state = null;
  let rafId = null;
  let lastTime = 0;
  let animTime = 0;
  let running = false;
  let paused = false;

  function freshState() {
    return {
      top: groundY() - charH(),
      vy: 0,
      jumping: false,
      eggs: [],
      spawnTimer: 0.7,
      score: 0,
      distance: 0,
      speed: 300,
    };
  }

  function startGame() {
    state = freshState();
    paused = false;
    $('pauseOverlay').classList.remove('show');
    $('liveScore').textContent = '0';
    show('game');
    resizeCanvas();
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stopGame() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function jump() {
    if (!running || paused || !state) return;
    if (!state.jumping) {
      state.vy = -JUMP_V;
      state.jumping = true;
    }
  }

  function gameOver() {
    stopGame();
    const d = currentData();
    if (d) {
      d.games += 1;
      d.totalDodged += state.score;
      const isBest = state.score > d.best;
      d.best = Math.max(d.best, state.score);
      saveUsers(users);
      $('newBest').hidden = !isBest;
    }
    $('finalScore').textContent = state.score;
    $('overText').textContent =
      'Bugün ' + state.score + ' yarraktan kaçtın ama en sonunda yarrağı yedin!';
    show('over');
  }

  function togglePause(force) {
    if (!running) return;
    paused = typeof force === 'boolean' ? force : !paused;
    $('pauseOverlay').classList.toggle('show', paused);
    if (!paused) {
      lastTime = performance.now();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function loop(now) {
    if (!running || paused) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    animTime += dt;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    const s = state;
    const g = groundY();
    const ch = charH();
    const cw = charW();
    const cx = charX();
    const es = eggSize();

    // Fizik
    s.vy += GRAVITY * dt;
    s.top += s.vy * dt;
    if (s.top >= g - ch) { s.top = g - ch; s.vy = 0; s.jumping = false; }

    // Zorluk artışı
    s.speed = Math.min(620, 300 + s.score * 6);
    s.distance += s.speed * dt;

    // Engel üretimi
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      const minGap = Math.max(0.55, 1.25 - s.score * 0.018);
      s.spawnTimer = minGap + Math.random() * 0.45;
      s.eggs.push({ x: W + 20, counted: false });
    }

    // Hareket & çarpışma
    for (let i = s.eggs.length - 1; i >= 0; i--) {
      const egg = s.eggs[i];
      egg.x -= s.speed * dt;

      // Geçti say
      if (!egg.counted && egg.x + es < cx) {
        egg.counted = true;
        s.score++;
        $('liveScore').textContent = s.score;
      }

      // Çarpışma: yatay örtüşme ve karakter yeterince alçaksa
      const charBottom = s.top + ch;
      const eggTop = g - es * 0.95;
      if (egg.x < cx + cw * 0.92 && egg.x + es * 0.9 > cx + cw * 0.08) {
        if (charBottom > eggTop + 4) { gameOver(); return; }
      }
      if (egg.x < -es - 20) s.eggs.splice(i, 1);
    }
  }

  /* ---------- Çizim ---------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    const s = state;
    const g = groundY();
    const cw = charW(), ch = charH(), cx = charX();
    const es = eggSize();

    // Gökyüzü
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#3b0d57');
    sky.addColorStop(0.7, '#6d28d9');
    sky.addColorStop(1, '#4c1d95');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Ay / dekor
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.2, Math.min(W, H) * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Yol
    ctx.fillStyle = '#1c0a2a';
    ctx.fillRect(0, g, W, H - g);
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(0, g, W, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const dash = 40, gap = 30, period = dash + gap;
    const offset = (s.distance % period);
    for (let x = -offset; x < W; x += period) {
      ctx.fillRect(x, g + (H - g) * 0.55, dash, 3);
    }

    // Engel: patlıcan
    ctx.font = es + 'px sans-serif';
    ctx.textBaseline = 'alphabetic';
    for (const egg of s.eggs) {
      ctx.fillText('🍆', egg.x, g - 2);
    }

    // Karakter
    drawRunner(s.top, cw, ch, cx, g);
  }

  function drawRunner(top, w, h, x, g) {
    const cx = x + w / 2;
    const headR = w * 0.36;
    const headCy = top + headR + 2;
    const bodyTop = headCy + headR * 0.75;
    const bodyBottom = top + h * 0.78;
    const swing = s_running() ? Math.sin(animTime * 16) : 0;
    const air = state.jumping;

    ctx.save();
    ctx.strokeStyle = '#0b0410';
    ctx.lineWidth = Math.max(4, w * 0.11);
    ctx.lineCap = 'round';

    // Bacaklar (havada bacaklar içeri çekilir)
    const legLen = (g - bodyBottom);
    const footY = air ? bodyBottom + legLen * 0.55 : g - 2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.1, bodyBottom);
    ctx.lineTo(cx - w * 0.1 + (air ? -w * 0.18 : swing * w * 0.22), footY);
    ctx.moveTo(cx + w * 0.1, bodyBottom);
    ctx.lineTo(cx + w * 0.1 + (air ? w * 0.18 : -swing * w * 0.22), footY);
    ctx.stroke();

    // Kollar
    ctx.strokeStyle = '#f1c27d';
    ctx.lineWidth = Math.max(3, w * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, bodyTop + h * 0.08);
    ctx.lineTo(cx - w * 0.42, bodyTop + h * 0.22 + (air ? -6 : -swing * w * 0.18));
    ctx.moveTo(cx + w * 0.28, bodyTop + h * 0.08);
    ctx.lineTo(cx + w * 0.42, bodyTop + h * 0.22 + (air ? -6 : swing * w * 0.18));
    ctx.stroke();

    // Gövde
    ctx.fillStyle = '#22d3ee';
    roundRect(x + w * 0.18, bodyTop, w * 0.64, bodyBottom - bodyTop, w * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Kafa
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#f1c27d';
    ctx.fill();
    ctx.clip();
    if (faceImg && faceImg.complete && faceImg.naturalWidth) {
      ctx.drawImage(faceImg, cx - headR, headCy - headR, headR * 2, headR * 2);
    } else {
      ctx.font = headR * 1.6 + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('😄', cx, headCy + headR * 0.08);
    }
    ctx.restore();
    ctx.restore();
  }

  function s_running() { return running && !paused; }

  /* ============================================================
     Input
     ============================================================ */
  $('startBtn').addEventListener('click', startGame);
  $('retryBtn').addEventListener('click', startGame);
  $('menuBtn').addEventListener('click', enterMenu);
  $('jumpBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
  $('pauseBtn').addEventListener('click', () => togglePause(true));
  $('resumeBtn').addEventListener('click', () => togglePause(false));
  $('quitBtn').addEventListener('click', () => { stopGame(); enterMenu(); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (screens.game.classList.contains('active')) { e.preventDefault(); jump(); }
    }
    if (e.code === 'Escape' && screens.game.classList.contains('active')) togglePause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) togglePause(true);
  });

  /* ============================================================
     Başlangıç
     ============================================================ */
  if (currentUser && users[currentUser]) enterMenu();
  else show('auth');
})();
