import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.DB_USER || 'root_admin';
  const password = process.env.DB_PASSWORD || '';
  const host = process.env.DB_HOST || 'postgres';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'game_db';
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// re export custom types
export { Prisma };
export type { 
  User, 
  OAuth, 
  UserKey, 
  Settings,
  UserRole,
  TokenType,
  TokenStatus,
} from '@prisma/client';
