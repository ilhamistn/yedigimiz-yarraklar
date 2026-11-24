/* Yediğimiz Yarraklar - API Worker (Cloudflare Workers + D1) */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const SESSION_DAYS = 30;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function fail(message, status = 400) {
  return json({ error: message }, status);
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function publicUser(row) {
  return {
    username: row.username,
    face: row.face || null,
    best: row.best,
    games: row.games,
    totalDodged: row.total_dodged,
    eaten: row.eaten || 0,
    approved: row.approved === 1,
    storyLevel: row.story_level || 1,
    skinTone: row.skin_tone || 0,
    shoeColor: row.shoe_color || 0,
    isAdmin: row.is_admin === 1,
  };
}

async function createSession(env, userId) {
  const token = randomHex(32);
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expires).run();
  return token;
}

async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first();
  if (!session) return null;
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first();
  return user || null;
}

async function authToken(env, token) {
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first();
  if (!session) return null;
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first() || null;
}

async function adminOnly(request, env) {
  const user = await authenticate(request, env);
  if (!user) return fail('Giriş yapmalısın.', 401);
  if (user.is_admin !== 1) return fail('Bu sayfa sadece admin içindir.', 403);
  return user;
}

async function readBody(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

function validUsername(name) {
  return typeof name === 'string' && /^[\p{L}\p{N}_-]{3,20}$/u.test(name);
}

function validPassword(pass) {
  return typeof pass === 'string' && pass.length >= 4 && pass.length <= 64;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (path === '/api/health' && method === 'GET') {
      return json({ ok: true });
    }

    // ---- Canlı Arena WebSocket ----
    if (path === '/ws/arena') {
      const url = new URL(request.url);
      const user = await authToken(env, url.searchParams.get('token'));
      if (!user) return fail('Oturum geçersiz.', 401);
      if (user.approved !== 1) return fail('Hesabın onay bekliyor.', 403);
      const stub = env.ARENA.get(env.ARENA.idFromName('global'));
      const arenaUrl = new URL(request.url);
      arenaUrl.searchParams.set('name', user.username);
      arenaUrl.searchParams.set('uid', String(user.id));
      return stub.fetch(new Request(arenaUrl.toString(), request));
    }

    // ---- Hikaye modu ilerlemesi ----
    if (path === '/api/story' && method === 'GET') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      return json({ storyLevel: user.story_level || 1 });
    }

    if (path === '/api/story/complete' && method === 'POST') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      const body = await readBody(request);
      const level = body && body.level;
      if (!Number.isInteger(level) || level < 1 || level > 5) return fail('Geçersiz bölüm.');
      const current = user.story_level || 1;
      if (level !== current) return json({ ok: true, storyLevel: current });
      const next = Math.min(5, current + 1);
      await env.DB.prepare('UPDATE users SET story_level = ? WHERE id = ?').bind(next, user.id).run();
      return json({ ok: true, storyLevel: next });
    }

    // ---- Kayıt ----
    if (path === '/api/register' && method === 'POST') {
      const body = await readBody(request);
      if (!body || !validUsername(body.username)) return fail('Kullanıcı adı 3-20 karakter olmalı (harf, rakam, _ veya -).');
      if (!validPassword(body.password)) return fail('Şifre 4-64 karakter olmalı.');
      const username = body.username.trim();

      const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').bind(username).first();
      if (exists) return fail('Bu kullanıcı adı zaten alınmış.', 409);

      const salt = randomHex(16);
      const hash = await sha256(salt + ':' + body.password);
      // Yeni kayıtlar admin onayına düşer
      await env.DB.prepare(
        'INSERT INTO users (username, salt, pass_hash, face, best, games, total_dodged, approved, is_admin, created_at) VALUES (?, ?, ?, NULL, 0, 0, 0, 0, 0, ?)'
      ).bind(username, salt, hash, Date.now()).run();

      return json({ pending: true, username });
    }

    // ---- Giriş ----
    if (path === '/api/login' && method === 'POST') {
      const body = await readBody(request);
      if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
        return fail('Kullanıcı adı ve şifre gerekli.');
      }
      const user = await env.DB.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').bind(body.username.trim()).first();
      if (!user) return fail('Kullanıcı adı veya şifre yanlış.', 401);
      const hash = await sha256(user.salt + ':' + body.password);
      if (hash !== user.pass_hash) return fail('Kullanıcı adı veya şifre yanlış.', 401);
      if (user.approved !== 1) return fail('Hesabın admin onayını bekliyor.', 403);
      const token = await createSession(env, user.id);
      return json({ token, user: publicUser(user) });
    }

    // ---- Oturum doğrulama ----
    if (path === '/api/me' && method === 'GET') {
      const user = await authenticate(request, env);
      if (!user) return fail('Oturum geçersiz veya süresi dolmuş.', 401);
      return json({ user: publicUser(user) });
    }

    // ---- Çıkış ----
    if (path === '/api/logout' && method === 'POST') {
      const header = request.headers.get('Authorization') || '';
      if (header.startsWith('Bearer ')) {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(header.slice(7).trim()).run();
      }
      return json({ ok: true });
    }

    // ---- Skor kaydet ----
    if (path === '/api/score' && method === 'POST') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      const body = await readBody(request);
      const score = body && Number.isInteger(body.score) ? body.score : -1;
      if (score < 0 || score > 100000) return fail('Geçersiz skor.');
      const isBest = score > user.best;

      await env.DB.prepare(
        'UPDATE users SET games = games + 1, eaten = eaten + 1, total_dodged = total_dodged + ?, best = MAX(best, ?) WHERE id = ?'
      ).bind(score, score, user.id).run();

      const updated = await env.DB.prepare('SELECT best, games, total_dodged FROM users WHERE id = ?').bind(user.id).first();
      return json({
        best: updated.best,
        games: updated.games,
        totalDodged: updated.total_dodged,
        isBest,
      });
    }

    // ---- Şifre değiştir ----
    if (path === '/api/password' && method === 'POST') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      const body = await readBody(request);
      if (!body || typeof body.current !== 'string' || !validPassword(body.next)) {
        return fail('Yeni şifre 4-64 karakter olmalı.');
      }
      const currentHash = await sha256(user.salt + ':' + body.current);
      if (currentHash !== user.pass_hash) return fail('Şu anki şifre yanlış.', 401);

      const salt = randomHex(16);
      const newHash = await sha256(salt + ':' + body.next);
      await env.DB.prepare('UPDATE users SET salt = ?, pass_hash = ? WHERE id = ?')
        .bind(salt, newHash, user.id).run();
      // Eski oturumları geçersiz kıl, yeni token ver
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
      const token = await createSession(env, user.id);
      return json({ ok: true, token });
    }

    // ---- Karakter görünümü ----
    if (path === '/api/appearance' && method === 'POST') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      const body = await readBody(request);
      const skin = body && body.skinTone;
      const shoe = body && body.shoeColor;
      if (!Number.isInteger(skin) || skin < 0 || skin > 5) return fail('Geçersiz ten rengi.');
      if (!Number.isInteger(shoe) || shoe < 0 || shoe > 5) return fail('Geçersiz ayakkabı rengi.');
      await env.DB.prepare('UPDATE users SET skin_tone = ?, shoe_color = ? WHERE id = ?')
        .bind(skin, shoe, user.id).run();
      return json({ ok: true, skinTone: skin, shoeColor: shoe });
    }

    // ---- Kullanıcı kendi yediği yarrak sayısını ekler ----
    if (path === '/api/eaten' && method === 'POST') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      const body = await readBody(request);
      const amount = body && body.amount;
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
        return fail('Miktar 1 ile 10000 arasında olmalı.');
      }
      await env.DB.prepare('UPDATE users SET eaten = eaten + ? WHERE id = ?').bind(amount, user.id).run();
      const updated = await env.DB.prepare('SELECT eaten FROM users WHERE id = ?').bind(user.id).first();
      return json({ ok: true, eaten: updated.eaten, added: amount });
    }

    // ---- Admin: başka kullanıcının şifresini değiştir ----
    if (path === '/api/admin/password' && method === 'POST') {
      const admin = await adminOnly(request, env);
      if (admin instanceof Response) return admin;
      const body = await readBody(request);
      if (!body || !Number.isInteger(body.id) || !validPassword(body.password)) {
        return fail('Geçersiz kullanıcı veya şifre (4-64 karakter).');
      }
      const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();
      if (!target) return fail('Kullanıcı bulunamadı.', 404);
      const salt = randomHex(16);
      const hash = await sha256(salt + ':' + body.password);
      await env.DB.prepare('UPDATE users SET salt = ?, pass_hash = ? WHERE id = ?').bind(salt, hash, body.id).run();
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.id).run();
      return json({ ok: true });
    }

    // ---- Profil fotoğrafı ----
    if (path === '/api/face' && method === 'POST') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      const body = await readBody(request);
      const face = body && body.face;
      if (typeof face !== 'string' || !face.startsWith('data:image/') || face.length > 200000) {
        return fail('Geçersiz görsel.');
      }
      await env.DB.prepare('UPDATE users SET face = ? WHERE id = ?').bind(face, user.id).run();
      return json({ ok: true, face });
    }

    // ---- Lider tablosu (herkese açık) ----
    if (path === '/api/leaderboard' && method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT username, best, games, eaten FROM users WHERE approved = 1 AND is_admin = 0 ORDER BY best DESC, username ASC LIMIT 20'
      ).all();
      const mostEaten = await env.DB.prepare(
        'SELECT username, games, best, eaten FROM users WHERE approved = 1 AND is_admin = 0 ORDER BY eaten DESC, username ASC LIMIT 1'
      ).first() || null;
      return json({ users: results, mostEaten });
    }

    // ---- Admin: tüm kullanıcılar ----
    if (path === '/api/admin/users' && method === 'GET') {
      const user = await adminOnly(request, env);
      if (user instanceof Response) return user;
      const { results } = await env.DB.prepare(
        'SELECT id, username, best, games, total_dodged, approved, is_admin, created_at FROM users ORDER BY approved ASC, best DESC, username ASC LIMIT 200'
      ).all();
      return json({ users: results });
    }

    // ---- Admin: kullanıcı onayla ----
    if (path === '/api/admin/approve' && method === 'POST') {
      const user = await adminOnly(request, env);
      if (user instanceof Response) return user;
      const body = await readBody(request);
      if (!body || !Number.isInteger(body.id)) return fail('Geçersiz kullanıcı.');
      await env.DB.prepare('UPDATE users SET approved = 1 WHERE id = ? AND is_admin = 0').bind(body.id).run();
      return json({ ok: true });
    }

    // ---- Admin: kullanıcı sil ----
    if (path === '/api/admin/delete' && method === 'POST') {
      const user = await adminOnly(request, env);
      if (user instanceof Response) return user;
      const body = await readBody(request);
      if (!body || !Number.isInteger(body.id)) return fail('Geçersiz kullanıcı.');
      await env.DB.prepare('DELETE FROM users WHERE id = ? AND is_admin = 0').bind(body.id).run();
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.id).run();
      return json({ ok: true });
    }

    return fail('Bulunamadı.', 404);
  },
};

