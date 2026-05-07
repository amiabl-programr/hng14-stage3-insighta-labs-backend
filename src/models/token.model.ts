import { prisma } from '../lib/prisma.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function storeRefreshToken(userId: string, refreshToken: string) {
  return prisma.account.updateMany({
    where: { userId, provider: 'github' },
    data: {
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
}

export async function consumeRefreshToken(refreshToken: string) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { refresh_token: refreshToken },
      include: { user: true },
    });

    if (!account) return null;
    if (account.expires_at && account.expires_at <= new Date()) {
      await tx.account.update({
        where: { id: account.id },
        data: { refresh_token: null, expires_at: null },
      });
      return null;
    }

    await tx.account.update({
      where: { id: account.id },
      data: { refresh_token: null, expires_at: null },
    });

    return account;
  });
}

export async function deleteRefreshToken(userId: string) {
  return prisma.account.updateMany({
    where: { userId, provider: 'github' },
    data: { refresh_token: null, expires_at: null },
  });
}
