import crypto from 'crypto';
import { saveUser } from '../models/auth.model.js';
import { signAccessToken, signRefreshToken } from './token.service.js';
import { storeRefreshToken } from '../models/token.model.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';

const codeVerifierStore = new Map<
  string,
  { verifier: string; expiresAt: number }
>();
const deviceStore = new Map<string, DeviceEntry>();
const cliAuthStore = new Map<
  string,
  {
    access_token: string;
    refresh_token: string;
    user: {
      id: string;
      username: string;
      email: string | null;
      avatar_url: string;
      role: string;
    };
    expiresAt: number;
  }
>();

interface DeviceEntry {
  githubDeviceCode: string;
  interval: number;
  expiresAt: number;
  authorized: boolean;
  githubAccessToken?: string;
}

const TEMP_TOKEN_TTL = 10 * 60 * 1000;
const STATE_TTL = 5 * 60 * 1000;

type AuthResult = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    avatar_url: string;
    role: string;
  };
};

export function encodeState(data: {
  client: 'web' | 'cli';
  temp_token?: string;
  redirect_uri?: string;
}): string {
  return Buffer.from(JSON.stringify({ ...data, ts: Date.now() })).toString(
    'base64url',
  );
}

export function decodeState(state: string): {
  client: 'web' | 'cli';
  temp_token?: string;
  redirect_uri?: string;
  ts: number;
} {
  const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
  if (!parsed.client || !['web', 'cli'].includes(parsed.client)) {
    throw new Error('Invalid client type in state');
  }
  return parsed;
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function storeCodeVerifier(state: string, verifier: string): void {
  codeVerifierStore.set(state, {
    verifier,
    expiresAt: Date.now() + STATE_TTL,
  });
}

export function getCodeVerifier(state: string): string | null {
  const entry = codeVerifierStore.get(state);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    codeVerifierStore.delete(state);
    return null;
  }
  codeVerifierStore.delete(state);
  return entry.verifier;
}

async function exchangeOAuthCode(
  code: string,
  codeVerifier: string,
  redirectUri?: string,
): Promise<string> {
  logger.debug('[auth] Exchanging code for GitHub token', {
    code_prefix: code.slice(0, 8),
  });
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    }),
  });

  const data = await response.json();
  if (data.error) {
    logger.error('[auth] GitHub token exchange failed', {
      error: data.error,
      description: data.error_description,
    });
    throw new Error(data.error_description ?? data.error);
  }
  logger.info('[auth] GitHub token exchange successful');
  return data.access_token;
}

async function exchangeDeviceCode(githubDeviceCode: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      device_code: githubDeviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  const data = await response.json();
  if (data.error === 'authorization_pending')
    throw new Error('authorization_pending');
  if (data.error === 'slow_down') throw new Error('slow_down');
  if (data.error) throw new Error(data.error_description ?? data.error);
  return data.access_token;
}

async function finalizeAuth(githubToken: string): Promise<AuthResult> {
  logger.info('[auth] Fetching GitHub user data');
  const githubUser = await getGithubUserData(githubToken);
  logger.info('[auth] GitHub user fetched', {
    github_login: githubUser.login,
    github_id: githubUser.id,
  });
  const email = githubUser.email ?? (await getGithubUserEmail(githubToken));

  logger.info('[auth] Saving user to database');
  const user = await saveUser({
    github_id: githubUser.id,
    username: githubUser.login,
    email,
    avatar_url: githubUser.avatar_url,
  });
  logger.info('[auth] User saved', {
    user_id: user.id,
    role: user.role,
    is_new: !user.last_login_at,
  });

  // Upsert account with GitHub access token
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'github',
        providerAccountId: githubUser.id,
      },
    },
    create: {
      userId: user.id,
      provider: 'github',
      providerAccountId: githubUser.id,
      access_token: githubToken,
    },
    update: { access_token: githubToken },
  });

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);
  logger.info('[auth] JWTs issued', { user_id: user.id, role: user.role });

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });
  logger.info('[auth] Auth finalized', { user_id: user.id });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      role: user.role,
    },
  };
}

export async function initiateAuth(
  client: 'web' | 'cli',
  redirectUri?: string,
): Promise<{
  auth_url: string;
  temp_token?: string;
}> {
  logger.info('[auth] Initiating auth flow', {
    client,
    redirect_uri: redirectUri,
  });
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const callbackUrl = redirectUri ?? process.env.GITHUB_REDIRECT_URI;
  if (!callbackUrl) {
    throw new Error('GITHUB_REDIRECT_URI is required');
  }

  let callbackPath: string;
  try {
    callbackPath = new URL(callbackUrl).pathname;
  } catch {
    throw new Error('OAuth redirect_uri must be an absolute URL');
  }

  if (callbackPath !== '/auth/github/callback') {
    logger.warn(
      '[auth] GitHub redirect URI should point to the backend callback',
      {
        current: callbackUrl,
        expected: 'http(s)://<backend-url>/auth/github/callback',
      },
    );
  }

  const stateData: {
    client: 'web' | 'cli';
    temp_token?: string;
    redirect_uri?: string;
  } = { client, redirect_uri: callbackUrl };
  let tempToken: string | undefined;

  if (client === 'cli') {
    tempToken = crypto.randomBytes(32).toString('hex');
    stateData.temp_token = tempToken;
    logger.info('[auth] Generated CLI temp_token', {
      temp_token: tempToken.slice(0, 8) + '...',
    });
  }

  const state = encodeState(stateData);
  storeCodeVerifier(state, codeVerifier);
  logger.debug('[auth] Stored code verifier', {
    state_prefix: state.slice(0, 8),
  });

  const clientId = process.env.GITHUB_APP_CLIENT_ID!;
  logger.info('[auth] Building authorize URL', {
    client_id: clientId ? '***' + clientId.slice(-4) : 'UNDEFINED',
    redirect_uri: callbackUrl,
  });

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;

  return { auth_url: authUrl, temp_token: tempToken };
}

