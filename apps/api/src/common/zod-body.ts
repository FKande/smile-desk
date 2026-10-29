import type { z } from 'zod';
import { ValidationError } from './errors.js';

/** Parses a request body with a Zod schema, turning failures into a 400 with readable messages. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
  }
  return result.data;
}