/* ============================================================
   Canlı Arena - Durable Object (tek global oda)
   ============================================================ */
export class Arena {
  constructor(state) {
    this.state = state;
    this.sessions = new Map();
    this.phase = 'lobby'; // lobby | starting | running
    this.nextJoin = 0;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 });
    }
    const url = new URL(request.url);
    const name = (url.searchParams.get('name') || 'Oyuncu').slice(0, 20);
    const uid = url.searchParams.get('uid') || '';
    const [client, server] = new WebSocketPair();

    const entry = {
      ws: server, name, uid, score: 0, face: '',
      ready: false, playing: false, joinIndex: this.nextJoin++,
      skinTone: 2, shoeColor: 0,
    };
    this.sessions.set(server, entry);
    server.accept();

    // Yeni oyuncu katıldığında hazırlıklar sıfırlanır (herkes yeniden hazır olmalı)
    this.resetReady();

    server.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'score' && Number.isFinite(msg.score)) {
          entry.score = Math.max(0, Math.min(100000, Math.floor(msg.score)));
        } else if (msg.type === 'face' && typeof msg.face === 'string') {
          entry.face = msg.face.slice(0, 200000);
        } else if (msg.type === 'appearance') {
          if (Number.isInteger(msg.skinTone)) entry.skinTone = Math.max(0, Math.min(5, msg.skinTone));
          if (Number.isInteger(msg.shoeColor)) entry.shoeColor = Math.max(0, Math.min(5, msg.shoeColor));
        } else if (msg.type === 'ready') {
          if (this.phase === 'running') return;
          if (!msg.ready && this.phase === 'starting') { this.cancelStart(); return; }
          entry.ready = !!msg.ready;
          this.checkStart();
        } else if (msg.type === 'playing') {
          entry.playing = true;
          entry.ready = false;
          this.phase = 'running';
        } else if (msg.type === 'lobby') {
          entry.playing = false;
          entry.ready = false;
          if (this.phase !== 'lobby' && Array.from(this.sessions.values()).every((s) => !s.playing)) {
            this.resetReady();
            this.phase = 'lobby';
          }
        }
      } catch (e) { /* geçersiz mesaj */ }
      this.broadcast();
    });

    const close = () => {
      this.sessions.delete(server);
      if (this.phase === 'starting') this.cancelStart();
      if (Array.from(this.sessions.values()).every((s) => !s.playing)) {
        this.resetReady();
        this.phase = 'lobby';
      }
      this.broadcast();
    };
    server.addEventListener('close', close);
    server.addEventListener('error', close);

    server.send(JSON.stringify(this.snapshot(uid)));
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  snapshot(you) {
    return {
      type: 'arena',
      you: you || '',
      phase: this.phase,
      players: this.ranking(),
      readyCount: Array.from(this.sessions.values()).filter((s) => s.ready).length,
    };
  }

  ranking() {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((s, i) => ({
        rank: i + 1,
        name: s.name,
        score: s.score,
        face: s.face,
        ready: s.ready,
        playing: s.playing,
        joinIndex: s.joinIndex,
        skinTone: s.skinTone,
        shoeColor: s.shoeColor,
      }));
  }

  resetReady() {
    for (const s of this.sessions.values()) { s.ready = false; s.playing = false; }
  }

  cancelStart() {
    this.phase = 'lobby';
    this.resetReady();
    this.broadcastAll({ type: 'cancel' });
  }

  checkStart() {
    const all = Array.from(this.sessions.values());
    if (this.phase !== 'lobby' || all.length < 1) return;
    if (all.every((s) => s.ready && !s.playing)) {
      this.phase = 'starting';
      const at = Date.now() + 2500;
      this.broadcastAll({ type: 'start', at });
    }
  }

  broadcastAll(obj) {
    const msg = JSON.stringify(obj);
    for (const s of this.sessions.values()) {
      try { s.ws.send(msg); } catch (e) { /* kapalı soket */ }
    }
  }

  broadcast() {
    this.broadcastAll(this.snapshot());
  }
}