export async function handleCallback(
  code: string,
  state: string,
): Promise<{
  result: AuthResult;
  client: 'web' | 'cli';
  temp_token?: string;
}> {
  logger.info('[auth] Processing OAuth callback', {
    state_prefix: state.slice(0, 8),
  });
  const stateData = decodeState(state);
  logger.info('[auth] State decoded', {
    client: stateData.client,
    age_ms: Date.now() - stateData.ts,
  });
  const age = Date.now() - stateData.ts;
  if (age > STATE_TTL) {
    logger.error('[auth] State expired', { age_ms: age, ttl_ms: STATE_TTL });
    throw new Error('State expired');
  }

  const codeVerifier = getCodeVerifier(state);
  if (!codeVerifier) {
    logger.error('[auth] Code verifier not found or expired');
    throw new Error('Invalid or expired state parameter');
  }

  const githubToken = await exchangeOAuthCode(
    code,
    codeVerifier,
    stateData.redirect_uri,
  );
  const result = await finalizeAuth(githubToken);

  if (stateData.client === 'cli' && stateData.temp_token) {
    cliAuthStore.set(stateData.temp_token, {
      ...result,
      expiresAt: Date.now() + TEMP_TOKEN_TTL,
    });
    logger.info('[auth] CLI auth result stored', {
      temp_token: stateData.temp_token.slice(0, 8) + '...',
    });
  }

  return { result, client: stateData.client, temp_token: stateData.temp_token };
}

export function getCliAuthStatus(
  tempToken: string,
): AuthResult | 'pending' | 'expired' {
  logger.debug('[auth] CLI auth status check', {
    temp_token: tempToken.slice(0, 8) + '...',
  });
  if (!cliAuthStore.has(tempToken)) return 'pending';
  const entry = cliAuthStore.get(tempToken)!;
  if (Date.now() > entry.expiresAt) {
    cliAuthStore.delete(tempToken);
    logger.warn('[auth] CLI auth session expired');
    return 'expired';
  }
  cliAuthStore.delete(tempToken);
  logger.info('[auth] CLI auth completed', { user_id: entry.user.id });
  return {
    access_token: entry.access_token,
    refresh_token: entry.refresh_token,
    user: entry.user,
  };
}

export async function requestDeviceCode(): Promise<{
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}> {
  logger.info('[auth] Requesting GitHub device code');
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      scope: 'user:email',
    }),
  });

  const data = await response.json();
  if (data.error) {
    logger.error('[auth] Device code request failed', { error: data.error });
    throw new Error(data.error_description ?? data.error);
  }
  logger.info('[auth] Device code received', { expires_in: data.expires_in });

  deviceStore.set(data.device_code, {
    githubDeviceCode: data.device_code,
    interval: data.interval ?? 5,
    expiresAt: Date.now() + (data.expires_in ?? 900) * 1000,
    authorized: false,
  });

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    expires_in: data.expires_in,
    interval: data.interval ?? 5,
  };
}

export async function pollDeviceToken(
  deviceCode: string,
): Promise<AuthResult | 'authorization_pending' | 'slow_down' | 'expired'> {
  logger.debug('[auth] Polling device token', {
    device_code: deviceCode.slice(0, 8) + '...',
  });
  const entry = deviceStore.get(deviceCode);
  if (!entry) {
    logger.warn('[auth] Device code not found', {
      device_code: deviceCode.slice(0, 8) + '...',
    });
    return 'expired';
  }
  if (Date.now() > entry.expiresAt) {
    deviceStore.delete(deviceCode);
    logger.warn('[auth] Device code expired');
    return 'expired';
  }

  try {
    const githubToken = await exchangeDeviceCode(entry.githubDeviceCode);
    deviceStore.delete(deviceCode);
    return finalizeAuth(githubToken);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'authorization_pending') return 'authorization_pending';
    if (msg === 'slow_down') return 'slow_down';
    logger.error('[auth] Device token exchange failed', { error: msg });
    throw err;
  }
}

export async function getGithubUserData(token: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${token}` },
  });
  return response.json();
}

async function getGithubUserEmail(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `token ${token}` },
    });
    const emails = await response.json();
    const primary = emails.find(
      (e: { primary: boolean; email: string }) => e.primary,
    );
    return primary?.email ?? null;
  } catch {
    return null;
  }
}

export interface GithubUserData {
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
}

export async function createOrUpdateUser(userData: GithubUserData) {
  return saveUser(userData);
}
