import type { Request, Response } from 'express';
import {
  initiateAuth as initiateAuthFlow,
  handleCallback,
  getCliAuthStatus,
} from '../services/auth.service.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/token.service.js';
import {
  consumeRefreshToken,
  deleteRefreshToken,
  storeRefreshToken,
} from '../models/token.model.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccessResponse } from '../utils/responseHandler.js';
import { logger } from '../config/logger.js';

const isProduction = process.env.NODE_ENV === 'production';

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.clearCookie('x-csrf-token');
}

export const initiateAuth = catchAsync(async (req: Request, res: Response) => {
  const client = req.query.client as 'web' | 'cli';
  const redirectUri = req.query.redirect_uri as string;

  if (!client || !['web', 'cli'].includes(client)) {
    logger.warn('[auth] Missing or invalid client type', { client });
    return res.status(400).json({
      status: 'error',
      message: 'client query param is required (web|cli)',
    });
  }

  logger.info('[auth] Initiate request received', { client });
  const result = await initiateAuthFlow(client, redirectUri);

  if (client === 'cli') {
    logger.info('[auth] CLI auth URL returned');
    return sendSuccessResponse(res, 200, 'CLI auth initiated', {
      auth_url: result.auth_url,
      temp_token: result.temp_token,
    });
  }

  logger.info('[auth] Web redirect initiated');
  res.redirect(result.auth_url);
});

export const handleOAuthCallback = catchAsync(
  async (req: Request, res: Response) => {
    const { code, state, temp_token } = req.query;

    if (temp_token) {
      logger.info('[auth] CLI token poll received', {
        temp_token: (temp_token as string).slice(0, 8) + '...',
      });
      const stored = getCliAuthStatus(temp_token as string);

      if (stored === 'pending') {
        logger.debug('[auth] CLI auth still pending');
        return res.status(202).json({ status: 'pending' });
      }
      if (stored === 'expired') {
        logger.warn('[auth] CLI auth session expired');
        return res
          .status(410)
          .json({ status: 'error', message: 'Session expired' });
      }

      logger.info('[auth] CLI auth tokens delivered');
      return sendSuccessResponse(res, 200, 'Authentication successful', stored);
    }

    if (!code || !state) {
      logger.warn('[auth] Missing code or state in callback', {
        has_code: !!code,
        has_state: !!state,
      });
      return res
        .status(400)
        .json({ status: 'error', message: 'Missing code or state parameter' });
    }

    try {
      logger.info('[auth] GitHub callback received', {
        state_prefix: (state as string).slice(0, 8),
      });
      const { result, client } = await handleCallback(
        code as string,
        state as string,
      );

      if (client === 'cli') {
        logger.info('[auth] CLI callback — showing success page');
        res.setHeader('Content-Type', 'text/html');
        return res.send(
          '<html><body><h2>Login successful</h2><p>You may close this tab and return to your CLI.</p></body></html>',
        );
      }

      setAuthCookies(res, result.access_token, result.refresh_token);
      logger.info(
        '[auth] Web callback — cookies set, returning user details',
      );
      return res.json({
        status: 'success',
        message: 'Authentication successful',
        data: { user: result.user },
      });
    } catch (err: unknown) {
      logger.error('[auth] Callback failed', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback`);
    }
  },
);

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const refreshTokenStr = req.cookies?.refresh_token ?? req.body.refresh_token;

  if (!refreshTokenStr) {
    logger.warn('[auth] Refresh attempt without token');
    return res
      .status(401)
      .json({ status: 'error', message: 'Refresh token required' });
  }

  try {
    logger.info('[auth] Refresh token rotation started');
    verifyRefreshToken(refreshTokenStr);
    const account = await consumeRefreshToken(refreshTokenStr);

    if (!account) {
      logger.error('[auth] Refresh token already consumed or invalid');
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ status: 'error', message: 'Invalid or expired refresh token' });
    }

    const user = account.user;
    if (!user || !user.is_active) {
      logger.warn('[auth] Refresh blocked — user inactive', {
        user_id: user?.id,
      });
      clearAuthCookies(res);
      return res
        .status(403)
        .json({ status: 'error', message: 'Account inactive' });
    }

    const newAccessToken = signAccessToken(user.id, user.role);
    const newRefreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, newRefreshToken, newAccessToken);

    setAuthCookies(res, newAccessToken, newRefreshToken);
    logger.info('[auth] Token refresh successful', { user_id: user.id });
    return sendSuccessResponse(res, 200, 'Token refreshed', {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    });
  } catch {
    logger.error('[auth] Refresh token verification failed');
    clearAuthCookies(res);
    return res
      .status(401)
      .json({ status: 'error', message: 'Invalid or expired refresh token' });
  }
});

export const handleLogout = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  logger.info('[auth] Logout requested', {
    user_id: userId ?? 'unauthenticated',
  });
  if (userId) {
    await deleteRefreshToken(userId);
  }
  clearAuthCookies(res);
  logger.info('[auth] Logout complete');
  return sendSuccessResponse(res, 200, 'Logged out successfully');
});
