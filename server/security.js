import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const developmentKey = 'psyche-development-key-change-before-production';
const keyMaterial = process.env.PSYCHE_DATA_KEY || developmentKey;
const encryptionKey = createHash('sha256').update(keyMaterial).digest();

export const usingDevelopmentKey = keyMaterial === developmentKey;

const validationError = message => Object.assign(new Error(message), { status: 400, expose: true });

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  if (typeof password !== 'string' || password.length < 6) throw validationError('A senha deve ter pelo menos 6 caracteres');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [salt, original] = stored.split(':');
    const candidate = scryptSync(password, salt, 64);
    return timingSafeEqual(candidate, Buffer.from(original, 'hex'));
  } catch { return false; }
}

export function createToken() { return randomBytes(32).toString('base64url'); }
export function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }

export function encrypt(value) {
  if (value == null || value === '') return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decrypt(payload) {
  if (!payload || !String(payload).startsWith('v1.')) return payload;
  const [, iv, tag, encrypted] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

export function cleanText(value, { min = 0, max = 500 } = {}) {
  if (typeof value !== 'string') throw validationError('Valor textual inválido');
  const clean = value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  if (clean.length < min || clean.length > max) throw validationError(`O texto deve ter entre ${min} e ${max} caracteres`);
  return clean;
}

export function cleanEmail(value) {
  const email = cleanText(value, { min: 5, max: 160 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validationError('E-mail inválido');
  return email;
}

export function cleanNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw validationError('Valor numérico inválido');
  return number;
}
