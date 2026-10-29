import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from './errors.js';

const STATUS: Record<string, number> = {
  invalid_input: HttpStatus.BAD_REQUEST,
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  conflict: HttpStatus.CONFLICT,
  slot_unavailable: HttpStatus.CONFLICT,
};

/** Maps domain errors to HTTP status codes with a stable `{ error, message }` body. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(err: DomainError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(STATUS[err.code] ?? HttpStatus.BAD_REQUEST)
      .json({ error: err.code, message: err.message });
  }
}
