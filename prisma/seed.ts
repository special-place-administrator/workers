import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('PrekletoGeslo99', 10);
  await prisma.user.upsert({
    where: { email: 'admin@ocr.local' },
    update: {},
    create: { email: 'admin@ocr.local', password, role: 'admin' }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
