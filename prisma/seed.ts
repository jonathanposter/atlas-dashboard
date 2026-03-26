import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create default user with password "atlas2026"
  const hash = await bcrypt.hash("atlas2026", 12);
  await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: { password: hash },
  });

  // Create initial project state
  await prisma.projectState.upsert({
    where: { id: 1 },
    update: {},
    create: {
      currentPhase: 0,
      stats: {
        hypothesesGenerated: 0,
        hypothesesKilled: 0,
        strategiesInPipeline: 0,
        strategiesDeployed: 0,
      },
    },
  });

  // Create initial log entry
  await prisma.activityLog.create({
    data: {
      event: "Atlas Mission Control initialised",
      type: "system",
    },
  });

  await prisma.activityLog.create({
    data: {
      event: "Pipeline ready — Phase 0: Sharpen the Axe",
      type: "milestone",
    },
  });

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
