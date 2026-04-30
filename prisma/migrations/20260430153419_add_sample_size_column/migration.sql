/*
  Warnings:

  - Added the required column `sample_size` to the `profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "sample_size" INTEGER NOT NULL;
