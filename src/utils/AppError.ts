export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly api?: string;

  constructor(
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    api?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.api = api;

    Error.captureStackTrace(this, this.constructor);
  }
}
