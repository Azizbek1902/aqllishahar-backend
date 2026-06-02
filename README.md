# Backend — Sug'oriladigan Yer Monitoringi API

Node.js + Express + MongoDB (Mongoose) — JWT auth, MVC pattern.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# .env ni tahrirlang (MONGODB_URI, JWT_SECRET)

npm run seed   # demo data yaratish
npm run dev    # http://localhost:4000
```

## Demo akkauntlar (seed dan keyin)

| Email | Parol | Rol | Viloyat |
|-------|-------|-----|---------|
| admin@admin.uz | admin123 | admin | — |
| rahbar@rahbar.uz | rahbar123 | rahbar | Farg'ona (default) |
| rahbar.fargona@rahbar.uz | rahbar123 | rahbar | Farg'ona |
| rahbar.andijon@rahbar.uz | rahbar123 | rahbar | Andijon |
| ... har viloyat uchun bittadan |

## Folder struktura (MVC)

```
src/
  config/        env.js, db.js
  models/        User, Viloyat, Location, Sensor, Reading, Alert, WaterUsage, Log
  middleware/    auth, role, validate, error
  controllers/   *.controller.js — biznes-logika
  routes/        *.routes.js — endpointlarni controller bilan ulash
  utils/         jwt, sensorStatus
  seed/          seed.js — demo ma'lumot
  app.js         express app + mountlash
  server.js      entry point
```

## Endpoints

### Auth
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET /api/auth/me` — joriy foydalanuvchi (Bearer token)

### Viloyatlar
- `GET /api/viloyatlar` — barcha viloyatlar

### Sensors
- `GET /api/sensors` — filter: `viloyatId`, `status`, `search`
- `GET /api/sensors/:id`
- `POST /api/sensors` (admin)
- `PUT /api/sensors/:id` (admin)
- `DELETE /api/sensors/:id` (admin)

### Locations
- `GET /api/locations`
- `POST /api/locations` (admin)
- `DELETE /api/locations/:id` (admin)

### Readings
- `GET /api/readings/sensor/:sensorId?days=7`
- `GET /api/readings/aggregate?parameter=moisture&days=7`

### Alerts
- `GET /api/alerts`
- `PATCH /api/alerts/:id/read`
- `PATCH /api/alerts/read-all`

### Water Usage
- `GET /api/water?days=30`
- `GET /api/water/summary`

### Dashboard
- `GET /api/dashboard/summary` — KPI + status counts + 7-day trend + recent alerts/sensors

### Users (admin only)
- `GET /api/users`
- `POST /api/users` — `{ fullName, email, password, role, viloyatId? }`
- `DELETE /api/users/:id`

### Logs (admin only)
- `GET /api/logs`

## Viloyat scope

**Rahbar foydalanuvchilar** har bir endpoint da avtomatik ravishda **o'z viloyati** bilan filterlanadi (controller ichidagi `viloyatFilter(req)`). Admin barcha ma'lumotlarni ko'radi.

## Auth

`Authorization: Bearer <token>` header bilan barcha himoyalangan endpointlar.
JWT muddat: 7 kun (env `JWT_EXPIRES_IN`).

## Security

- helmet (HTTP headers)
- cors (faqat `CORS_ORIGIN`)
- rate-limit (15 daqiqa / 300 req)
- bcryptjs parollar
- Joi validation
