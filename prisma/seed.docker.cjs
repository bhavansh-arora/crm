// Plain CommonJS admin-seed used by docker-entrypoint.sh at container start.
// Kept separate from prisma/seed.ts (used by `npm run db:seed` in local dev)
// so the production image never needs the TypeScript toolchain at runtime.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SEED_ADMIN_NAME || "Admin";
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists, skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, role: "ADMIN" },
  });

  console.log(`Created admin user: ${email}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
