import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function main() {
  // Check if DB has been seeded
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('Database is empty — running seed...');
    execSync('tsx prisma/seed.ts', { stdio: 'inherit' });
    console.log('Seed complete.');
  } else {
    console.log(`Database already seeded (${userCount} users found).`);
  }
  await prisma.$disconnect();

  // Start the server
  await import('./src/index.js');
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
