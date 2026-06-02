/**
 * Foydalanuvchi kiritgan stringni RegExp ichida xavfsiz ishlatish uchun escape qiladi.
 * Bu ReDoS va Mongo cast xatolaridan himoya qiladi.
 */
export function regexEscape(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
