import { prisma } from "@crypto-bot-platform/prisma";
import bcrypt from "bcryptjs";

const EMAIL = process.argv[2] || "longsyee@gmail.com";
const PASSWORD = process.argv[3] || "123123123";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`User ${EMAIL} already exists. Updating to admin + verified...`);
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "admin", emailVerified: true },
    });
    console.log("Updated existing user to admin.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      role: "admin",
      emailVerified: true,
      referralCode: "REF-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
  });

  await prisma.wallet.create({
    data: {
      userId: user.id,
      bscAddressIndex: 0,
      bscAddress: "",
      usdtBalance: 0,
      tokenBalance: 0,
    },
  });

  console.log(`Admin user created:`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Role:     admin`);
  console.log(`  ID:       ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
