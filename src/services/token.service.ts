import jwt from 'jsonwebtoken';

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: '15m',
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!);
}
