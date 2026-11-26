(() => {
  'use strict';

  /* ============================================================
     API & oturum
     ============================================================ */
  const API = 'https://yedigimiz-yarraklar-api.ilhamiustun.workers.dev';
  const APP_VERSION = 42;

  const LEADER_TITLES = [
    'Obsidyen Yarrak Bükücü',
    'Sauronun Tek Yarrağı',
    'Kratosun Son Taşşağı',
    'Yarrak Kenobi',
    '404 Yarrak Not Found',
    'Kozmik Yarrak Kontu',
  ];

  const SKINS = [
    { base: '#fde3c4', dark: '#e5b98f' },
    { base: '#f0c49a', dark: '#d9a06d' },
    { base: '#f0a468', dark: '#d4803f' },
    { base: '#c98a5e', dark: '#a86b42' },
    { base: '#97643f', dark: '#7b4d2e' },
    { base: '#6b4226', dark: '#53321c' },
  ];
  const SHOES = [
    { upper: '#78350f', sole: '#f8fafc' },
    { upper: '#111827', sole: '#f8fafc' },
    { upper: '#dc2626', sole: '#ffffff' },
    { upper: '#2563eb', sole: '#ffffff' },
    { upper: '#16a34a', sole: '#ffffff' },
    { upper: '#a855f7', sole: '#ffffff' },
  ];

  const ROASTS = [
    'Sikim hıyar desem tuzla koşarsın.',
    'Sen kadıya derdini anlattım ama kadi sikini salladı.',
    'Elin sikini görmedin ve kendininkini piyade tüfeği sandın işte şimdi yarrağı yedin.',
    'Fakirin karnı doyunca siki kalkarmış.',
    'Nenen pekmez kaynattı deden sikini oynattı.',
    'Senin gözüne inen perdenin kornişine sokayım.',
    'Garibanın siki kalktımı, amın önüne duvar örülürmüş.',
  ];

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
    appearance: $('appearanceScreen'),
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
    renderCoins();
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
  async function loadLeaderboard() {
    const list = $('leaderList');
    list.innerHTML = '<p class="hint">Yükleniyor...</p>';
    try {
      const data = await api('/api/leaderboard', { auth: false });
      list.innerHTML = '';
      const donutBox = $('donutBox');
      if (data.mostDonuts && data.mostDonuts.donuts > 0) {
        donutBox.hidden = false;
        $('donutName').textContent = data.mostDonuts.username;
        $('donutStats').textContent = data.mostDonuts.donuts + ' donut · ' + data.mostDonuts.coins + ' 💰 biriktirdi';
      } else {
        donutBox.hidden = true;
      }
      const worstBox = $('worstBox');
      if (data.mostEaten) {
        worstBox.hidden = false;
        $('worstName').textContent = data.mostEaten.username;
        $('worstStats').textContent = data.mostEaten.eaten + ' yarrak yedi · en iyi: ' + data.mostEaten.best;
      } else {
        worstBox.hidden = true;
      }
      $('myEaten').textContent = (profile && profile.eaten) || 0;
      if (!data.users.length) {
        list.innerHTML = '<p class="leader-empty">Henüz kimse yarraktan kaçamadı.</p>';
        return;
      }
      data.users.forEach((u, i) => {
        const row = document.createElement('div');
        row.className = 'admin-row leader-row';
        const rank = document.createElement('span');
        rank.className = 'admin-rank';
        rank.textContent = '#' + (i + 1);
        const name = document.createElement('strong');
        name.textContent = u.username;
        if (i < LEADER_TITLES.length) {
          const title = document.createElement('span');
          title.className = 'leader-title rank-' + (i + 1);
          title.textContent = LEADER_TITLES[i];
          name.appendChild(title);
        }
        const stats = document.createElement('span');
        stats.className = 'admin-stats leader-stats';
        const line1 = document.createElement('span');
        const rankScore = (u.total_dodged || 0) + (u.donuts || 0);
        line1.textContent = '🏆 ' + rankScore + ' puan · ' + u.total_dodged + ' kaçış + 🍩' + u.donuts;
        const line2 = document.createElement('span');
        line2.textContent = '💰' + u.coins + ' · 🏃' + u.best + ' en iyi · 😵' + u.eaten + ' · 🎮' + u.games;
        stats.append(line1, line2);
        row.append(rank, name, stats);
        list.appendChild(row);
      });
    } catch (err) {
      list.textContent = err.message;
    }
  }

  $('leaderBtn').addEventListener('click', () => { show('leader'); loadLeaderboard(); });
  $('leaderBackBtn').addEventListener('click', enterMenu);

  $('eatenAddBtn').addEventListener('click', async () => {
    const amount = Number($('eatenAmount').value);
    const status = $('eatenStatus');
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      status.textContent = 'Miktar 1 ile 10000 arasında olmalı.';
      return;
    }
    $('eatenAddBtn').disabled = true;
    try {
      const data = await api('/api/eaten', { method: 'POST', body: { amount } });
      if (profile) profile.eaten = data.eaten;
      $('myEaten').textContent = data.eaten;
      $('eatenAmount').value = '1';
      status.innerHTML = '✓ ' + data.added + ' yarrak eklendi. Toplam: <strong>' + data.eaten + '</strong>';
      loadLeaderboard();
    } catch (err) {
      status.textContent = err.message;
    } finally {
      $('eatenAddBtn').disabled = false;
    }
  });

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

  let adminTargetId = null;

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

    const passBtn = document.createElement('button');
    passBtn.className = 'mini-btn approve';
    passBtn.textContent = '🔑 Şifre';
    passBtn.addEventListener('click', () => {
      adminTargetId = u.id;
      $('adminPassBox').hidden = false;
      $('adminPassTarget').textContent = u.username;
      $('adminNewPass').value = '';
      $('adminPassStatus').textContent = '';
      $('adminPassStatus').style.color = '';
    });
    actions.appendChild(passBtn);

    const coinsBtn = document.createElement('button');
    coinsBtn.className = 'mini-btn approve';
    coinsBtn.textContent = '💰 Puan';
    coinsBtn.addEventListener('click', () => {
      adminTargetId = u.id;
      $('adminCoinsBox').hidden = false;
      $('adminCoinsTarget').textContent = u.username;
      $('adminCoinsAmount').value = '50';
      $('adminCoinsStatus').textContent = '';
      $('adminCoinsStatus').style.color = '';
    });
    actions.appendChild(coinsBtn);

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

  $('adminPassCancel').addEventListener('click', () => { $('adminPassBox').hidden = true; });
  $('adminPassSave').addEventListener('click', async () => {
    const pw = $('adminNewPass').value;
    const st = $('adminPassStatus');
    st.style.color = '';
    if (pw.length < 4) { st.textContent = 'Şifre en az 4 karakter olmalı.'; return; }
    $('adminPassSave').disabled = true;
    try {
      await api('/api/admin/password', { method: 'POST', body: { id: adminTargetId, password: pw } });
      st.style.color = '#86efac';
      st.textContent = '✓ Şifre değiştirildi.';
      $('adminNewPass').value = '';
    } catch (err) {
      st.textContent = err.message;
    } finally {
      $('adminPassSave').disabled = false;
    }
  });

  $('adminCoinsCancel').addEventListener('click', () => { $('adminCoinsBox').hidden = true; });
  $('adminCoinsSave').addEventListener('click', async () => {
    const amount = Number($('adminCoinsAmount').value);
    const st = $('adminCoinsStatus');
    st.style.color = '';
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      st.textContent = 'Puan 1 ile 10000 arasında olmalı.';
      return;
    }
    $('adminCoinsSave').disabled = true;
    try {
      const data = await api('/api/admin/coins', {
        method: 'POST', body: { id: adminTargetId, amount },
      });
      st.style.color = '#86efac';
      st.textContent = '✓ ' + data.added + ' 💰 eklendi. Yeni bakiye: ' + data.coins;
    } catch (err) {
      st.textContent = err.message;
    } finally {
      $('adminCoinsSave').disabled = false;
    }
  });

  /* ============================================================
     Ayarlar: şifre değiştir (admin dahil)
     ============================================================ */
  function renderCoins() {
    $('coinBalance').textContent = (profile && profile.coins) || 0;
  }

  function renderCape() {
    const owned = !!(profile && profile.capeOwned);
    const active = !!(profile && profile.capeActive);
    $('capeBtn').textContent = !owned ? 'Satın Al' : active ? 'Çıkar' : 'Giy';
    $('capeDesc').textContent = !owned
      ? 'Karakterinin arkasında dalgalanan pelerin · 500 💰'
      : active ? '🛡️ Pelerin giyili — koşarken dalgalanıyor.' : 'Pelerin dolabında bekliyor.';
  }

  $('capeBtn').addEventListener('click', async () => {
    const action = profile && profile.capeOwned ? 'toggle' : 'buy';
    const btn = $('capeBtn');
    btn.disabled = true;
    try {
      const data = await api('/api/cape', { method: 'POST', body: { action } });
      profile.capeOwned = data.owned;
      profile.capeActive = data.active;
      profile.coins = data.coins;
      $('capeStatus').textContent = action === 'buy'
        ? '✓ Pelerin satın alındı ve giyildi! (-500 💰)'
        : data.active ? '✓ Pelerin giyildi.' : '✓ Pelerin çıkarıldı.';
      renderCoins();
      renderCape();
    } catch (err) {
      $('capeStatus').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  function renderSwatches() {
    const skin = (profile && profile.skinTone) || 0;
    const shoe = (profile && profile.shoeColor) || 0;
    const ownedSkins = (profile && profile.ownedSkins) || 1;
    const ownedShoes = (profile && profile.ownedShoes) || 1;
    const skinBox = $('skinSwatches');
    const shoeBox = $('shoeSwatches');
    skinBox.innerHTML = '';
    shoeBox.innerHTML = '';
    SKINS.forEach((s, i) => {
      const owned = !!(ownedSkins & (1 << i));
      const b = document.createElement('button');
      b.className = 'swatch' + (i === skin ? ' selected' : '') + (owned ? '' : ' locked');
      b.style.background = s.base;
      b.title = owned ? 'Ten rengi' : '50 💰 ile aç';
      b.textContent = owned ? '' : '🔒';
      b.addEventListener('click', () => saveAppearance(i, shoe));
      skinBox.appendChild(b);
    });
    SHOES.forEach((s, i) => {
      const owned = !!(ownedShoes & (1 << i));
      const b = document.createElement('button');
      b.className = 'swatch' + (i === shoe ? ' selected' : '') + (owned ? '' : ' locked');
      b.style.background = s.upper;
      b.title = owned ? 'Ayakkabı' : '30 💰 ile aç';
      b.textContent = owned ? '' : '🔒';
      b.addEventListener('click', () => saveAppearance(skin, i));
      shoeBox.appendChild(b);
    });
    $('appearanceCoins').textContent = (profile && profile.coins) || 0;
    $('appearanceDonuts').textContent = (profile && profile.donuts) || 0;
  }

  async function saveAppearance(skinTone, shoeColor) {
    try {
      const data = await api('/api/appearance', {
        method: 'POST', body: { skinTone, shoeColor },
      });
      profile.skinTone = data.skinTone;
      profile.shoeColor = data.shoeColor;
      profile.coins = data.coins;
      profile.ownedSkins = data.ownedSkins;
      profile.ownedShoes = data.ownedShoes;
      $('appearanceStatus').textContent = data.cost
        ? '✓ Yeni renk açıldı! (-' + data.cost + ' 💰) Kalan: ' + data.coins
        : '✓ Görünüm kaydedildi.';
      renderCoins();
      renderSwatches();
    } catch (err) {
      $('appearanceStatus').textContent = err.message;
    }
  }

  function openAppearance() {
    $('appearanceStatus').textContent = '';
    $('capeStatus').textContent = '';
    renderSwatches();
    renderCape();
    show('appearance');
  }

  $('appearanceBtn').addEventListener('click', openAppearance);
  $('toAppearanceBtn').addEventListener('click', openAppearance);
  $('appearanceBackBtn').addEventListener('click', enterMenu);

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
  let skyGradient = null;

  function resizeCanvas() {
    const r = $('canvasWrap').getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(220, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    skyGradient = ctx.createLinearGradient(0, 0, 0, H);
    skyGradient.addColorStop(0, '#ffffff');
    skyGradient.addColorStop(0.7, '#f8fafc');
    skyGradient.addColorStop(1, '#e2e8f0');
    if (state && state.onGround) state.top = groundY() - charH();
  }
  window.addEventListener('resize', resizeCanvas);

  const groundY = () => H * 0.82;
  const charW = () => Math.max(40, Math.min(70, W * 0.1));
  const charH = () => charW() * 1.4;
  const charX = () => W * 0.16;
  const eggSize = () => charW();

  const GRAVITY = 2100;
  const JUMP_V = 780;
  const FIXED_DT = 1 / 60;
  const JUMP_BUFFER = 0.12;
  const COYOTE_TIME = 0.1;

  let state = null;
  let rafId = null;
  let lastTime = 0;
  let animTime = 0;
  let running = false;
  let paused = false;
  let jumpHeld = false;
  let jumpBuffer = 0;
  let accumulator = 0;
  let currentMode = 'classic';
  let modeConfig = null;
  let arenaWs = null;
  let arenaReady = false;
  let arenaCountdownTimer = null;
  let arenaPlayers = [];
  let lastArenaRender = 0;
  const arenaFaceImgs = {};
  const arenaLooks = {};
  const FIRST_HEAD_START_SEC = 0.5;
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
      onGround: true,
      coyote: COYOTE_TIME,
      airJumpsUsed: 0,
      squash: 0,
      jumpStretch: 0,
      eggs: [],
      floaters: [],
      particles: [],
      flyTimer: 5 + Math.random() * 8,
      flyDone: false,
      fly: null,
      spawnDist: W * 0.35 + Math.random() * W * 0.2,
      score: 0,
      distance: 0,
      speed: 300,
    };
  }

  function startGame(mode = 'classic', config = null) {
    currentMode = mode;
    modeConfig = config;
    state = freshState();
    if (mode === 'sandbox') state.spawnDist = state.speed * sandboxSettings.gap * (0.3 + Math.random() * 0.4);
    accumulator = 0;
    jumpBuffer = 0;
    jumpHeld = false;
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

  function jumpPower() {
    return currentMode === 'sandbox' ? sandboxSettings.jump : JUMP_V;
  }

  function burstDust(x, y, count, scale) {
    if (!state) return;
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x: x + (Math.random() - 0.5) * charW() * 0.5,
        y: y - Math.random() * 4,
        vx: (Math.random() - 0.7) * 90 * scale,
        vy: -Math.random() * 70 * scale,
        life: 0.45 + Math.random() * 0.25,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function startJump(kind) {
    const s = state;
    s.vy = -jumpPower() * (kind === 'air' ? 0.9 : 1);
    s.onGround = false;
    s.coyote = 0;
    s.jumpStretch = 1;
    s.airJumpsUsed = kind === 'air' ? s.airJumpsUsed + 1 : 0;
    jumpBuffer = 0;
    burstDust(charX() + charW() / 2, groundY(), kind === 'air' ? 3 : 5, 1);
  }

  function pressJump() {
    if (!running || paused || !state) return;
    jumpHeld = true;
    jumpBuffer = JUMP_BUFFER;
    const s = state;
    if (s.onGround || s.coyote > 0) startJump('ground');
    else if (s.airJumpsUsed < 1) startJump('air');
  }

  function releaseJump() {
    if (!jumpHeld) return;
    jumpHeld = false;
    // Kısa basış = kısa zıplama, uzun basış = tam zıplama
    if (state && state.vy < -200) state.vy *= 0.78;
  }

  function gameOver() {
    stopGame();
    const score = state.score;
    if (currentMode === 'arena') reportArenaScore(score);
    $('arenaReturnBtn').hidden = currentMode !== 'arena';
    $('finalScore').textContent = score;
    $('overText').textContent =
      'Bugün ' + score + ' yarraktan kaçtın ama en sonunda yarrağı yedin!';
    $('roastText').textContent = ROASTS[Math.floor(Math.random() * ROASTS.length)];
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
      accumulator = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function loop(now) {
    if (!running || paused) return;
    const frameDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += frameDt;
    while (accumulator >= FIXED_DT && running) {
      animTime += FIXED_DT;
      update(FIXED_DT);
      accumulator -= FIXED_DT;
    }
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

    // Jump buffer: yere inmeden hemen önce yapılan basışı hatırla
    if (jumpBuffer > 0) {
      jumpBuffer = Math.max(0, jumpBuffer - dt);
      if (s.onGround || s.coyote > 0) startJump('ground');
      else if (s.airJumpsUsed < 1) startJump('air');
    }

    // Coyote time (kısa tolerans)
    if (s.onGround) s.coyote = COYOTE_TIME;
    else s.coyote = Math.max(0, s.coyote - dt);

    // Değişken zıplama: bırakıldığında aşağı doğru daha güçlü, tepe noktasında askıda kalma
    let grav = GRAVITY;
    if (s.vy < 0 && !jumpHeld) grav *= 1.4;
    else if (Math.abs(s.vy) < 190) grav *= 0.6;
    s.vy = Math.min(1600, s.vy + grav * dt);
    s.top += s.vy * dt;

    if (s.top >= g - ch) {
      const impact = s.vy;
      s.top = g - ch;
      s.vy = 0;
      if (!s.onGround) {
        s.onGround = true;
        s.airJumpsUsed = 0;
        s.squash = Math.min(1, 0.35 + impact / 1100);
        burstDust(cx + cw / 2, g, 6, 1);
      }
      s.coyote = COYOTE_TIME;
    } else {
      s.onGround = false;
    }
    s.squash = Math.max(0, s.squash - dt * 4.5);
    s.jumpStretch = Math.max(0, s.jumpStretch - dt * 5);

    if (currentMode === 'sandbox') s.speed = sandboxSettings.speed;
    else if (currentMode === 'story' && modeConfig) s.speed = Math.min(700, modeConfig.speed + s.score * 4);
    else s.speed = Math.min(620, 300 + s.score * 6);
    s.distance += s.speed * dt;

    // Mesafeye göre spawn: hız arttığında boşluklar daralmaz
    s.spawnDist -= s.speed * dt;
    if (s.spawnDist <= 0) {
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
        const moving = Math.random() < 0.35;
        s.eggs.push({
          x: W + 20 + i * (spacing + Math.random() * 25),
          counted: false,
          kind: Math.random() < 0.35 ? 'banana' : 'eggplant',
          moving,
          phase: Math.random() * Math.PI * 2,
          freq: 1.6 + Math.random() * 1.8,
          amp: moving ? es * (0.4 + Math.random() * 0.7) : 0,
          lift: 0,
          speedMul: moving ? 0.85 + Math.random() * 0.35 : 1,
        });
      }

      // Zıplayınca toplanan donut'lar
      if (Math.random() < 0.32) {
        s.eggs.push({
          x: W + 20 + spacing * (0.5 + Math.random() * 0.8),
          counted: false,
          kind: 'donut',
          moving: false,
          phase: 0,
          freq: 0,
          amp: 0,
          lift: es * (1.55 + Math.random() * 0.4),
          speedMul: 1,
        });
      }

      let minGap, variance;
      if (currentMode === 'sandbox') {
        minGap = sandboxSettings.gap;
        variance = 0.2;
      } else if (currentMode === 'story' && modeConfig) {
        minGap = Math.max(0.5, modeConfig.gap - s.score * 0.008);
        variance = modeConfig.variance;
      } else {
        minGap = 1.15;
        variance = count > 1 ? 0.8 : 0.7;
      }
      // En az 0.85 sn'lik iniş+tekrar zıplama payı bırak (çözülebilirlik)
      minGap = Math.max(minGap, 0.85);
      s.spawnDist = s.speed * (minGap + Math.random() * variance);
    }

    for (let i = s.eggs.length - 1; i >= 0; i--) {
      const egg = s.eggs[i];
      egg.lift = egg.kind === 'donut'
        ? egg.lift
        : (egg.amp || 0) * (0.5 + 0.5 * Math.sin(animTime * egg.freq + egg.phase));
      egg.x -= s.speed * (egg.speedMul || 1) * dt;

      const eggCx = egg.x + es * 0.45;
      const eggCy = g - es * 0.5 - egg.lift;
      const bodyCx = cx + cw * 0.5;

      // Engel çarpışması: emojinin GÖRSEL merkezine göre daraltılmış kutu.
      // Eski geniş kutu yüzünden karakter patlıcana değmeden ölüyordu.
      const hitX = Math.abs(eggCx - bodyCx) < es * 0.3 + cw * 0.3;
      const hitY = (s.top + ch * 0.25) < eggCy + es * 0.3
        && (s.top + ch * 0.95) > eggCy - es * 0.3;

      // Donut toplama: ölçülü ama biraz daha toleranslı
      const grabX = Math.abs(eggCx - bodyCx) < es * 0.45 + cw * 0.42;
      const grabY = (s.top + ch * 0.1) < eggCy + es * 0.5
        && (s.top + ch) > eggCy - es * 0.5;

      if (egg.kind === 'donut') {
        // Zıplayıp değdiğinde +2 puan
        if (!egg.counted && grabX && grabY) {
          egg.counted = true;
          egg.collected = true;
          s.score += 2;
          s.floaters.push({ x: cx, y: s.top - 8, text: '+2 🍩 +5💰', life: 1 });
          reportDonut();
          $('liveScore').textContent = s.score;
          if (currentMode === 'arena') reportArenaScore(s.score);
          if (currentMode === 'story' && modeConfig && s.score >= modeConfig.target) {
            completeStory();
            return;
          }
        }
        if (!egg.counted && egg.x + es < cx) egg.counted = true; // kaçırıldı, puan yok
      } else {
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
        if (hitX && hitY && !(currentMode === 'sandbox' && sandboxSettings.immortal)) {
          gameOver();
          return;
        }
      }
      if (egg.x < -es - 20) s.eggs.splice(i, 1);
    }

    // Yüzen puan yazıları
    for (let i = s.floaters.length - 1; i >= 0; i--) {
      const f = s.floaters[i];
      f.life -= dt * 1.2;
      f.y -= 34 * dt;
      if (f.life <= 0) s.floaters.splice(i, 1);
    }

    // Toz parçacıkları (kalkış / iniş)
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt * 2;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // Her oyunda bir kez, belirsiz bir anda tepeden geçen patlıcan
    if (!s.flyDone) {
      s.flyTimer -= dt;
      if (s.flyTimer <= 0) {
        s.flyDone = true;
        const dir = Math.random() < 0.5 ? 1 : -1;
        s.fly = { x: dir === 1 ? -es * 2 : W + es * 2, dir };
      }
    }
    if (s.fly) {
      s.fly.x += s.speed * 1.9 * s.fly.dir * dt;
      // Oyuncu zıplasa bile kafasının üstünde kalır
      s.fly.y = Math.min(g - ch, s.top) - es * 0.85 - 6;
      if (s.fly.x > W + es * 3 || s.fly.x < -es * 3) s.fly = null;
    }
  }

  /* ---------- Çizim ---------- */
  // Emoji'leri bir kez çizip offscreen canvas'a önbelleğe alıyoruz.
  // Her karede shadowBlur + strokeText çalıştırmak mobilde ciddi takılma yapıyordu.
  const emojiCache = new Map();
  function emojiSprite(icon, size) {
    const key = icon + '|' + Math.round(size);
    let sp = emojiCache.get(key);
    if (sp) return sp;
    const pad = Math.ceil(size * 0.4);
    const side = Math.ceil(size * 1.7) + pad * 2;
    const c = document.createElement('canvas');
    c.width = c.height = side;
    const g2 = c.getContext('2d');
    const baseline = size + pad;
    g2.font = size + 'px sans-serif';
    g2.textBaseline = 'alphabetic';
    g2.lineJoin = 'round';
    g2.lineWidth = Math.max(3, size * 0.07);
    g2.strokeStyle = 'rgba(255,255,255,0.95)';
    g2.shadowColor = 'rgba(15,23,42,0.28)';
    g2.shadowBlur = 6;
    g2.shadowOffsetY = 2;
    g2.strokeText(icon, pad, baseline);
    g2.shadowBlur = 0;
    g2.shadowOffsetY = 0;
    g2.lineWidth = Math.max(1.2, size * 0.025);
    g2.strokeStyle = 'rgba(15,23,42,0.35)';
    g2.strokeText(icon, pad, baseline);
    g2.fillText(icon, pad, baseline);
    sp = { canvas: c, pad, baseline };
    if (emojiCache.size > 24) emojiCache.clear();
    emojiCache.set(key, sp);
    return sp;
  }
  function drawEmoji(icon, size, x, baselineY) {
    const sp = emojiSprite(icon, size);
    ctx.drawImage(sp.canvas, x - sp.pad, baselineY - sp.baseline);
  }

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

    // ---- Beyaz gökyüzü (gradyan önbellekte) ----
    ctx.fillStyle = skyGradient || '#ffffff';
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
      ctx.beginPath();
      ctx.rect(x + 26, g - th * 0.35, 5, th * 0.35);
      ctx.moveTo(x + 28, g - th);
      ctx.lineTo(x + 8, g - th * 0.18);
      ctx.lineTo(x + 48, g - th * 0.18);
      ctx.closePath();
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

    // ---- 🍆🍌🍩 emojiler: önbelleğe alınmış sprite'lar ----
    ctx.textBaseline = 'alphabetic';
    for (const egg of s.eggs) {
      const donut = egg.kind === 'donut';
      const banana = egg.kind === 'banana';
      const icon = donut ? '🍩' : banana ? '🍌' : '🍆';
      const lift = egg.lift || 0;
      const ey = g - 2 - lift;
      const size = (donut || banana) ? es * 1.12 : es * 1.08;
      drawEmoji(icon, size, egg.x, ey);

      // Hareketli engeller için küçük yön işaretleri (halka yerine)
      if (egg.moving) {
        const ax = egg.x + es * 0.8;
        ctx.strokeStyle = 'rgba(15,23,42,0.32)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ax, ey - es * 0.42);
        ctx.lineTo(ax, ey - es * 0.2);
        ctx.moveTo(ax, ey + es * 0.2);
        ctx.lineTo(ax, ey + es * 0.42);
        ctx.stroke();
      }
    }

    // Kafanın üstünden geçen patlıcan (hız iziyle)
    if (s.fly) {
      ctx.save();
      for (let t = 1; t <= 3; t++) {
        ctx.globalAlpha = 0.28 / t;
        drawEmoji('🍆', es * 0.9, s.fly.x - s.fly.dir * t * es * 0.55, s.fly.y);
      }
      ctx.globalAlpha = 1;
      drawEmoji('🍆', es * 1.05, s.fly.x, s.fly.y);
      ctx.restore();
    }

    // ---- Arenadaki diğer oyuncular: aynı karakter, hepsi ekranda ----
    if (currentMode === 'arena' && arenaPlayers.length) {
      const firstJoin = Math.min.apply(null, arenaPlayers.map((p) => p.joinIndex || 0));
      const others = arenaPlayers
        .filter((p) => !profile || p.name !== profile.username)
        .sort((a, b) => {
          const sa = (a.score || 0) + ((a.joinIndex || 0) === firstJoin ? 2 : 0);
          const sb = (b.score || 0) + ((b.joinIndex || 0) === firstJoin ? 2 : 0);
          return sb - sa;
        });
      const gw = cw * 0.9;
      const gh = ch * 0.9;
      const laneStart = W * 0.44;
      const laneEnd = W - gw - 12;
      others.forEach((p, i) => {
        const t = others.length === 1 ? 0.5 : i / (others.length - 1);
        const centerX = laneStart + (laneEnd - laneStart) * t;
        const pPhase = animTime * 11 + i * 0.9;
        const bob = Math.abs(Math.sin(pPhase)) * gh * 0.018;
        drawRunner(g - gh - bob, gw, gh, centerX - gw / 2, g, {
          air: false,
          moving: true,
          phase: pPhase,
          face: arenaFaceImgs[p.name] || null,
          skin: arenaLooks[p.name] && arenaLooks[p.name].skin,
          shoe: arenaLooks[p.name] && arenaLooks[p.name].shoe,
          cape: arenaLooks[p.name] && arenaLooks[p.name].cape,
          squash: 0,
          stretch: 0,
        });
        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const tw = ((ctx.measureText && ctx.measureText(p.name)) || {}).width || p.name.length * 6;
        const ly = g - gh - 14 - bob;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(centerX - tw / 2 - 5, ly - 11, tw + 10, 15);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(p.name, centerX, ly);
        ctx.restore();
      });
    }

    drawRunner(s.top, cw, ch, cx, g);

    // Yüzen +2 🍩 yazıları
    s.floaters.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ec4899';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });

    // Kalkış / iniş tozları
    s.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // İki parçalı bacak için diz noktası (law of cosines)
  function elbowPoint(hx, hy, fx, fy, l1, l2, bend) {
    const dx = fx - hx, dy = fy - hy;
    const raw = Math.sqrt(dx * dx + dy * dy) || 1;
    const d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.5, raw));
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / raw, uy = dy / raw;
    return {
      x: hx + ux * a - uy * hh * bend,
      y: hy + uy * a + ux * hh * bend,
    };
  }

  function drawRunner(top, w, h, x, g, opts) {
    const o = opts || {};
    const air = o.air !== undefined ? o.air : !state.onGround;
    const moving = o.moving !== undefined ? o.moving : (running && !paused);
    const phase = o.phase !== undefined ? o.phase : animTime * 11;
    const face = o.face !== undefined ? o.face : faceImg;
    const vyNow = o.vy !== undefined ? o.vy : state.vy;
    const sq = o.squash !== undefined ? o.squash : (state.squash || 0);
    const st = o.stretch !== undefined ? o.stretch : (state.jumpStretch || 0);
    const bob = moving && !air ? Math.abs(Math.sin(phase)) * h * 0.018 : 0;
    const y = top + bob;
    const lean = moving && !air ? h * 0.05 : 0;
    const cx = x + w / 2;
    const skinPair = o.skin || SKINS[Math.min(5, (profile && profile.skinTone) || 0)] || SKINS[2];
    const shoePair = o.shoe || SHOES[Math.min(5, (profile && profile.shoeColor) || 0)] || SHOES[0];
    const skin = skinPair.base;
    const skinDark = skinPair.dark;
    const headR = w * 0.27;
    const headX = cx + lean;
    const headCy = y + headR + h * 0.01;
    const shoulderY = y + h * 0.3;
    const hipY = y + h * 0.56;
    // Bacak uzunluğu SABİT olmalı: yoksa zıplarken kalça yükseldikçe
    // "yer mesafesi" de büyür ve ayaklar yerde yapışık kalır.
    const legLen = h * 0.44;
    const thigh = legLen * 0.52;
    const shin = legLen * 0.52;
    const stride = legLen * 0.28;

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
    ctx.translate(cx, g);
    ctx.scale(1 + sq * 0.2 - st * 0.1, 1 - sq * 0.22 + st * 0.14);
    if (air) ctx.rotate(vyNow < 0 ? -0.06 : 0.06);
    ctx.translate(-cx, -g);

    // Pelerin: koşarken arkada dalgalanır
    const capeOn = o.cape !== undefined ? o.cape : !!(profile && profile.capeActive);
    if (capeOn) {
      const wave = Math.sin(phase + 0.7) * (moving ? 1 : 0.25);
      const sx = cx - w * 0.16;
      const sy = shoulderY + h * 0.02;
      ctx.save();
      const cg = ctx.createLinearGradient(sx - w, sy, sx, sy + h * 0.45);
      cg.addColorStop(0, '#7f1d1d');
      cg.addColorStop(1, '#dc2626');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx - w * 0.5, sy + h * 0.04 + wave * h * 0.05,
        sx - w * 0.95, sy + h * 0.12 + wave * h * 0.08);
      ctx.lineTo(sx - w * 0.78, sy + h * 0.4 + wave * h * 0.05);
      ctx.quadraticCurveTo(sx - w * 0.42, sy + h * 0.34, sx - w * 0.08, sy + h * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = Math.max(1.5, w * 0.025);
      ctx.stroke();
      ctx.restore();
    }

    function drawLeg(side, far) {
      const p = phase + (side === -1 ? 0 : Math.PI);
      const sw = Math.sin(p), cw = Math.cos(p);
      const stance = cw <= 0;
      const hipX = cx + side * w * 0.12;
      // Havada bacak neredeyse tam uzatılır: diz gereğinden fazla kırılmaz
      const footX = hipX + (air ? side * w * 0.06 + sw * stride * 0.3 : sw * stride);
      const footY = air
        ? hipY + legLen * 0.88 - Math.max(0, cw) * h * 0.03
        : (g - 3) - (stance ? 0 : cw * h * 0.14);
      const knee = elbowPoint(hipX, hipY, footX, footY, thigh, shin, -1);
      ctx.save();
      if (far) ctx.globalAlpha = 0.82;

      // Kalkış anında dizlerde kısa ışık patlaması
      if (st > 0.05) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, st) * (far ? 0.5 : 0.85);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(knee.x, knee.y, w * (0.05 + st * 0.05), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(knee.x, knee.y, w * 0.02, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Şort (uyluğu kapatır)
      ctx.strokeStyle = far ? '#0b5d5a' : '#0f766e';
      ctx.lineWidth = Math.max(7, w * 0.21);
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(knee.x, knee.y); ctx.stroke();

      // Baldır
      ctx.strokeStyle = far ? skinDark : skin;
      ctx.lineWidth = Math.max(5, w * 0.15);
      ctx.beginPath(); ctx.moveTo(knee.x, knee.y); ctx.lineTo(footX, footY); ctx.stroke();

      // Beyaz çorap + kırmızı şeritler
      const sx = knee.x + (footX - knee.x) * 0.62;
      const sy = knee.y + (footY - knee.y) * 0.62;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = Math.max(5, w * 0.15);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(footX, footY - 1); ctx.stroke();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = Math.max(1.5, w * 0.028);
      for (const t of [0.25, 0.55]) {
        const px = sx + (footX - sx) * t, py = sy + (footY - sy) * t;
        ctx.beginPath();
        ctx.moveTo(px - w * 0.07, py);
        ctx.lineTo(px + w * 0.07, py);
        ctx.stroke();
      }

      // Seçilen renkte ayakkabı + taban
      ctx.save();
      ctx.translate(footX, footY);
      ctx.rotate(sw * 0.18);
      ctx.fillStyle = shoePair.sole;
      roundRect(-w * 0.17, -h * 0.022, w * 0.35, h * 0.055, h * 0.02);
      ctx.fill();
      ctx.fillStyle = shoePair.upper;
      roundRect(-w * 0.16, -h * 0.055, w * 0.32, h * 0.065, h * 0.02);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    function drawArm(side, far) {
      const p = phase + (side === -1 ? Math.PI : 0);
      const sw = Math.sin(p);
      const shX = cx + side * w * 0.3 + lean * 0.5;
      const shY = shoulderY + h * 0.02;
      let elX, elY, handX, handY;
      if (air) {
        elX = shX + side * w * 0.1 + sw * w * 0.04;
        elY = shY - h * 0.04;
        handX = elX + side * w * 0.05;
        handY = elY - h * 0.16;
      } else {
        elX = shX + sw * w * 0.26;
        elY = shY + h * 0.13;
        handX = elX - sw * w * 0.08 + w * 0.05;
        handY = elY - h * 0.08;
      }
      ctx.save();
      if (far) ctx.globalAlpha = 0.85;
      ctx.fillStyle = far ? skinDark : skin;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(shX, shY, w * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(6, w * 0.16);
      ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(elX, elY); ctx.stroke();
      ctx.lineWidth = Math.max(5, w * 0.13);
      ctx.beginPath(); ctx.moveTo(elX, elY); ctx.lineTo(handX, handY); ctx.stroke();
      ctx.beginPath(); ctx.arc(handX, handY, w * 0.075, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Derinlik: arka uzuvlar önce
    drawLeg(-1, true);
    drawArm(-1, true);

    // Kaslı gövde
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.34, shoulderY);
    ctx.quadraticCurveTo(cx - w * 0.42, y + h * 0.42, cx - w * 0.2, hipY);
    ctx.lineTo(cx + w * 0.2, hipY);
    ctx.quadraticCurveTo(cx + w * 0.42, y + h * 0.42, cx + w * 0.34, shoulderY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = Math.max(1, w * 0.018);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.24, shoulderY + h * 0.07);
    ctx.quadraticCurveTo(cx - w * 0.08, shoulderY + h * 0.12, cx - w * 0.02, shoulderY + h * 0.06);
    ctx.moveTo(cx + w * 0.24, shoulderY + h * 0.07);
    ctx.quadraticCurveTo(cx + w * 0.08, shoulderY + h * 0.12, cx + w * 0.02, shoulderY + h * 0.06);
    ctx.moveTo(cx, shoulderY + h * 0.11);
    ctx.lineTo(cx, y + h * 0.44);
    ctx.stroke();

    // Ön uzuvlar
    drawLeg(1, false);
    drawArm(1, false);

    // Kafa
    ctx.save();
    ctx.beginPath();
    ctx.arc(headX, headCy, headR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.clip();
    if (face && face.complete && face.naturalWidth) {
      ctx.drawImage(face, headX - headR, headCy - headR, headR * 2, headR * 2);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(headX - headR * 0.35, headCy - headR * 0.05, headR * 0.22, headR * 0.17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(headX + headR * 0.35, headCy - headR * 0.05, headR * 0.22, headR * 0.17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.arc(headX - headR * 0.3, headCy - headR * 0.04, headR * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(headX + headR * 0.4, headCy - headR * 0.04, headR * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3f1d10';
      ctx.lineWidth = Math.max(1.5, w * 0.03);
      ctx.beginPath();
      ctx.moveTo(headX - headR * 0.58, headCy - headR * 0.33);
      ctx.lineTo(headX - headR * 0.14, headCy - headR * 0.22);
      ctx.moveTo(headX + headR * 0.16, headCy - headR * 0.22);
      ctx.lineTo(headX + headR * 0.58, headCy - headR * 0.33);
      ctx.stroke();
      ctx.strokeStyle = '#9a4a22';
      ctx.lineWidth = Math.max(1.2, w * 0.02);
      ctx.beginPath();
      ctx.arc(headX, headCy + headR * 0.18, headR * 0.38, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.restore();

    if (!(face && face.complete && face.naturalWidth)) {
      // Koyu, dik saçlar
      ctx.fillStyle = '#3f1d10';
      ctx.beginPath();
      ctx.moveTo(headX - headR * 0.98, headCy - headR * 0.2);
      ctx.quadraticCurveTo(headX - headR * 1.05, headCy - headR * 1.1, headX - headR * 0.25, headCy - headR * 1.0);
      ctx.lineTo(headX + headR * 0.05, headCy - headR * 1.38);
      ctx.lineTo(headX + headR * 0.38, headCy - headR * 0.95);
      ctx.quadraticCurveTo(headX + headR * 1.1, headCy - headR * 0.9, headX + headR * 0.95, headCy - headR * 0.1);
      ctx.quadraticCurveTo(headX + headR * 0.5, headCy - headR * 0.55, headX, headCy - headR * 0.5);
      ctx.quadraticCurveTo(headX - headR * 0.5, headCy - headR * 0.5, headX - headR * 0.98, headCy - headR * 0.2);
      ctx.closePath();
      ctx.fill();
    }
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

  function sendArena(obj) {
    if (arenaWs && arenaWs.readyState === 1) arenaWs.send(JSON.stringify(obj));
  }

  function connectArena() {
    if (arenaWs && arenaWs.readyState <= 1) return;
    try {
      const url = API.replace(/^https/, 'wss') + '/ws/arena?token=' + encodeURIComponent(token);
      arenaWs = new WebSocket(url);
      arenaWs.onopen = () => {
        $('arenaStatus').textContent = 'Bağlısın!';
        arenaReady = false;
        if (profile && profile.face) sendArena({ type: 'face', face: profile.face });
        sendArena({
          type: 'appearance',
          skinTone: (profile && profile.skinTone) || 0,
          shoeColor: (profile && profile.shoeColor) || 0,
          cape: !!(profile && profile.capeActive),
        });
        sendArena({ type: 'lobby' });
        reportArenaScore(state ? state.score : 0);
      };
      arenaWs.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'arena') {
            const t = performance.now();
            if (t - lastArenaRender > 100) {
              renderArena(m.players, m.phase, m.readyCount);
              lastArenaRender = t;
            }
          }
          else if (m.type === 'start') showArenaCountdown(m.at);
          else if (m.type === 'cancel') {
            clearArenaCountdown();
            arenaReady = false;
            $('arenaReadyBtn').textContent = '✅ Hazırım';
          }
        } catch (err) {}
      };
      arenaWs.onclose = () => { arenaWs = null; $('arenaStatus').textContent = 'Bağlantı kapandı.'; };
      arenaWs.onerror = () => { $('arenaStatus').textContent = 'Bağlantı hatası.'; };
    } catch (e) {
      $('arenaStatus').textContent = 'Bu tarayıcı desteklenmiyor.';
    }
  }

  function reportArenaScore(score) { sendArena({ type: 'score', score }); }

  function reportDonut() {
    api('/api/donut', { method: 'POST', body: { count: 1 } })
      .then((d) => {
        if (profile) { profile.coins = d.coins; profile.donuts = d.donuts; }
        renderCoins();
      })
      .catch(() => {});
  }

  function closeArena() {
    clearArenaCountdown();
    if (arenaWs) { try { arenaWs.close(); } catch (e) {} arenaWs = null; }
    arenaReady = false;
  }

  function clearArenaCountdown() {
    if (arenaCountdownTimer) clearInterval(arenaCountdownTimer);
    arenaCountdownTimer = null;
    $('arenaCountdown').hidden = true;
  }

  function showArenaCountdown(at) {
    clearArenaCountdown();
    const el = $('arenaCountdown');
    el.hidden = false;
    const tick = () => {
      const left = at - Date.now();
      if (left <= 0) {
        clearArenaCountdown();
        startGame('arena');
        sendArena({ type: 'playing' });
        return;
      }
      el.textContent = Math.ceil(left / 1000);
    };
    tick();
    arenaCountdownTimer = setInterval(tick, 100);
  }

  function returnToArenaLobby() {
    sendArena({ type: 'lobby' });
    arenaReady = false;
    clearArenaCountdown();
    $('arenaReadyBtn').textContent = '✅ Hazırım';
    show('arena');
  }

  function renderArena(players, phase, readyCount) {
    arenaPlayers = players || [];
    arenaPlayers.forEach((p) => {
      if (p.face && !arenaFaceImgs[p.name]) {
        const im = new Image();
        im.src = p.face;
        arenaFaceImgs[p.name] = im;
      }
      arenaLooks[p.name] = {
        skin: SKINS[Math.min(5, p.skinTone || 0)] || SKINS[2],
        shoe: SHOES[Math.min(5, p.shoeColor || 0)] || SHOES[0],
        cape: !!p.cape,
      };
    });
    const firstJoin = Math.min.apply(null, arenaPlayers.map((p) => p.joinIndex || 0));
    const firstPlayer = arenaPlayers.find((p) => (p.joinIndex || 0) === firstJoin);
    const hud = $('arenaHud');
    hud.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'arena-hud-title';
    title.textContent = '🌍 CANLI ARENA';
    hud.appendChild(title);
    if (firstPlayer) {
      const lead = document.createElement('div');
      lead.className = 'arena-hud-row';
      lead.textContent = '🥇 ' + firstPlayer.name + ' +0.5sn';
      hud.appendChild(lead);
    }
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
        name.textContent = ((p.joinIndex || 0) === firstJoin ? '🥇 ' : '') + p.name
          + (profile && p.name === profile.username ? ' (sen)' : '');
        const score = document.createElement('span');
        score.className = 'admin-stats';
        score.textContent = (p.playing ? '🏃 oynuyor' : p.ready ? '✅ hazır' : '⏳ bekliyor') + ' · ' + p.score;
        row.append(rank, name, score);
        list.appendChild(row);
      });
    }

    if (phase !== undefined) {
      $('arenaStatus').textContent = phase === 'starting' ? 'Herkes hazır! Başlıyor...'
        : phase === 'running' ? 'Tur sürüyor...'
          : readyCount + '/' + players.length + ' oyuncu hazır · hepsi hazır olunca başlar';
      $('arenaReadyBtn').textContent = arenaReady ? '↩️ Hazır değilim' : '✅ Hazırım';
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
  $('roastRerollBtn').addEventListener('click', () => {
    const current = $('roastText').textContent;
    let next = current;
    while (next === current && ROASTS.length > 1) {
      next = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    }
    $('roastText').textContent = next;
  });
  $('retryBtn').addEventListener('click', () => {
    if (currentMode === 'arena') returnToArenaLobby();
    else startGame();
  });
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
    arenaReady = false;
    $('arenaReadyBtn').textContent = '✅ Hazırım';
    connectArena();
    show('arena');
  });
  $('arenaReadyBtn').addEventListener('click', () => {
    arenaReady = !arenaReady;
    sendArena({ type: 'ready', ready: arenaReady });
    $('arenaReadyBtn').textContent = arenaReady ? '↩️ Hazır değilim' : '✅ Hazırım';
  });
  $('arenaReturnBtn').addEventListener('click', returnToArenaLobby);
  $('arenaBackBtn').addEventListener('click', () => { closeArena(); enterMenu(); });

  $('sandboxBtn').addEventListener('click', openSandbox);
  $('sandboxBackBtn').addEventListener('click', enterMenu);
  ['sandboxSpeed', 'sandboxGap', 'sandboxJump'].forEach((id) => {
    $(id).addEventListener('input', updateSandboxLabels);
  });
  $('sandboxStartBtn').addEventListener('click', () => { saveSandboxSettings(); startGame('sandbox'); });
  $('jumpBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); pressJump(); });
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); pressJump(); });
  window.addEventListener('pointerup', releaseJump);
  window.addEventListener('pointercancel', releaseJump);
  $('pauseBtn').addEventListener('click', () => togglePause(true));
  $('resumeBtn').addEventListener('click', () => togglePause(false));
  $('quitBtn').addEventListener('click', () => { stopGame(); enterMenu(); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (screens.game.classList.contains('active')) {
        e.preventDefault();
        if (!e.repeat) pressJump();
      }
    }
    if (e.code === 'Escape' && screens.game.classList.contains('active')) togglePause();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') releaseJump();
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
