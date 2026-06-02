/**
 * Faqat Farg'ona tumanlari qo'shadi.
 * Mavjud bo'lsa — o'tkazib yuboradi (upsert).
 * Boshqa ma'lumotlarga tegmaydi.
 *
 * Ishga tushirish:
 *   cd backend
 *   node src/seed/seedTumans.js
 */

import '../config/mongoose-plugin.js';
import { connectDB } from '../config/db.js';
import { Viloyat } from '../models/Viloyat.js';
import { Tuman } from '../models/Tuman.js';
import mongoose from 'mongoose';

const FARGONA_TUMANLAR = [
  { nameUz: "Farg'ona tumani",    nameRu: 'Ферганский район',     nameEn: 'Fergana District'     },
  { nameUz: "Bag'dod tumani",     nameRu: 'Багдадский район',     nameEn: 'Bagdod District'      },
  { nameUz: 'Beshariq tumani',    nameRu: 'Бешарыкский район',    nameEn: 'Beshariq District'    },
  { nameUz: "Bo'ka tumani",       nameRu: 'Бувайдинский район',   nameEn: "Bo'ka District"       },
  { nameUz: "Dang'ara tumani",    nameRu: 'Дангаринский район',   nameEn: "Dang'ara District"    },
  { nameUz: 'Furqat tumani',      nameRu: 'Фуркатский район',     nameEn: 'Furqat District'      },
  { nameUz: 'Oltiariq tumani',    nameRu: 'Алтыарыкский район',   nameEn: 'Oltiariq District'    },
  { nameUz: "O'zbekiston tumani", nameRu: 'Узбекистанский район', nameEn: 'Uzbekiston District'  },
  { nameUz: "Qo'qon tumani",      nameRu: 'Кокандский район',     nameEn: "Qo'qon District"      },
  { nameUz: "Qo'shtepa tumani",   nameRu: 'Куштепинский район',   nameEn: "Qo'shtepa District"   },
  { nameUz: 'Rishton tumani',     nameRu: 'Риштанский район',     nameEn: 'Rishtan District'     },
  { nameUz: "So'x tumani",        nameRu: 'Сохский район',        nameEn: "So'x District"        },
  { nameUz: 'Toshloq tumani',     nameRu: 'Ташлакский район',     nameEn: 'Toshloq District'     },
  { nameUz: "Uchko'prik tumani",  nameRu: 'Учкупрыкский район',   nameEn: "Uchko'prik District"  },
  { nameUz: 'Yozyovon tumani',    nameRu: 'Язъяванский район',    nameEn: 'Yozyovon District'    },
];

async function run() {
  await connectDB();

  // Farg'ona viloyatini topamiz
  const fargona = await Viloyat.findOne({ code: 'fargona' });
  if (!fargona) {
    console.error("✗ Farg'ona viloyati topilmadi. Avval 'npm run seed' ni ishga tushiring.");
    process.exit(1);
  }

  console.log(`✓ Farg'ona viloyati topildi: ${fargona._id}`);

  let added = 0;
  let skipped = 0;

  for (const tm of FARGONA_TUMANLAR) {
    const exists = await Tuman.findOne({ nameUz: tm.nameUz, viloyat: fargona._id });
    if (exists) {
      console.log(`  ⟳ mavjud: ${tm.nameUz}`);
      skipped++;
    } else {
      await Tuman.create({ ...tm, viloyat: fargona._id });
      console.log(`  + qo'shildi: ${tm.nameUz}`);
      added++;
    }
  }

  console.log(`\n✓ Tugadi: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
