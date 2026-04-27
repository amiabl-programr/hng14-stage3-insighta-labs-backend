import { Response } from 'express';

export const sendSuccessResponse = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
  meta?: Record<string, unknown>,
) => {
  const response: Record<string, unknown> = {
    status: 'success',
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta !== undefined) {
    Object.assign(response, meta);
  }

  return res.status(statusCode).json(response);
};

export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: unknown,
) => {
  const response: Record<string, unknown> = {
    status: 'error',
    message,
  };

  if (errors !== undefined) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};
