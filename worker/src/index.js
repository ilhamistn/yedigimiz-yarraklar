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
      const result = await env.DB.prepare(
        'INSERT INTO users (username, salt, pass_hash, face, best, games, total_dodged, is_admin, created_at) VALUES (?, ?, ?, NULL, 0, 0, 0, 0, ?)'
      ).bind(username, salt, hash, Date.now()).run();

      const userId = result.meta.last_row_id;
      const token = await createSession(env, userId);
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
      return json({ token, user: publicUser(user) });
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
        'UPDATE users SET games = games + 1, total_dodged = total_dodged + ?, best = MAX(best, ?) WHERE id = ?'
      ).bind(score, score, user.id).run();

      const updated = await env.DB.prepare('SELECT best, games, total_dodged FROM users WHERE id = ?').bind(user.id).first();
      return json({
        best: updated.best,
        games: updated.games,
        totalDodged: updated.total_dodged,
        isBest,
      });
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

    // ---- Admin: tüm kullanıcılar ----
    if (path === '/api/admin/users' && method === 'GET') {
      const user = await authenticate(request, env);
      if (!user) return fail('Giriş yapmalısın.', 401);
      if (user.is_admin !== 1) return fail('Bu sayfa sadece admin içindir.', 403);
      const { results } = await env.DB.prepare(
        'SELECT username, best, games, total_dodged, created_at FROM users ORDER BY best DESC, username ASC LIMIT 200'
      ).all();
      return json({ users: results });
    }

    return fail('Bulunamadı.', 404);
  },
};
