/**
 * Geo utility funksiyalari (haversine, point-in-polygon, bbox, area, centroid).
 * Hech qanday tashqi kutubxona — Earth WGS84 doirasini standart aproksimatsiyalar bilan ishlatamiz.
 */

const EARTH_RADIUS_M = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;

/** Ikki nuqta orasidagi masofa metrda (haversine). lat/lng — gradusda */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const dφ = (lat2 - lat1) * DEG_TO_RAD;
  const dλ = (lng2 - lng1) * DEG_TO_RAD;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Nuqta polygon ichidami? Ray-casting algoritmi.
 * @param {number} lat - test nuqta kenglik
 * @param {number} lng - test nuqta uzunlik
 * @param {Array<[number, number]>} ring - polygonning tashqi halqasi [[lng, lat], ...]
 */
export function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; // lng, lat
    const [xj, yj] = ring[j];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** GeoJSON Polygon (faqat tashqi halqa) uchun point-in-polygon */
export function pointInPolygon(lat, lng, polygon) {
  if (!polygon?.coordinates?.[0]) return false;
  return pointInRing(lat, lng, polygon.coordinates[0]);
}

/** Polygonning bounding box: { minLat, maxLat, minLng, maxLng } */
export function polygonBbox(polygon) {
  const ring = polygon?.coordinates?.[0] ?? [];
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lng, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Polygonning yuzasi m² da. Spherical excess formula (geografik koordinatalar uchun aniq).
 * Faqat tashqi halqa bilan ishlaydi (MVP uchun yetarli).
 */
export function polygonAreaM2(polygon) {
  const ring = polygon?.coordinates?.[0];
  if (!ring || ring.length < 4) return 0;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    total += (lng2 - lng1) * DEG_TO_RAD
      * (2 + Math.sin(lat1 * DEG_TO_RAD) + Math.sin(lat2 * DEG_TO_RAD));
  }
  return Math.abs(total * EARTH_RADIUS_M * EARTH_RADIUS_M / 2);
}

/**
 * Polygon "centroid"i — taxminiy o'rta nuqta (arithmetic mean of vertices).
 * Murakkab shaklda 100% to'g'ri centroid emas, lekin label uchun yetarli.
 */
export function polygonCenter(polygon) {
  const ring = polygon?.coordinates?.[0] ?? [];
  if (ring.length === 0) return { lat: 0, lng: 0 };
  let sumLat = 0, sumLng = 0, count = 0;
  // Oxirgi nuqta birinchisining nusxasi — qo'shmaymiz
  const end = ring[0][0] === ring[ring.length - 1][0]
    && ring[0][1] === ring[ring.length - 1][1] ? ring.length - 1 : ring.length;
  for (let i = 0; i < end; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
    count++;
  }
  return { lat: sumLat / count, lng: sumLng / count };
}

/**
 * Metrda ifodalangan masofani gradusga aylantirish (taxminan, kichik masofalar uchun).
 * Latitude 1° ≈ 111320 m. Longitude bunga `cos(lat)` ko'paytmasi.
 */
export function metersToLatDeg(m) {
  return m / 111320;
}
export function metersToLngDeg(m, atLat) {
  return m / (111320 * Math.cos(atLat * DEG_TO_RAD));
}
