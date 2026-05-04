import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service.js';
import { findUserById } from '../models/user.model.js';
import { logger } from '../config/logger.js';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let token: string | undefined;
  let source: string = 'none';

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    source = 'bearer';
  } else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
    source = 'cookie';
  }

  if (!token) {
    logger.warn('[auth] No token found', {
      method: req.method,
      path: req.path,
      source,
    });
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(token) as { sub: string; role: string };
    const user = await findUserById(payload.sub);
    if (!user) {
      logger.warn('[auth] User not found for token', {
        user_id: payload.sub,
        role: payload.role,
      });
      return res
        .status(401)
        .json({ status: 'error', message: 'Invalid or expired token' });
    }
    if (!user.is_active) {
      logger.warn('[auth] User account inactive', {
        user_id: user.id,
        username: user.username,
      });
      return res
        .status(403)
        .json({ status: 'error', message: 'Account inactive' });
    }

    req.user = user;
    logger.debug('[auth] Authentication successful', {
      user_id: user.id,
      source,
    });
    next();
  } catch {
    logger.warn('[auth] Token verification failed', {
      method: req.method,
      path: req.path,
    });
    return res
      .status(401)
      .json({ status: 'error', message: 'Invalid or expired token' });
  }
}
