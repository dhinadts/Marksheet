const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
async function main() {
  const existing = await prisma.user.findMany({
    select: { id: true, username: true, email: true, status: true },
    orderBy: { username: 'asc' },
  });
  console.log(existing);
  return;
  const passwordHash = await argon2.hash('Qwerty@123');
  const result = await prisma.user.updateMany({
    where: { username: 'prof01' },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      status: 'ACTIVE',
      tokenVersion: { increment: 1 },
    },
  });
  if (result.count !== 1) throw new Error(`Expected one prof01 account, found ${result.count}`);
  console.log('prof01 credentials reset');
}
main().finally(() => prisma.$disconnect());
