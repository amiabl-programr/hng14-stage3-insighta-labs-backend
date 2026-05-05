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

const app = express();

const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? 'change-me-in-production',
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
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
