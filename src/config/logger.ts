import morgan from 'morgan';
import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

// ─── Winston (general app logs) ───────────────────────────────────────────────
export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, metadata }) => {
            const meta =
              metadata && Object.keys(metadata as object).length
                ? ' ' + JSON.stringify(metadata)
                : '';
            return `${timestamp} [${level}]: ${message}${meta}`;
          }),
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
export const httpLogger = morgan(isProduction ? 'combined' : 'dev', {
  stream: {
    write: (message: string) => {
      logger.debug('[http] ' + message.trim());
    },
  },
});
