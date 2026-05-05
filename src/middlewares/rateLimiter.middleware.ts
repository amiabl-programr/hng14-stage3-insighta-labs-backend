import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for auth endpoints: 10 requests per minute
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    return ipKeyGenerator(req.ip ?? '') || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests, please try again later.',
    });
  },
});

/**
 * Rate limiter for all other endpoints: 60 requests per minute per user
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    // @ts-ignore - user property is attached by auth middleware
    const userId =
      req.user && typeof req.user === 'object' && 'id' in req.user
        ? (req.user as { id: string }).id
        : undefined;

    return userId || ipKeyGenerator(req.ip ?? '') || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests, please try again later.',
    });
  },
});
