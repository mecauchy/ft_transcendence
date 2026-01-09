// prisma client singleon
import {PrismaClient, Prisma} from '@prisma/client';

// multi-instance security
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
 });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// re-export custom types
export * from '@prisma/client';
export {Prisma};
export type {PrismaClient};

// export instance as default
export default prisma;
