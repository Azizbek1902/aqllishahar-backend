/**
 * Kirill (o'zbek/rus) → lotin transliteratsiyasi.
 * Asosan geojson MFY nomlarini latin yozuvga aylantirish uchun.
 *
 * Misol: "Қиргули МФЙ" → "Qirguli MFY"
 */

const CYR_TO_LAT = {
  // Bosh harflar
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Ғ': "G'", 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
  'Ж': 'J', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Қ': 'Q', 'Л': 'L', 'М': 'M',
  'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ў': "O'",
  'Ф': 'F', 'Х': 'X', 'Ҳ': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sh',
  'Ъ': '’', 'Ы': 'I', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  // Kichik harflar
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': "g'", 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ў': "o'",
  'ф': 'f', 'х': 'x', 'ҳ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
  'ъ': '’', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

export function cyrillicToLatin(text) {
  if (!text) return '';
  return [...text].map((ch) => CYR_TO_LAT[ch] ?? ch).join('');
}

/**
 * Stringdan URL-safe slug yasaydi.
 * Misol: "Қиргули МФЙ" → "qirguli-mfy"
 */
export function slugify(text) {
  return cyrillicToLatin(text)
    .toLowerCase()
    .replace(/['’ʼ`]/g, '')                  // apostroflarni o'chiramiz
    .replace(/[^a-z0-9]+/g, '-')             // boshqa belgilar — chiziqcha
    .replace(/^-+|-+$/g, '');                // boshi/oxiridagi chiziqlar
}
