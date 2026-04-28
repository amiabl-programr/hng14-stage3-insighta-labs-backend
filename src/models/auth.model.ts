import { prisma } from '../lib/prisma.js';
import { GithubUserData } from '../services/auth.service.js';

export async function saveUser(user: GithubUserData) {
  const githubId = Number(user.github_id);

  if (!githubId) {
    throw new Error('Invalid GitHub ID');
  }

  // 1. Find existing account
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
    //   Update existing user + tokens
    const updated = await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: githubId,
        },
      },
      data: {
        access_token: user?.access_token,
        refresh_token: user?.refresh_token,
        expires_at: user?.expires_at,

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

  // Create new user + account
  const newAccount = await prisma.account.create({
    data: {
      provider: 'github',
      providerAccountId: githubId,

      access_token: user?.access_token,
      refresh_token: user?.refresh_token,
      expires_at: user?.expires_at,

      user: {
        create: {
          username: user.username,
          github_id: githubId, // fix  this repitition later
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
