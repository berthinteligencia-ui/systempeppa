import { prisma } from "./src/lib/prisma";

async function check() {
  console.log("Prisma keys:", Object.keys(prisma));
  // @ts-ignore
  console.log("Plan model:", !!prisma.plan);
  // @ts-ignore
  console.log("Subscription model:", !!prisma.subscription);
  // @ts-ignore
  console.log("Invoice model:", !!prisma.invoice);
}

check().catch(console.error);
