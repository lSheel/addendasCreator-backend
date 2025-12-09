/*
  Warnings:

  - Added the required column `fileName` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "uuid" TEXT;
