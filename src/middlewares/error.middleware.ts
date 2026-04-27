import { Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { sendErrorResponse } from '../utils/responseHandler.js';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
) => {
  if (!(err instanceof AppError) || !err.isOperational) {
    console.error('ERROR :', err);
    throw new AppError(err.message, 500, false, err.stack);
  }

  if (err instanceof AppError) {
    if (err.statusCode === 502 && err.api) {
      throw new AppError(err.message, 502, false, err.stack);
      return sendErrorResponse(
        res,
        502,
        'Unable to process request at this time',
      );
    }
    return sendErrorResponse(res, err.statusCode, err.message);
  }

  return sendErrorResponse(res, 500, 'Internal server error');
};
