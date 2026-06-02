const THRESHOLDS = {
  moisture: [
    { min: 0,  max: 10,  status: 'critical', messageKey: 'alert.moisture.veryDry'  },
    { min: 10, max: 20,  status: 'warning',  messageKey: 'alert.moisture.dry'       },
    { min: 20, max: 60,  status: 'optimal',  messageKey: 'alert.moisture.optimal'   },
    { min: 60, max: 80,  status: 'high',     messageKey: 'alert.moisture.wet'       },
    { min: 80, max: 101, status: 'critical', messageKey: 'alert.moisture.flooded'   },
  ],
  temperature: [
    { min: -40, max: 0,  status: 'critical', messageKey: 'alert.temperature.freezing' },
    { min: 0,   max: 10, status: 'warning',  messageKey: 'alert.temperature.cold'     },
    { min: 10,  max: 18, status: 'high',     messageKey: 'alert.temperature.cool'     },
    { min: 18,  max: 28, status: 'optimal',  messageKey: 'alert.temperature.optimal'  },
    { min: 28,  max: 35, status: 'high',     messageKey: 'alert.temperature.hot'      },
    { min: 35,  max: 81, status: 'critical', messageKey: 'alert.temperature.veryHot'  },
  ],
  nitrogen: [
    { min: 0,   max: 50,   status: 'critical', messageKey: 'alert.npk.veryLow' },
    { min: 50,  max: 100,  status: 'warning',  messageKey: 'alert.npk.low'     },
    { min: 100, max: 200,  status: 'high',     messageKey: 'alert.npk.medium'  },
    { min: 200, max: 400,  status: 'optimal',  messageKey: 'alert.npk.optimal' },
    { min: 400, max: 800,  status: 'high',     messageKey: 'alert.npk.high'    },
    { min: 800, max: 2000, status: 'critical', messageKey: 'alert.npk.toxic'   },
  ],
  phosphorus: [
    { min: 0,   max: 20,   status: 'critical', messageKey: 'alert.npk.veryLow' },
    { min: 20,  max: 50,   status: 'warning',  messageKey: 'alert.npk.low'     },
    { min: 50,  max: 100,  status: 'high',     messageKey: 'alert.npk.medium'  },
    { min: 100, max: 200,  status: 'optimal',  messageKey: 'alert.npk.optimal' },
    { min: 200, max: 500,  status: 'high',     messageKey: 'alert.npk.high'    },
    { min: 500, max: 2000, status: 'critical', messageKey: 'alert.npk.toxic'   },
  ],
  potassium: [
    { min: 0,    max: 80,   status: 'critical', messageKey: 'alert.npk.veryLow' },
    { min: 80,   max: 150,  status: 'warning',  messageKey: 'alert.npk.low'     },
    { min: 150,  max: 250,  status: 'high',     messageKey: 'alert.npk.medium'  },
    { min: 250,  max: 500,  status: 'optimal',  messageKey: 'alert.npk.optimal' },
    { min: 500,  max: 1000, status: 'high',     messageKey: 'alert.npk.high'    },
    { min: 1000, max: 2000, status: 'critical', messageKey: 'alert.npk.toxic'   },
  ],
  ph: [
    { min: 0,   max: 4.5, status: 'critical', messageKey: 'alert.ph.strongAcid'     },
    { min: 4.5, max: 5.5, status: 'warning',  messageKey: 'alert.ph.acid'           },
    { min: 5.5, max: 6.5, status: 'high',     messageKey: 'alert.ph.lightAcid'      },
    { min: 6.5, max: 7.5, status: 'optimal',  messageKey: 'alert.ph.neutral'        },
    { min: 7.5, max: 8.5, status: 'high',     messageKey: 'alert.ph.lightAlkaline'  },
    { min: 8.5, max: 9.5, status: 'warning',  messageKey: 'alert.ph.alkaline'       },
    { min: 9.5, max: 15,  status: 'critical', messageKey: 'alert.ph.strongAlkaline' },
  ],
  ec: [
    { min: 0,    max: 200,   status: 'critical', messageKey: 'alert.ec.veryLow' },
    { min: 200,  max: 500,   status: 'warning',  messageKey: 'alert.ec.low'     },
    { min: 500,  max: 1500,  status: 'high',     messageKey: 'alert.ec.medium'  },
    { min: 1500, max: 2500,  status: 'optimal',  messageKey: 'alert.ec.optimal' },
    { min: 2500, max: 4000,  status: 'warning',  messageKey: 'alert.ec.high'    },
    { min: 4000, max: 10001, status: 'critical', messageKey: 'alert.ec.salty'   },
  ],
};

export function getParameterStatus(parameter, value) {
  const ranges = THRESHOLDS[parameter];
  if (!ranges) return null;
  const range = ranges.find((r) => value >= r.min && value < r.max) ?? ranges[ranges.length - 1];
  return { status: range.status, messageKey: range.messageKey };
}
