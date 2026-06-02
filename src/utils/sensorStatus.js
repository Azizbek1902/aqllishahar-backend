export const SENSOR_PARAMETERS = {
  moisture: {
    unit: '%',
    technicalRange: { min: 0, max: 100 },
    ranges: [
      { min: 0, max: 10, status: 'critical', labelKey: 'sensor.moisture.veryDry' },
      { min: 10, max: 20, status: 'warning', labelKey: 'sensor.moisture.dry' },
      { min: 20, max: 60, status: 'optimal', labelKey: 'sensor.moisture.optimal' },
      { min: 60, max: 80, status: 'high', labelKey: 'sensor.moisture.wet' },
      { min: 80, max: 100, status: 'critical', labelKey: 'sensor.moisture.flooded' },
    ],
  },
  temperature: {
    unit: '°C',
    technicalRange: { min: -40, max: 80 },
    ranges: [
      { min: -40, max: 0, status: 'critical', labelKey: 'sensor.temperature.freezing' },
      { min: 0, max: 10, status: 'warning', labelKey: 'sensor.temperature.cold' },
      { min: 10, max: 18, status: 'high', labelKey: 'sensor.temperature.cool' },
      { min: 18, max: 28, status: 'optimal', labelKey: 'sensor.temperature.optimal' },
      { min: 28, max: 35, status: 'high', labelKey: 'sensor.temperature.hot' },
      { min: 35, max: 80, status: 'critical', labelKey: 'sensor.temperature.veryHot' },
    ],
  },
  nitrogen: {
    unit: 'mg/kg',
    ranges: [
      { min: 0, max: 50, status: 'critical' },
      { min: 50, max: 100, status: 'warning' },
      { min: 100, max: 200, status: 'high' },
      { min: 200, max: 400, status: 'optimal' },
      { min: 400, max: 800, status: 'high' },
      { min: 800, max: 1999, status: 'critical' },
    ],
  },
  phosphorus: {
    unit: 'mg/kg',
    ranges: [
      { min: 0, max: 20, status: 'critical' },
      { min: 20, max: 50, status: 'warning' },
      { min: 50, max: 100, status: 'high' },
      { min: 100, max: 200, status: 'optimal' },
      { min: 200, max: 500, status: 'high' },
      { min: 500, max: 1999, status: 'critical' },
    ],
  },
  potassium: {
    unit: 'mg/kg',
    ranges: [
      { min: 0, max: 80, status: 'critical' },
      { min: 80, max: 150, status: 'warning' },
      { min: 150, max: 250, status: 'high' },
      { min: 250, max: 500, status: 'optimal' },
      { min: 500, max: 1000, status: 'high' },
      { min: 1000, max: 1999, status: 'critical' },
    ],
  },
  ph: {
    unit: 'pH',
    ranges: [
      { min: 0, max: 4.5, status: 'critical' },
      { min: 4.5, max: 5.5, status: 'warning' },
      { min: 5.5, max: 6.5, status: 'high' },
      { min: 6.5, max: 7.5, status: 'optimal' },
      { min: 7.5, max: 8.5, status: 'high' },
      { min: 8.5, max: 9.5, status: 'warning' },
      { min: 9.5, max: 14, status: 'critical' },
    ],
  },
  ec: {
    unit: 'µS/cm',
    ranges: [
      { min: 0, max: 200, status: 'critical' },
      { min: 200, max: 500, status: 'warning' },
      { min: 500, max: 1500, status: 'high' },
      { min: 1500, max: 2500, status: 'optimal' },
      { min: 2500, max: 4000, status: 'warning' },
      { min: 4000, max: 10000, status: 'critical' },
    ],
  },
};

export function getStatusForValue(parameter, value) {
  const def = SENSOR_PARAMETERS[parameter];
  if (!def) return 'optimal';
  const range = def.ranges.find((r) => value >= r.min && value < r.max);
  return range?.status ?? 'optimal';
}

export function getOverallStatus(reading) {
  const statuses = [
    getStatusForValue('moisture', reading.moisture),
    getStatusForValue('temperature', reading.temperature),
    getStatusForValue('nitrogen', reading.nitrogen),
    getStatusForValue('phosphorus', reading.phosphorus),
    getStatusForValue('potassium', reading.potassium),
    getStatusForValue('ph', reading.ph),
    getStatusForValue('ec', reading.ec),
  ];
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  if (statuses.includes('high')) return 'high';
  return 'optimal';
}
