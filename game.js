(() => {
  'use strict';

  /* ============================================================
     API & oturum
     ============================================================ */
  const API = 'https://yedigimiz-yarraklar-api.ilhamiustun.workers.dev';
  const TOKEN_KEY = 'yy_token_v1';
  const mem = {};

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
  };

  let token = store.get(TOKEN_KEY) || '';
  let profile = null; // { username, face, best, games, totalDodged, isAdmin }

  async function api(path, options = {}) {
    const { method = 'GET', body, auth = true } = options;
    const headers = { 'Content-Type': 'application/json' };
    if (auth && token) headers.Authorization = 'Bearer ' + token;

    let response;
    try {
      response = await fetch(API + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.');
    }

    let data = {};
    try { data = await response.json(); } catch (e) { /* boş yanıt */ }
    if (!response.ok) throw new Error(data.error || 'Bir hata oluştu.');
    return data;
  }

  /* ============================================================
     DOM & ekranlar
     ============================================================ */
  const $ = (id) => document.getElementById(id);
  const screens = {
    auth: $('authScreen'),
    menu: $('menuScreen'),
    game: $('gameScreen'),
    over: $('gameOverScreen'),
    admin: $('adminScreen'),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  /* ============================================================
     Giriş / Kayıt
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

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('username').value.trim();
    const pass = $('password').value;
    authError.textContent = '';

    if (!name || !pass) {
      authError.textContent = 'Kullanıcı adı ve şifre gerekli.';
      return;
    }

    authSubmit.disabled = true;
    authSubmit.textContent = 'Bekle...';
    try {
      const data = await api(authMode === 'register' ? '/api/register' : '/api/login', {
        method: 'POST',
        body: { username: name, password: pass },
        auth: false,
      });
      token = data.token;
      store.set(TOKEN_KEY, token);
      profile = data.user;
      $('password').value = '';
      enterMenu();
    } catch (err) {
      authError.textContent = err.message;
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* yoksay */ }
    token = '';
    profile = null;
    store.set(TOKEN_KEY, '');
    show('auth');
  });

  /* ============================================================
     Menü & profil
     ============================================================ */
  let faceImg = null;

  function renderFace() {
    const src = profile && profile.face;
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
    if (!profile) return;
    $('bestScore').textContent = profile.best;
    $('totalDodged').textContent = profile.totalDodged;
    $('gamesPlayed').textContent = profile.games;
  }

  function enterMenu() {
    if (!profile) { show('auth'); return; }
    $('userNameText').textContent = profile.username;
    $('adminBtn').hidden = !profile.isAdmin;
    renderFace();
    updateStatsUI();
    show('menu');
  }

  // Fotoğraf yükle: küçült -> sunucuya kaydet
  $('photoInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !profile) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const size = 160;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const cx = c.getContext('2d');
        const side = Math.min(img.width, img.height);
        cx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        const face = c.toDataURL('image/jpeg', 0.82);
        try {
          const data = await api('/api/face', { method: 'POST', body: { face } });
          profile.face = data.face;
          renderFace();
        } catch (err) {
          alert(err.message);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  /* ============================================================
     Admin paneli
     ============================================================ */
  $('adminBtn').addEventListener('click', async () => {
    const list = $('adminList');
    list.innerHTML = '<p class="hint">Yükleniyor...</p>';
    show('admin');
    try {
      const data = await api('/api/admin/users');
      list.innerHTML = '';
      data.users.forEach((u, i) => {
        const row = document.createElement('div');
        row.className = 'admin-row';
        const rank = document.createElement('span');
        rank.className = 'admin-rank';
        rank.textContent = '#' + (i + 1);
        const name = document.createElement('strong');
        name.textContent = u.username + (u.username === 'admin' ? ' 🛡️' : '');
        const stats = document.createElement('span');
        stats.className = 'admin-stats';
        stats.textContent = u.best + ' kaçış · ' + u.games + ' oyun';
        row.append(rank, name, stats);
        list.appendChild(row);
      });
    } catch (err) {
      list.textContent = err.message;
    }
  });
  $('adminBackBtn').addEventListener('click', enterMenu);

  /* ============================================================
     Oyun motoru
     ============================================================ */
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W = 800, H = 400, dpr = 1;

  function resizeCanvas() {
    const r = $('canvasWrap').getBoundingClientRect();
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
    const score = state.score;
    $('finalScore').textContent = score;
    $('overText').textContent =
      'Bugün ' + score + ' yarraktan kaçtın ama en sonunda yarrağı yedin!';
    $('newBest').hidden = true;
    show('over');

    // Skoru sunucuya kaydet
    api('/api/score', { method: 'POST', body: { score } })
      .then((data) => {
        profile.best = data.best;
        profile.games = data.games;
        profile.totalDodged = data.totalDodged;
        $('newBest').hidden = !data.isBest;
      })
      .catch((err) => {
        $('overText').textContent += ' (Skor kaydedilemedi: ' + err.message + ')';
      });
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

    s.vy += GRAVITY * dt;
    s.top += s.vy * dt;
    if (s.top >= g - ch) { s.top = g - ch; s.vy = 0; s.jumping = false; }

    s.speed = Math.min(620, 300 + s.score * 6);
    s.distance += s.speed * dt;

    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      const minGap = Math.max(0.55, 1.25 - s.score * 0.018);
      s.spawnTimer = minGap + Math.random() * 0.45;
      s.eggs.push({ x: W + 20, counted: false });
    }

    for (let i = s.eggs.length - 1; i >= 0; i--) {
      const egg = s.eggs[i];
      egg.x -= s.speed * dt;

      if (!egg.counted && egg.x + es < cx) {
        egg.counted = true;
        s.score++;
        $('liveScore').textContent = s.score;
      }

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

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#3b0d57');
    sky.addColorStop(0.7, '#6d28d9');
    sky.addColorStop(1, '#4c1d95');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.2, Math.min(W, H) * 0.09, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.font = es + 'px sans-serif';
    ctx.textBaseline = 'alphabetic';
    for (const egg of s.eggs) ctx.fillText('🍆', egg.x, g - 2);

    drawRunner(s.top, cw, ch, cx, g);
  }

  function drawRunner(top, w, h, x, g) {
    const cx = x + w / 2;
    const headR = w * 0.36;
    const headCy = top + headR + 2;
    const bodyTop = headCy + headR * 0.75;
    const bodyBottom = top + h * 0.78;
    const swing = running && !paused ? Math.sin(animTime * 16) : 0;
    const air = state.jumping;

    ctx.save();
    ctx.strokeStyle = '#0b0410';
    ctx.lineWidth = Math.max(4, w * 0.11);
    ctx.lineCap = 'round';

    const legLen = (g - bodyBottom);
    const footY = air ? bodyBottom + legLen * 0.55 : g - 2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.1, bodyBottom);
    ctx.lineTo(cx - w * 0.1 + (air ? -w * 0.18 : swing * w * 0.22), footY);
    ctx.moveTo(cx + w * 0.1, bodyBottom);
    ctx.lineTo(cx + w * 0.1 + (air ? w * 0.18 : -swing * w * 0.22), footY);
    ctx.stroke();

    ctx.strokeStyle = '#f1c27d';
    ctx.lineWidth = Math.max(3, w * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, bodyTop + h * 0.08);
    ctx.lineTo(cx - w * 0.42, bodyTop + h * 0.22 + (air ? -6 : -swing * w * 0.18));
    ctx.moveTo(cx + w * 0.28, bodyTop + h * 0.08);
    ctx.lineTo(cx + w * 0.42, bodyTop + h * 0.22 + (air ? -6 : swing * w * 0.18));
    ctx.stroke();

    ctx.fillStyle = '#22d3ee';
    roundRect(x + w * 0.18, bodyTop, w * 0.64, bodyBottom - bodyTop, w * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

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
     Başlangıç: kayıtlı oturum varsa sunucudan profili al
     ============================================================ */
  (async () => {
    if (!token) { show('auth'); return; }
    try {
      const data = await api('/api/me');
      profile = data.user;
      enterMenu();
    } catch (e) {
      token = '';
      store.set(TOKEN_KEY, '');
      show('auth');
    }
  })();
})();
