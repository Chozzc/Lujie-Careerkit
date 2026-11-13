import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const database =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = database;
}

// ponytail: filter top-level reads/writes once; relations retain context for restoration.
// Raw SQL writers must check deletedAt explicitly.
const trashModels = new Set(["ResumeVersion", "Application", "InterviewSession", "InterviewPreparation", "AgentThread"]);
const activeOperations = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany"]);
export const prisma = database.$extends({
  query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    if (trashModels.has(model) && activeOperations.has(operation)) {
      const filtered = args as { where?: Record<string, unknown> };
      filtered.where = { ...filtered.where, deletedAt: null };
    }
    return query(args);
  } } },
}) as unknown as PrismaClient;
