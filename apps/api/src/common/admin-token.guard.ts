import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

/** Protects staff and settings routes with the ADMIN_TOKEN env var (header: x-admin-token). */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) throw new ServiceUnavailableException('Admin routes are disabled: set ADMIN_TOKEN');
    const given = context.switchToHttp().getRequest<Request>().header('x-admin-token') ?? '';
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Invalid admin token');
    return true;
  }
}
