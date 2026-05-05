import { prisma } from '../lib/prisma.js';
import { GithubUserData } from '../services/auth.service.js';
import { logger } from '../config/logger.js';

export async function saveUser(user: GithubUserData) {
  const githubId =
    typeof user.github_id === 'string'
      ? parseInt(user.github_id, 10)
      : user.github_id;
  logger.info('github ID', githubId);

  if (!githubId || isNaN(githubId)) {
    throw new Error('Invalid GitHub ID');
  }

  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'github',
        providerAccountId: githubId,
      },
    },
    include: { user: true },
  });

  if (existingAccount) {
    const updated = await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: githubId,
        },
      },
      data: {
        user: {
          update: {
            username: user.username,
            email: user.email ?? undefined,
            avatar_url: user.avatar_url,
          },
        },
      },
      include: { user: true },
    });

    return updated.user;
  }

  const newAccount = await prisma.account.create({
    data: {
      provider: 'github',
      providerAccountId: githubId,

      user: {
        create: {
          username: user.username,
          github_id: githubId,
          email: user.email ?? undefined,
          avatar_url: user.avatar_url,
          role: 'ANALYST',
          is_active: true,
        },
      },
    },
    include: { user: true },
  });

  return newAccount.user;
}
