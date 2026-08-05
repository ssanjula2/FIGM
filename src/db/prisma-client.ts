export const isPostgresConfigured = (): boolean => {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
};

let prismaInstance: any = null;

export const getPrismaClient = (): any => {
  if (!prismaInstance && isPostgresConfigured()) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { Pool } = require('pg');

      const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
      const pool = new Pool({ connectionString });
      const adapter = new PrismaPg(pool);

      prismaInstance = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    } catch (err) {
      console.error('Prisma initialization error:', err);
      prismaInstance = null;
    }
  }
  return prismaInstance;
};

export const prisma = getPrismaClient();
