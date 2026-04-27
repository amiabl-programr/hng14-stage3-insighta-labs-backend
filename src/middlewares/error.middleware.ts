import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { sendErrorResponse } from '../utils/responseHandler.js';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!(err instanceof AppError) || !err.isOperational) {
    console.error('ERROR :', err);
  }

  if (err instanceof AppError) {
    if (err.statusCode === 502 && err.api) {
      console.error(`${err.api} returned an invalid response`, err);
      return sendErrorResponse(res, 502, "Unable to process request at this time");
    }
    return sendErrorResponse(res, err.statusCode, err.message);
  }

  return sendErrorResponse(res, 500, 'Internal server error');
};
