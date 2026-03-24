import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function seedIfNeeded() {
  const prisma = new PrismaClient();
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('Database is empty — running seed...');
      execSync('bun prisma/seed.ts', { stdio: 'inherit' });
      console.log('Seed complete.');
    } else {
      console.log(`Database already seeded (${userCount} users found).`);
    }
  } catch (err) {
    console.error('Seed check failed (will start server anyway):', (err as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await seedIfNeeded();
  await import('./src/index.js');
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
