// src/models/token.model.ts
import { prisma } from '../lib/prisma.js';

export async function storeRefreshToken(userId: string, refreshToken: string) {
  return prisma.account.updateMany({
    where: { userId, provider: 'github' },
    data: {
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
    },
  });
}

export async function consumeRefreshToken(refreshToken: string) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { refresh_token: refreshToken },
      include: { user: true },
    });

    if (!account) return null; // token not found or already consumed

    // Invalidate immediately
    await tx.account.update({
      where: { id: account.id },
      data: { refresh_token: null, expires_at: null },
    });

    return account; // includes account.user for the controller
  });
}

export async function deleteRefreshToken(userId: string) {
  return prisma.account.updateMany({
    where: { userId, provider: 'github' },
    data: { refresh_token: null, expires_at: null },
  });
}
