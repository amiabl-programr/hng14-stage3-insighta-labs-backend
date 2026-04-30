import morgan from 'morgan';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';

// ─── Winston (general app logs) ───────────────────────────────────────────────
export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message }) =>
              `${timestamp} [${level}]: ${message}`,
          ),
        ),
  ),
  transports: [
    new winston.transports.Console(),
    ...(isProduction
      ? [new winston.transports.File({ filename: 'logs/app.log' })]
      : []),
  ],
});

// ─── Morgan (HTTP request logs) ───────────────────────────────────────────────
const stream = isProduction
  ? fs.createWriteStream(path.join(process.cwd(), 'logs/access.log'), {
      flags: 'a',
    })
  : process.stdout;

export const httpLogger = morgan(isProduction ? 'combined' : 'dev', { stream });
