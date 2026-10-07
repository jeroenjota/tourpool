import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../auth.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (response.headersSent) {
    _next(error);
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      message: 'Validation failed',
      issues: error.issues
    });
    return;
  }

  console.error(error);
  response.status(500).json({ message: 'Internal server error' });
};