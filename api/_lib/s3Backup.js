// api/_lib/s3Backup.js
// Utilidades AWS S3 Signature V4 (Web Crypto) para consultar y descargar respaldos por usuario desde Superadmin.

export const BACKUP_ROOT_PREFIX = '_respaldos_servidor';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function rfc3986Encode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3Key(key) {
  return String(key || '').replace(/^\/+/, '').split('/').filter(Boolean).map(rfc3986Encode).join('/');
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(strOrBytes) {
  const bytes = typeof strOrBytes === 'string' ? new TextEncoder().encode(strOrBytes) : strOrBytes;
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return toHex(buf);
}

async function hmacRaw(keyInput, message) {
  const rawKey = typeof keyInput === 'string' ? new TextEncoder().encode(keyInput) : keyInput;
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return globalThis.crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function signingKey(secretAccessKey, dateStamp, region) {
  const kDate = await hmacRaw(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, 's3');
  return hmacRaw(kService, 'aws4_request');
}

function formatAmzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso.slice(0, 15) + 'Z', dateStamp: iso.slice(0, 8) };
}

export function getAwsBackupConfig(envObj = process.env) {
  const bucket = String(envObj?.AWS_S3_BUCKET || '').trim();
  const region = String(envObj?.AWS_REGION || envObj?.AWS_DEFAULT_REGION || 'us-east-1').trim();
  const accessKeyId = String(envObj?.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(envObj?.AWS_SECRET_ACCESS_KEY || '').trim();
  const sessionToken = String(envObj?.AWS_SESSION_TOKEN || '').trim();
  const customEndpoint = String(envObj?.AWS_S3_ENDPOINT || '').trim().replace(/\/+$/, '');
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, accessKeyId, secretAccessKey, sessionToken, customEndpoint };
}

export async function userBackupSlug(email) {
  const clean = String(email || '').trim().toLowerCase();
  const digest = (await sha256Hex(clean)).slice(0, 8);
  const readable = clean
    .replaceAll('@', '_at_')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 64) || 'usuario';
  return `${readable}__${digest}`;
}

export function isValidBackupObjectKey(key, requiredPrefix = `${BACKUP_ROOT_PREFIX}/por_usuario/`) {
  const clean = String(key || '').trim().replace(/^\/+/, '');
  if (!clean || clean.includes('..') || clean.includes('\\')) return false;
  return clean.startsWith(requiredPrefix);
}

function resolveS3Target(awsCfg, key = '') {
  const encodedKey = key ? encodeS3Key(key) : '';
  if (awsCfg.customEndpoint) {
    const parsed = new URL(awsCfg.customEndpoint);
    const basePath = parsed.pathname.replace(/\/+$/, '');
    const suffix = encodedKey ? `/${encodedKey}` : '';
    const canonicalUri = `${basePath}/${rfc3986Encode(awsCfg.bucket)}${suffix}`;
    return {
      host: parsed.host,
      canonicalUri,
      baseUrl: `${parsed.protocol}//${parsed.host}${canonicalUri}`
    };
  }
  const host = `${awsCfg.bucket}.s3.${awsCfg.region}.amazonaws.com`;
  const canonicalUri = encodedKey ? `/${encodedKey}` : '/';
  return { host, canonicalUri, baseUrl: `https://${host}${canonicalUri}` };
}

async function signedS3Fetch(awsCfg, method, key, queryParams = {}) {
  const { amzDate, dateStamp } = formatAmzDates();
  const { host, canonicalUri, baseUrl } = resolveS3Target(awsCfg, key);
  const payloadHash = await sha256Hex('');
  const hdrs = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (awsCfg.sessionToken) hdrs['x-amz-security-token'] = awsCfg.sessionToken;

  const qStr = Object.keys(queryParams)
    .sort()
    .map(k => `${rfc3986Encode(k)}=${rfc3986Encode(queryParams[k])}`)
    .join('&');
  const hdrKeys = Object.keys(hdrs).sort();
  const canonicalHeaders = hdrKeys.map(k => `${k}:${hdrs[k]}\n`).join('');
  const signedHeaders = hdrKeys.join(';');
  const canonicalRequest = [method, canonicalUri, qStr, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${awsCfg.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  const kSign = await signingKey(awsCfg.secretAccessKey, dateStamp, awsCfg.region);
  const signature = toHex(await hmacRaw(kSign, stringToSign));

  const reqHeaders = { ...hdrs };
  delete reqHeaders.host;
  reqHeaders.Authorization = `AWS4-HMAC-SHA256 Credential=${awsCfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = qStr ? `${baseUrl}?${qStr}` : baseUrl;
  return fetch(url, { method, headers: reqHeaders });
}

export async function buildBackupPresignedUrl(awsCfg, key, expiresIn = 120) {
  const { amzDate, dateStamp } = formatAmzDates();
  const { host, canonicalUri, baseUrl } = resolveS3Target(awsCfg, key);
  const scope = `${dateStamp}/${awsCfg.region}/s3/aws4_request`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${awsCfg.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.max(30, Math.min(900, Number(expiresIn) || 120))),
    'X-Amz-SignedHeaders': 'host'
  };
  if (awsCfg.sessionToken) params['X-Amz-Security-Token'] = awsCfg.sessionToken;
  const filename = String(key).split('/').pop();
  if (filename) params['response-content-disposition'] = `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`;

  const qStr = Object.keys(params)
    .sort()
    .map(k => `${rfc3986Encode(k)}=${rfc3986Encode(params[k])}`)
    .join('&');
  const canonicalRequest = ['GET', canonicalUri, qStr, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  const kSign = await signingKey(awsCfg.secretAccessKey, dateStamp, awsCfg.region);
  const signature = toHex(await hmacRaw(kSign, stringToSign));
  return `${baseUrl}?${qStr}&X-Amz-Signature=${signature}`;
}

function decodeXmlText(val) {
  return String(val || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'");
}

export async function listUserBackupDates(awsCfg, email) {
  const slug = await userBackupSlug(email);
  const prefix = `${BACKUP_ROOT_PREFIX}/por_usuario/${slug}/`;
  const dates = new Set();
  let token = '';
  for (let i = 0; i < 20; i++) {
    const qp = { 'list-type': '2', prefix, delimiter: '/' };
    if (token) qp['continuation-token'] = token;
    const res = await signedS3Fetch(awsCfg, 'GET', '', qp);
    if (!res.ok) throw new Error(`S3 list failed (${res.status})`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>\s*<\/CommonPrefixes>/g)) {
      const seg = decodeXmlText(m[1]).slice(prefix.length).replace(/\/+$/, '');
      if (DATE_RE.test(seg)) dates.add(seg);
    }
    const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
    const nextMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!truncated || !nextMatch) break;
    token = decodeXmlText(nextMatch[1]);
  }
  return { slug, dates: Array.from(dates).sort().reverse() };
}

export async function fetchUserBackupManifest(awsCfg, email, dateStr = '') {
  const slug = await userBackupSlug(email);
  const cleanDate = DATE_RE.test(String(dateStr || '').trim()) ? String(dateStr).trim() : '';
  const key = cleanDate
    ? `${BACKUP_ROOT_PREFIX}/por_usuario/${slug}/${cleanDate}/manifiesto.json`
    : `${BACKUP_ROOT_PREFIX}/por_usuario/${slug}/ultimo_manifiesto.json`;
  const res = await signedS3Fetch(awsCfg, 'GET', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 manifest failed (${res.status})`);
  return res.json();
}
