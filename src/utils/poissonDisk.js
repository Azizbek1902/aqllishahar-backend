/**
 * Poisson-disk sampling — polygon ichida random nuqtalarni har biri orasidagi
 * minimum masofa saqlangan holda generatsiya qiladi.
 *
 * Bridson's algoritmiga asoslangan, geografik koordinatalar uchun moslashtirilgan
 * (metr ↔ daraja konversiyasi `geo.js` orqali).
 *
 * Parametrlar:
 *  - polygon:    GeoJSON Polygon { type: 'Polygon', coordinates: [[[lng, lat], ...]] }
 *  - minDistM:   nuqtalar orasi minimum (metr)
 *  - maxPoints:  qaytariladigan maksimum nuqta
 *  - k:          har bir aktiv nuqtadan urinishlar soni (default 30 — standart Bridson)
 *
 * Qaytaradi: [{ lat, lng }, ...]
 */
import {
  pointInPolygon,
  polygonBbox,
  distanceMeters,
  metersToLatDeg,
  metersToLngDeg,
} from './geo.js';

export function generatePoints(polygon, { minDistM = 12, maxPoints = 20, k = 30 } = {}) {
  const bbox = polygonBbox(polygon);
  if (!isFinite(bbox.minLat)) return [];

  const points = [];
  const active = [];

  // Boshlang'ich nuqta: polygon centroid (ichida bo'lguncha bbox ichida random tanlaymiz)
  let seed = pickRandomInside(polygon, bbox, 50);
  if (!seed) return [];
  points.push(seed);
  active.push(seed);

  while (active.length > 0 && points.length < maxPoints) {
    const idx = Math.floor(Math.random() * active.length);
    const base = active[idx];
    let found = false;

    for (let i = 0; i < k; i++) {
      const cand = randomPointAround(base, minDistM, minDistM * 2);
      if (!pointInPolygon(cand.lat, cand.lng, polygon)) continue;
      if (!isFarEnough(cand, points, minDistM)) continue;
      points.push(cand);
      active.push(cand);
      found = true;
      if (points.length >= maxPoints) break;
    }
    if (!found) active.splice(idx, 1);
  }
  return points;
}

/** Yordamchi: bbox ichida random nuqta tanlaymiz, polygon ichida bo'lsa qaytaramiz */
function pickRandomInside(polygon, bbox, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const lat = bbox.minLat + Math.random() * (bbox.maxLat - bbox.minLat);
    const lng = bbox.minLng + Math.random() * (bbox.maxLng - bbox.minLng);
    if (pointInPolygon(lat, lng, polygon)) return { lat, lng };
  }
  return null;
}

/** `base` atrofidagi [minDistM, maxDistM] halqasidan random nuqta */
function randomPointAround(base, minDistM, maxDistM) {
  const angle = Math.random() * Math.PI * 2;
  const dist  = minDistM + Math.random() * (maxDistM - minDistM);
  const dLat  = metersToLatDeg(dist * Math.sin(angle));
  const dLng  = metersToLngDeg(dist * Math.cos(angle), base.lat);
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

/** Mavjud nuqtalardan minDistM dan yiroqdami? */
function isFarEnough(p, points, minDistM) {
  for (const q of points) {
    if (distanceMeters(p.lat, p.lng, q.lat, q.lng) < minDistM) return false;
  }
  return true;
}

/**
 * Hudud maydoniga qarab nechta nuqta kerakligini hisoblaydi.
 * areaM2 — hududning yuzasi m² da
 * densityPerSqm — har necha m² ga 1 nuqta (masalan 250)
 * Min 1, Max 20.
 */
export function recommendedPointCount(areaM2, densityPerSqm = 250) {
  const raw = Math.round(areaM2 / densityPerSqm);
  return Math.max(1, Math.min(20, raw));
}
