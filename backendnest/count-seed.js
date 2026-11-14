const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const tables = ['permission','role','terminal','user','route','vehicleGroup','vehicle','dispatchFeeRule','device','weeklyAssignment','queueEntry','dispatchRecord','violation','override','auditLog'];
    for (const t of tables) {
      const c = await prisma[t].count();
      console.log(t, c);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
