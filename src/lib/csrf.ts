import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';

const CSRF_SECRET = process.env.CSRF_SECRET;

if (!CSRF_SECRET) {
  throw new Error('CSRF_SECRET env var must be set');
}

const csrf = doubleCsrf({
  getSecret: () => CSRF_SECRET,

  getSessionIdentifier: (req: Request) => {
    return (
      (req as Request & { cookies?: Record<string, string> }).cookies
        ?.refresh_token || 'guest-session'
    );
  },

  cookieName: 'x-csrf-token',

  cookieOptions: {
    httpOnly: false,

    secure: process.env.NODE_ENV === 'production',

    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },

  size: 64,

  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

export const doubleCsrfProtection = csrf.doubleCsrfProtection;
export const generateToken = csrf.generateCsrfToken;
