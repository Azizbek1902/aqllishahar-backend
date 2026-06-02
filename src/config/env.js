import dotenv from 'dotenv';
dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
});

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // GPS toleransiyalar (metr) — mobile ingest paytida tekshiriladi
  GPS_POINT_TOLERANCE_M: Number(process.env.GPS_POINT_TOLERANCE_M) || 2,
  GPS_HUDUD_TOLERANCE_M: Number(process.env.GPS_HUDUD_TOLERANCE_M) || 10,
  // Avto-nuqta generatsiya
  POINT_DENSITY_PER_SQM: Number(process.env.POINT_DENSITY_PER_SQM) || 250,
  POINT_MIN_SPACING_M:   Number(process.env.POINT_MIN_SPACING_M)   || 12,
};
