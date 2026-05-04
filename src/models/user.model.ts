import { prisma } from '../lib/prisma.js';

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}
