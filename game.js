(() => {
  'use strict';

  /* ============================================================
     API & oturum
     ============================================================ */
  const API = 'https://yedigimiz-yarraklar-api.ilhamiustun.workers.dev';
  const APP_VERSION = 8;

  const STORY_LEVELS = [
    {
      title: '1. Bahçe Nöbeti',
      desc: 'Sabah güneşiyle birlikte ilk patlıcanlar bahçeye girdi. Kaç, yoksa yarrak yiyeceksin.',
      endText: 'Bahçeyi temizledin. Ama ufukta daha büyük bir sürü var...',
      target: 5, speed: 250, gap: 1.25, variance: 0.6, double: false, triple: false,
    },
    {
      title: '2. Patlıcan Sürüsü',
      desc: 'Artık ikişer ikişer geliyorlar. Arkadaşını da atlamayı unutma.',
      endText: 'Sürüyü geçtin. Şimdi işler karışıyor...',
      target: 10, speed: 310, gap: 1.1, variance: 0.5, double: true, triple: false,
    },
    {
      title: '3. Gece Koşusu',
      desc: 'Karanlıkta patlıcanlar daha hızlı. Gözünü açık tut.',
      endText: 'Geceyi atlattın. Tarla seni bekliyor.',
      target: 15, speed: 370, gap: 0.95, variance: 0.45, double: true, triple: false,
    },
    {
      title: '4. Kızıl Tarla',
      desc: 'Üçlü dalgalar başladı. Tek bir hata her şeyi bitirir.',
      endText: 'Tarlayı geçtin. Son mücadele yakın.',
      target: 22, speed: 430, gap: 0.82, variance: 0.4, double: true, triple: true,
    },
    {
      title: '5. Son Yarrak',
      desc: 'Final. Hızlarına hız katıldı. 30 yarraktan kaç ve hikayeyi bitir.',
      endText: 'Efsane tamamlandı. Artık hiçbir patlıcan sana yetişemez!',
      target: 30, speed: 480, gap: 0.7, variance: 0.35, double: true, triple: true,
    },
  ];
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
    leader: $('leaderScreen'),
    settings: $('settingsScreen'),
    story: $('storyScreen'),
    storyResult: $('storyResultScreen'),
    arena: $('arenaScreen'),
    sandbox: $('sandboxScreen'),
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
    authError.style.color = '';

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
      if (data.pending) {
        authError.style.color = '#86efac';
        authError.textContent = 'Kaydın alındı! Admin onayından sonra giriş yapabilirsin.';
        $('password').value = '';
        return;
      }
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
    closeArena();
    if (!profile) { show('auth'); return; }
    $('userNameText').textContent = profile.username;
    $('adminBtn').hidden = !profile.isAdmin;
    if (profile.isAdmin) {
      api('/api/admin/users').then((d) => {
        const n = d.users.filter((u) => u.approved !== 1).length;
        $('adminBtn').textContent = '🛡️ Admin Paneli' + (n ? ' (' + n + ' bekliyor)' : '');
      }).catch(() => {});
    }
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
     Lider tablosu
     ============================================================ */
  $('leaderBtn').addEventListener('click', async () => {
    const list = $('leaderList');
    list.innerHTML = '<p class="hint">Yükleniyor...</p>';
    show('leader');
    try {
      const data = await api('/api/leaderboard', { auth: false });
      list.innerHTML = '';
      if (!data.users.length) {
        list.innerHTML = '<p class="leader-empty">Henüz kimse yarraktan kaçamadı.</p>';
        return;
      }
      data.users.forEach((u, i) => {
        const row = document.createElement('div');
        row.className = 'admin-row leader-row';
        const rank = document.createElement('span');
        rank.className = 'admin-rank';
        rank.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
        const name = document.createElement('strong');
        name.textContent = u.username;
        const stats = document.createElement('span');
        stats.className = 'admin-stats';
        stats.textContent = u.best + ' yarrak · ' + u.games + ' oyun';
        row.append(rank, name, stats);
        list.appendChild(row);
      });
    } catch (err) {
      list.textContent = err.message;
    }
  });
  $('leaderBackBtn').addEventListener('click', enterMenu);

  /* ============================================================
     Admin paneli: onayla / sil
     ============================================================ */
  function makeMini(label, className, onClick) {
    const b = document.createElement('button');
    b.className = 'mini-btn ' + className;
    b.textContent = label;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await onClick();
        const st = $('adminStatus');
        if (st) st.textContent = '✓ ' + label + ' işlemi tamamlandı.';
        openAdmin();
      } catch (err) {
        const st = $('adminStatus');
        if (st) st.textContent = 'Hata: ' + err.message;
        b.disabled = false;
      }
    });
    return b;
  }

  function adminRow(u, pending, rank) {
    const row = document.createElement('div');
    row.className = 'admin-row';
    const rankEl = document.createElement('span');
    rankEl.className = 'admin-rank';
    rankEl.textContent = pending ? '⏳' : u.is_admin ? '🛡️' : '#' + rank;
    const name = document.createElement('strong');
    name.textContent = u.username;
    const stats = document.createElement('span');
    stats.className = 'admin-stats';
    stats.textContent = u.best + ' yarrak · ' + u.games + ' oyun';
    const actions = document.createElement('div');
    actions.className = 'admin-actions';

    if (pending && !u.is_admin) {
      actions.appendChild(makeMini('Onayla', 'approve', () =>
        api('/api/admin/approve', { method: 'POST', body: { id: u.id } })));
      actions.appendChild(makeMini('Reddet', 'delete', () =>
        api('/api/admin/delete', { method: 'POST', body: { id: u.id } })));
    } else if (!u.is_admin) {
      actions.appendChild(makeMini('Sil', 'delete', () => {
        if (!confirm(u.username + ' silinsin mi?')) throw new Error('İptal edildi.');
        return api('/api/admin/delete', { method: 'POST', body: { id: u.id } });
      }));
    }

    row.append(rankEl, name, stats, actions);
    return row;
  }

  async function openAdmin() {
    const pendingList = $('adminPending');
    const list = $('adminList');
    if (!pendingList || !list) return;
    pendingList.innerHTML = '<p class="hint">Yükleniyor...</p>';
    list.innerHTML = '<p class="hint">Yükleniyor...</p>';
    show('admin');
    try {
      const data = await api('/api/admin/users');
      pendingList.innerHTML = '';
      list.innerHTML = '';
      const pending = data.users.filter((u) => u.approved !== 1);
      const approved = data.users.filter((u) => u.approved === 1);
      if (!pending.length) pendingList.innerHTML = '<p class="leader-empty">Bekleyen kullanıcı yok.</p>';
      else pending.forEach((u) => pendingList.appendChild(adminRow(u, true)));
      if (!approved.length) list.innerHTML = '<p class="leader-empty">Onaylı kullanıcı yok.</p>';
      else approved.forEach((u, i) => list.appendChild(adminRow(u, false, i + 1)));
    } catch (err) {
      pendingList.textContent = err.message;
    }
  }

  $('adminBtn').addEventListener('click', () => {
    const st = $('adminStatus');
    if (st) st.textContent = '';
    openAdmin();
  });
  const refreshBtn = $('adminRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    const st = $('adminStatus');
    if (st) st.textContent = '';
    openAdmin();
  });
  $('adminBackBtn').addEventListener('click', enterMenu);

  /* ============================================================
     Ayarlar: şifre değiştir (admin dahil)
     ============================================================ */
  $('settingsBtn').addEventListener('click', () => {
    $('passError').textContent = '';
    $('passError').style.color = '';
    show('settings');
  });
  $('settingsBackBtn').addEventListener('click', enterMenu);

  $('passForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = $('currentPass').value;
    const next = $('newPass').value;
    const next2 = $('newPass2').value;
    const err = $('passError');
    err.textContent = '';
    err.style.color = '';

    if (next !== next2) { err.textContent = 'Yeni şifreler eşleşmiyor.'; return; }
    if (next.length < 4) { err.textContent = 'Yeni şifre en az 4 karakter olmalı.'; return; }

    $('savePassBtn').disabled = true;
    try {
      const data = await api('/api/password', { method: 'POST', body: { current, next } });
      token = data.token;
      store.set(TOKEN_KEY, token);
      $('currentPass').value = '';
      $('newPass').value = '';
      $('newPass2').value = '';
      err.style.color = '#86efac';
      err.textContent = 'Şifren değiştirildi.';
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      $('savePassBtn').disabled = false;
    }
  });

  /* ============================================================
     Tam ekran
     ============================================================ */
  const fullBtn = $('fullscreenBtn');
  fullBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (screens.game.requestFullscreen) {
        await screens.game.requestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        fullBtn.textContent = 'Desteklenmiyor';
        return;
      }
      try {
        if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
      } catch (ex) { /* bazı tarayıcılar izin vermez */ }
    } catch (ex) { /* kullanıcı iptal edebilir */ }
  });
  document.addEventListener('fullscreenchange', () => {
    fullBtn.textContent = document.fullscreenElement ? '↩️ Çık' : '⛶ Tam Ekran';
    resizeCanvas();
  });

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
  const eggSize = () => charW();

  const GRAVITY = 2100;
  const JUMP_V = 780;

  let state = null;
  let rafId = null;
  let lastTime = 0;
  let animTime = 0;
  let running = false;
  let paused = false;
  let currentMode = 'classic';
  let modeConfig = null;
  let arenaWs = null;
  const SANDBOX_KEY = 'yy_sandbox_v1';
  let sandboxSettings = { speed: 300, gap: 1.0, jump: 780, immortal: false };
  try {
    const saved = JSON.parse(store.get(SANDBOX_KEY));
    if (saved) sandboxSettings = { ...sandboxSettings, ...saved };
  } catch (e) { /* bozuk kayıt */ }

  function freshState() {
    return {
      top: groundY() - charH(),
      vy: 0,
      jumping: false,
      eggs: [],
      spawnTimer: 0.4 + Math.random() * 0.6,
      score: 0,
      distance: 0,
      speed: 300,
    };
  }

  function startGame(mode = 'classic', config = null) {
    currentMode = mode;
    modeConfig = config;
    state = freshState();
    if (mode === 'sandbox') state.spawnTimer = 0.3 + Math.random() * Math.min(0.6, sandboxSettings.gap);
    paused = false;
    $('pauseOverlay').classList.remove('show');
    $('liveScore').textContent = '0';
    $('arenaHud').hidden = mode !== 'arena';
    if (mode === 'arena') connectArena();
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
      state.vy = -(currentMode === 'sandbox' ? sandboxSettings.jump : JUMP_V);
      state.jumping = true;
    }
  }

  function gameOver() {
    stopGame();
    const score = state.score;
    if (currentMode === 'arena') reportArenaScore(score);
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

    if (currentMode === 'sandbox') s.speed = sandboxSettings.speed;
    else if (currentMode === 'story' && modeConfig) s.speed = Math.min(700, modeConfig.speed + s.score * 4);
    else s.speed = Math.min(620, 300 + s.score * 6);
    s.distance += s.speed * dt;

    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      // Rastgele dalga: bazen tek, bazen 2-3 patlıcan arka arkaya
      const r = Math.random();
      let count = 1;
      if (currentMode === 'story' && modeConfig) {
        if (modeConfig.triple && r < 0.12) count = 3;
        else if (modeConfig.double && r < 0.3) count = 2;
      } else if (currentMode !== 'sandbox') {
        if (s.score > 4 && r < 0.25) count = 2;
        if (s.score > 12 && r < 0.08) count = 3;
      }

      const spacing = es * (1.7 + Math.random() * 0.7);
      for (let i = 0; i < count; i++) {
        s.eggs.push({ x: W + 20 + i * (spacing + Math.random() * 25), counted: false });
      }

      let minGap, variance;
      if (currentMode === 'sandbox') {
        minGap = sandboxSettings.gap;
        variance = 0.2;
      } else if (currentMode === 'story' && modeConfig) {
        minGap = Math.max(0.45, modeConfig.gap - s.score * 0.008);
        variance = modeConfig.variance;
      } else {
        minGap = Math.max(0.4, 1.4 - s.score * 0.018);
        variance = count > 1 ? 1.1 : 0.75;
      }
      s.spawnTimer = minGap + Math.random() * variance;
    }

    for (let i = s.eggs.length - 1; i >= 0; i--) {
      const egg = s.eggs[i];
      egg.x -= s.speed * dt;

      if (!egg.counted && egg.x + es < cx) {
        egg.counted = true;
        s.score++;
        $('liveScore').textContent = s.score;
        if (currentMode === 'arena') reportArenaScore(s.score);
        if (currentMode === 'story' && modeConfig && s.score >= modeConfig.target) {
          completeStory();
          return;
        }
      }

      const charBottom = s.top + ch;
      const eggTop = g - es * 0.95;
      if (egg.x < cx + cw * 0.92 && egg.x + es * 0.9 > cx + cw * 0.08) {
        if (charBottom > eggTop + 4) {
          if (!(currentMode === 'sandbox' && sandboxSettings.immortal)) { gameOver(); return; }
        }
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

    // ---- Beyaz gökyüzü ----
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#ffffff');
    sky.addColorStop(0.7, '#f8fafc');
    sky.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // ---- Bulutlar (yavaş paralaks) ----
    ctx.fillStyle = '#e2e8f0';
    const cSpan = W + 400;
    for (let i = 0; i < 4; i++) {
      let bx = i * 230 + 80 - ((s.distance * 0.05) % cSpan);
      bx = ((bx % cSpan) + cSpan) % cSpan - 200;
      ctx.beginPath();
      ctx.ellipse(bx, H * 0.13, 58, 17, 0, 0, Math.PI * 2);
      ctx.ellipse(bx + 40, H * 0.12, 42, 21, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Uzak tepeler ----
    ctx.fillStyle = '#dcfce7';
    const farStep = 250, farOff = (s.distance * 0.12) % farStep;
    for (let x = -farStep - farOff; x < W + farStep; x += farStep) {
      ctx.beginPath();
      ctx.moveTo(x, g);
      ctx.quadraticCurveTo(x + farStep / 2, g - H * 0.3, x + farStep, g);
      ctx.closePath();
      ctx.fill();
    }

    // ---- Yakın tepeler ----
    ctx.fillStyle = '#bbf7d0';
    const nearStep = 180, nearOff = (s.distance * 0.25) % nearStep;
    for (let x = -nearStep - nearOff; x < W + nearStep; x += nearStep) {
      ctx.beginPath();
      ctx.moveTo(x, g);
      ctx.quadraticCurveTo(x + nearStep / 2, g - H * 0.17, x + nearStep, g);
      ctx.closePath();
      ctx.fill();
    }

    // ---- Çam ağaçları ----
    const treeStep = 150, treeOff = (s.distance * 0.45) % treeStep;
    for (let x = -treeStep - treeOff; x < W + treeStep; x += treeStep) {
      const th = H * 0.15;
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(x + 26, g - th * 0.35, 5, th * 0.35);
      ctx.beginPath();
      ctx.moveTo(x + 28, g - th);
      ctx.lineTo(x + 8, g - th * 0.18);
      ctx.lineTo(x + 48, g - th * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 28, g - th * 0.78);
      ctx.lineTo(x + 12, g - th * 0.05);
      ctx.lineTo(x + 44, g - th * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    // ---- Zemin: çim + toprak yol ----
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, g, W, H - g);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, g + 7, W, H - g - 7);
    ctx.fillStyle = '#86efac';
    ctx.fillRect(0, g, W, 7);
    ctx.fillStyle = 'rgba(253,230,138,0.35)';
    const dash = 40, gap = 30, period = dash + gap;
    const offset = (s.distance % period);
    for (let x = -offset; x < W; x += period) {
      ctx.fillRect(x, g + (H - g) * 0.5, dash, 3);
    }

    // ---- Patlıcanlar (beyaz zeminde net görünsün: gölge halka + kontur) ----
    ctx.font = es + 'px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(15,23,42,0.25)';
    for (const egg of s.eggs) {
      ctx.beginPath();
      ctx.arc(egg.x + es * 0.45, g - es * 0.5, es * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,23,42,0.10)';
      ctx.fill();
      ctx.fillText('🍆', egg.x, g - 2);
      ctx.strokeText('🍆', egg.x, g - 2);
    }

    drawRunner(s.top, cw, ch, cx, g);
  }

  function drawRunner(top, w, h, x, g) {
    const air = state.jumping;
    const moving = running && !paused;
    const phase = animTime * 12;
    const bob = moving && !air ? Math.abs(Math.sin(phase)) * h * 0.025 : 0;
    const y = top + bob;
    const cx = x + w / 2;
    const headR = w * 0.3;
    const headCy = y + headR + h * 0.02;
    const hipY = y + h * 0.52;
    const shoulderY = y + h * 0.3;
    const legLen = g - hipY;

    // Yer gölgesi
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, g + 2, w * (air ? 0.35 : 0.5), h * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Hız çizgileri
    if (moving) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ly = y + h * (0.25 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x - 6 - (i % 2) * 12, ly);
        ctx.lineTo(x - 32 - (i % 2) * 12, ly);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Bacaklar: kalça -> diz -> ayak, dönüşümlü adım
    for (const side of [-1, 1]) {
      const p = phase + (side === -1 ? 0 : Math.PI);
      const s = Math.sin(p), c = Math.cos(p);
      const hipX = cx + side * w * 0.11;
      const footX = hipX + s * w * 0.6;
      const lift = Math.max(0, c) * h * 0.16;
      const footY = (air ? hipY + legLen * 0.65 : g - 2) - lift;
      const kneeX = (hipX + footX) / 2 + side * w * 0.05;
      const kneeY = (hipY + footY) / 2 + h * 0.03;

      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = Math.max(5, w * 0.17);
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.stroke();

      ctx.strokeStyle = '#f1c27d';
      ctx.lineWidth = Math.max(4, w * 0.13);
      ctx.beginPath();
      ctx.moveTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(footX + 2, footY, w * 0.13, h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Kollar: bacakların ters yönde, dirsekten bükük
    for (const side of [-1, 1]) {
      const p = phase + (side === -1 ? Math.PI : 0);
      const s = Math.sin(p);
      const shX = cx + side * w * 0.25;
      const elX = shX + s * w * 0.22;
      const elY = shoulderY + h * 0.12;
      const handX = elX - s * w * 0.06;
      const handY = elY - h * 0.06;
      ctx.strokeStyle = '#f1c27d';
      ctx.lineWidth = Math.max(4, w * 0.1);
      ctx.beginPath();
      ctx.moveTo(shX, shoulderY);
      ctx.lineTo(elX, elY);
      ctx.lineTo(handX, handY);
      ctx.stroke();
    }

    // Gövde
    ctx.fillStyle = '#22d3ee';
    roundRect(cx - w * 0.27, shoulderY - h * 0.04, w * 0.54, hipY - shoulderY + h * 0.1, w * 0.16);
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

  /* ============================================================
     Modlar: hikaye / canlı arena / sandbox
     ============================================================ */
  function completeStory() {
    stopGame();
    const lvl = modeConfig.level;
    api('/api/story/complete', { method: 'POST', body: { level: lvl } })
      .then((d) => { if (profile) profile.storyLevel = d.storyLevel; })
      .catch(() => {});
    const last = lvl >= STORY_LEVELS.length;
    $('storyResultIcon').textContent = last ? '🏆' : '🎉';
    $('storyResultTitle').textContent = last ? 'Hikaye Tamamlandı!' : 'Bölüm Tamamlandı!';
    $('storyResultText').textContent = STORY_LEVELS[lvl - 1].endText;
    $('storyNextBtn').hidden = last;
    show('storyResult');
  }

  function connectArena() {
    if (arenaWs && arenaWs.readyState <= 1) return;
    try {
      const url = API.replace(/^https/, 'wss') + '/ws/arena?token=' + encodeURIComponent(token);
      arenaWs = new WebSocket(url);
      arenaWs.onopen = () => {
        $('arenaStatus').textContent = 'Bağlısın!';
        if (profile && profile.face) arenaWs.send(JSON.stringify({ type: 'face', face: profile.face }));
        reportArenaScore(state ? state.score : 0);
      };
      arenaWs.onmessage = (e) => {
        try { const m = JSON.parse(e.data); if (m.type === 'arena') renderArena(m.players); } catch (err) {}
      };
      arenaWs.onclose = () => { arenaWs = null; $('arenaStatus').textContent = 'Bağlantı kapandı.'; };
      arenaWs.onerror = () => { $('arenaStatus').textContent = 'Bağlantı hatası.'; };
    } catch (e) {
      $('arenaStatus').textContent = 'Bu tarayıcı desteklenmiyor.';
    }
  }

  function reportArenaScore(score) {
    if (arenaWs && arenaWs.readyState === 1) {
      arenaWs.send(JSON.stringify({ type: 'score', score }));
    }
  }

  function closeArena() {
    if (arenaWs) { try { arenaWs.close(); } catch (e) {} arenaWs = null; }
  }

  function renderArena(players) {
    const hud = $('arenaHud');
    hud.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'arena-hud-title';
    title.textContent = '🌍 CANLI ARENA';
    hud.appendChild(title);
    players.slice(0, 6).forEach((p) => {
      const row = document.createElement('div');
      row.className = 'arena-hud-row';
      if (profile && p.name === profile.username) row.classList.add('me');
      const nm = document.createElement('span');
      nm.textContent = (p.rank === 1 ? '🥇 ' : p.rank + '. ') + p.name;
      const sc = document.createElement('strong');
      sc.textContent = p.score;
      row.append(nm, sc);
      hud.appendChild(row);
    });

    const list = $('arenaPlayers');
    if (list && screens.arena.classList.contains('active')) {
      list.innerHTML = '';
      if (!players.length) list.innerHTML = '<p class="leader-empty">Henüz kimse bağlı değil.</p>';
      players.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'admin-row';
        const rank = document.createElement('span');
        rank.className = 'admin-rank';
        rank.textContent = '#' + p.rank;
        const name = document.createElement('strong');
        name.textContent = p.name + (profile && p.name === profile.username ? ' (sen)' : '');
        const score = document.createElement('span');
        score.className = 'admin-stats';
        score.textContent = p.score + ' yarrak';
        row.append(rank, name, score);
        list.appendChild(row);
      });
    }
  }

  function openStory() {
    const list = $('storyList');
    const unlocked = profile ? profile.storyLevel : 1;
    list.innerHTML = '';
    STORY_LEVELS.forEach((cfg, i) => {
      const lvl = i + 1;
      const locked = lvl > unlocked;
      const row = document.createElement('div');
      row.className = 'admin-row story-row' + (locked ? ' locked' : '');
      const num = document.createElement('span');
      num.className = 'admin-rank';
      num.textContent = locked ? '🔒' : lvl;
      const info = document.createElement('div');
      info.style.flex = '1';
      const t = document.createElement('strong');
      t.textContent = cfg.title;
      const d = document.createElement('small');
      d.className = 'story-desc';
      d.textContent = cfg.desc + ' · Hedef: ' + cfg.target;
      info.append(t, d);
      const btn = document.createElement('button');
      btn.className = 'mini-btn approve';
      btn.textContent = locked ? 'Kilitli' : 'Oyna';
      if (!locked) btn.addEventListener('click', () => startGame('story', { ...cfg, level: lvl }));
      row.append(num, info, btn);
      list.appendChild(row);
    });
    show('story');
  }

  function updateSandboxLabels() {
    $('sandboxSpeedVal').textContent = $('sandboxSpeed').value;
    $('sandboxGapVal').textContent = (Number($('sandboxGap').value) / 100).toFixed(1);
    $('sandboxJumpVal').textContent = $('sandboxJump').value;
  }

  function openSandbox() {
    $('sandboxSpeed').value = sandboxSettings.speed;
    $('sandboxGap').value = Math.round(sandboxSettings.gap * 100);
    $('sandboxJump').value = sandboxSettings.jump;
    $('sandboxImmortal').checked = sandboxSettings.immortal;
    updateSandboxLabels();
    show('sandbox');
  }

  function saveSandboxSettings() {
    sandboxSettings = {
      speed: Number($('sandboxSpeed').value),
      gap: Number($('sandboxGap').value) / 100,
      jump: Number($('sandboxJump').value),
      immortal: $('sandboxImmortal').checked,
    };
    store.set(SANDBOX_KEY, JSON.stringify(sandboxSettings));
  }

  /* ============================================================
     Input
     ============================================================ */
  $('startBtn').addEventListener('click', () => startGame());
  $('retryBtn').addEventListener('click', () => startGame());
  $('menuBtn').addEventListener('click', enterMenu);

  $('storyBtn').addEventListener('click', openStory);
  $('storyBackBtn').addEventListener('click', enterMenu);
  $('storyResultMenuBtn').addEventListener('click', enterMenu);
  $('storyNextBtn').addEventListener('click', () => {
    const next = (modeConfig ? modeConfig.level : 1) + 1;
    const cfg = STORY_LEVELS[next - 1];
    if (cfg) startGame('story', { ...cfg, level: next });
    else enterMenu();
  });

  $('arenaBtn').addEventListener('click', () => {
    $('arenaStatus').textContent = 'Bağlanıyor...';
    connectArena();
    show('arena');
  });
  $('arenaStartBtn').addEventListener('click', () => startGame('arena'));
  $('arenaBackBtn').addEventListener('click', () => { closeArena(); enterMenu(); });

  $('sandboxBtn').addEventListener('click', openSandbox);
  $('sandboxBackBtn').addEventListener('click', enterMenu);
  ['sandboxSpeed', 'sandboxGap', 'sandboxJump'].forEach((id) => {
    $(id).addEventListener('input', updateSandboxLabels);
  });
  $('sandboxStartBtn').addEventListener('click', () => { saveSandboxSettings(); startGame('sandbox'); });
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
     Başlangıç: güncelleme kontrolü + kayıtlı oturum
     ============================================================ */
  (async () => {
    try {
      const res = await fetch('version.json?_=' + Date.now());
      const v = await res.json();
      if (v.version > APP_VERSION && location.search.indexOf('updated=') === -1) {
        location.replace(location.pathname + '?updated=' + Date.now());
        return;
      }
    } catch (e) { /* dosya yoksa eski sürümle devam */ }

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
