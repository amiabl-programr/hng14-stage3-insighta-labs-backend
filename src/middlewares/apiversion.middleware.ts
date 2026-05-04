import { NextFunction, Request, Response } from 'express';

export function requireApiVersion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.headers['x-api-version'] !== '1') {
    return res
      .status(400)
      .json({ error: 'Missing or invalid X-API-Version header. Expected: 1' });
  }
  next();
}
