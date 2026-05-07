import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import profilesRouter from './routes/profile.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import authRouter from './routes/auth.route.js';
import { AppError } from './utils/AppError.js';
import { httpLogger } from './config/logger.js';
import { setupSwagger } from './config/swagger.js';
import { doubleCsrfProtection, generateToken } from './lib/csrf.js';

const app = express();

setupSwagger(app);

const allowedOrigins = (
  process.env.CORS_ORIGIN ??
  process.env.FRONTEND_URL ??
  'http://localhost:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-API-Version',
      'X-CSRF-Token',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);

app.get('/csrf-token', (req, res) => {
  const token = generateToken(req, res);
  res.json({ token });
});

app.use('/auth', authRouter);

app.use('/api/profiles', doubleCsrfProtection, profilesRouter);

app.use((req, _res, next) => {
  next(new AppError('Route not found', 404));
});

app.use(errorHandler);

export default app;
