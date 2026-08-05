"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.getPrismaClient = exports.isPostgresConfigured = void 0;
const isPostgresConfigured = () => {
    return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
};
exports.isPostgresConfigured = isPostgresConfigured;
let prismaInstance = null;
const getPrismaClient = () => {
    if (!prismaInstance && (0, exports.isPostgresConfigured)()) {
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
        }
        catch (err) {
            console.error('Prisma initialization error:', err);
            prismaInstance = null;
        }
    }
    return prismaInstance;
};
exports.getPrismaClient = getPrismaClient;
exports.prisma = (0, exports.getPrismaClient)();
//# sourceMappingURL=prisma-client.js.map