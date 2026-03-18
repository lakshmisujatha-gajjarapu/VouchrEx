import { PrismaClient } from '@prisma/client';

import { normalizeBrandName } from '../src/modules/brands/brand-name';
import { starterCatalog } from '../src/modules/brands/starter-catalog';

const prisma = new PrismaClient();

async function main() {
  for (const brand of starterCatalog) {
    const seededBrand = {
      ...brand,
      normalizedName: normalizeBrandName(brand.name)
    };

    await prisma.brand.upsert({
      where: { normalizedName: seededBrand.normalizedName },
      update: seededBrand,
      create: seededBrand
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
