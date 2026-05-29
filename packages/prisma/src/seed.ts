import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('AdminPass123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@bot.local' },
    update: {},
    create: {
      email: 'admin@bot.local',
      passwordHash,
      role: 'admin',
      emailVerified: true,
      referralCode: 'ADMIN001',
    },
  });

  console.log('Seeded admin user admin@bot.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
