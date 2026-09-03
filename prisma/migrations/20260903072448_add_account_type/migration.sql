-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('NORMAL', 'ENGINEERING_TEST');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_type" "AccountType" NOT NULL DEFAULT 'NORMAL';
