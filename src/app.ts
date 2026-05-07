import express from 'express';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import profilesRouter from './routes/profile.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import authRouter from './routes/auth.route.js';
import { AppError } from './utils/AppError.js';
import { httpLogger } from './config/logger.js';
import {
  authLimiter,
  apiLimiter,
} from './middlewares/rateLimiter.middleware.js';
import { setupSwagger } from './config/swagger.js';

const app = express();

setupSwagger(app);

const allowedOrigins = new Set(
  (
    process.env.CORS_ORIGIN ??
    process.env.FRONTEND_URL ??
    'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  getSessionIdentifier: (req) => req.user?.id ?? 'anonymous',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-API-Version, X-CSRF-Token',
  );
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);

app.use('/auth', authLimiter);
app.use('/api/profiles', apiLimiter);

// Routes
app.use('/auth', authRouter);
app.use(doubleCsrfProtection);
app.use('/api/profiles', profilesRouter);

app.use((req, _res, next) => {
  next(new AppError('Route not found', 404));
});

app.use(errorHandler);

export default app;
