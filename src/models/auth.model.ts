import {prisma} from '../lib/prisma.js';
import { User } from '../generated/prisma/client.js';

export async function saveUser(user: User) {
  try {
  const githubId = Number(user.github_id);

  if (isNaN(githubId)) {
    throw new Error("Invalid GitHub ID");
  }

  const savedUser = await prisma.user.upsert({
    where: {
      github_id: githubId,
    },
    update: {
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      last_login_at: new Date(),
    },
    create: {
      github_id: githubId,
      username: user.username,
      email: user.email ?? undefined,
      avatar_url: user.avatar_url,
      role: "ANALYST",
      is_active: true,
      last_login_at: new Date(),
    },
  });

  return savedUser;
} catch (err) {
  console.error(err);
  throw new Error("GitHub auth failed");
}
}