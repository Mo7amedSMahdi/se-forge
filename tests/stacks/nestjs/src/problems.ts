import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface FieldError {
  field: string;
  message: string;
}

/** An error that becomes RFC 9457 problem details (team API style). */
export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
    readonly errors?: FieldError[],
  ) {
    super(title);
  }
}

const flatten = (errors: ValidationError[], parent = ''): FieldError[] =>
  errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [...own, ...flatten(e.children ?? [], field)];
  });

/** Validation: whitelist the DTO, refuse unknown fields, answer 400 with field errors. */
export const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new ProblemError(400, 'Invalid input', undefined, flatten(errors)),
});

@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    let body: Record<string, unknown>;
    if (exception instanceof ProblemError) {
      body = {
        type: 'about:blank',
        title: exception.title,
        status: exception.status,
        detail: exception.detail,
        errors: exception.errors,
      };
    } else if (exception instanceof BadRequestException) {
      body = {
        type: 'about:blank',
        title: 'Invalid input',
        status: 400,
        errors: [{ field: 'body', message: exception.message }],
      };
    } else if (exception instanceof HttpException) {
      body = {
        type: 'about:blank',
        title: exception.message,
        status: exception.getStatus(),
      };
    } else {
      body = { type: 'about:blank', title: 'Internal error', status: 500 }; // never leak the exception
    }
    res
      .status(body.status as number)
      .type('application/problem+json')
      .json({ ...body, instance: req.url });
  }
}
