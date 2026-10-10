import http      from 'node:http';
import https     from 'node:https';
import fs        from 'node:fs';
import path      from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const PORT        = process.env.PORT || 3000;
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.join(PROJECT_ROOT, 'dist');
const CACHE_TTL_MS = 10 * 60 * 1000;

const DENY_FILES = new Set([
  '.env', '.gitignore', '.meteoblue_api_key',
  'server.mjs', 'package.json', 'package-lock.json', 'README.md'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map':  'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.txt':  'text/plain; charset=utf-8'
};

function getApiKey() {
  if (process.env.METEOBLUE_API_KEY) return process.env.METEOBLUE_API_KEY.trim();
  try {
    const k = fs.readFileSync(path.join(PROJECT_ROOT, '.meteoblue_api_key'), 'utf8').trim();
    return k || null;
  } catch {
    return null;
  }
}

// Describe de dónde sale la clave para que el log de arranque distinga
// "variable definida pero vacía" de "variable ausente".
function apiKeyStatus() {
  if ('METEOBLUE_API_KEY' in process.env) {
    return String(process.env.METEOBLUE_API_KEY).trim()
      ? 'configurada (env METEOBLUE_API_KEY)'
      : 'DEFINIDA PERO VACÍA — revisá el valor (sin espacios de más)';
  }
  try {
    const k = fs.readFileSync(path.join(PROJECT_ROOT, '.meteoblue_api_key'), 'utf8').trim();
    if (k) return 'configurada (archivo .meteoblue_api_key)';
  } catch { /* ausente: normal en deploys, el archivo es solo local */ }
  return 'NO configurada (falta METEOBLUE_API_KEY en Railway: Variables del servicio + redeploy)';
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res, pathname) {
  let p;
  try {
    p = path.normalize(decodeURIComponent(pathname));
  } catch {
    res.writeHead(400); res.end('Bad Request'); return;
  }

  if (p === '/' || p === '\\') p = '/index.html';
  if (p.startsWith('/.'))      { res.writeHead(403); res.end('Forbidden'); return; }
  if (DENY_FILES.has(path.basename(p))) { res.writeHead(403); res.end('Forbidden'); return; }

  const abs = path.resolve(ROOT, '.' + p);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404); res.end('Not found');
      return;
    }
    const ext  = path.extname(abs).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(abs).pipe(res);
  });
}

const cache = new Map();

function fetchMeteoblue(lat, lon, tz) {
  return new Promise(resolve => {
    const apikey = getApiKey();
    if (!apikey) return resolve({ available: false, reason: 'no_key' });

    const url = `https://my.meteoblue.com/packages/basic-1h`
      + `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      + `&apikey=${encodeURIComponent(apikey)}`
      + `&forecast_days=7&format=json&timezone=${encodeURIComponent(tz || 'UTC')}`;

    const req = https.get(url, res => {
      if (res.statusCode !== 200) {
        res.resume();
        console.warn(`meteoblue: clave rechazada o error (HTTP ${res.statusCode})`);
        return resolve({ available: false, reason: `http_${res.statusCode}` });
      }
      let body = '';
      res.on('data', c => { body += c; if (body.length > 5e6) req.destroy(); });
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          const h = d && d.data_1h;
          if (!h || !Array.isArray(h.time)) return resolve({ available: false, reason: 'bad_data' });
          const n = Math.min(168, h.time.length);
          const pick = arr => Array.isArray(arr) ? arr.slice(0, n) : [];
          resolve({
            available: true,
            times: pick(h.time),
            precipitation: pick(h.precipitation),
            precipitation_probability: pick(h.precipitation_probability)
          });
        } catch {
          resolve({ available: false, reason: 'parse_error' });
        }
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.on('error', () => {
      console.warn('meteoblue: no se pudo contactar a my.meteoblue.com (network_error)');
      resolve({ available: false, reason: 'network_error' });
    });
  });
}

function handleMeteoblue(req, res, url) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  const tz  = url.searchParams.get('tz') || 'UTC';
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return sendJson(res, 400, { available: false, reason: 'bad_coords' });
  }
  const ck   = `${lat.toFixed(5)},${lon.toFixed(5)},${tz}`;
  const hit  = cache.get(ck);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return sendJson(res, 200, hit.data);
  }
  fetchMeteoblue(lat, lon, tz).then(data => {
    cache.set(ck, { ts: Date.now(), data });
    sendJson(res, 200, data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/meteoblue') {
    return handleMeteoblue(req, res, url);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end('Method Not Allowed');
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Stargazing Forecast server en http://localhost:${PORT}`);
  console.log(`METEOBLUE_API_KEY: ${apiKeyStatus()}`);
});