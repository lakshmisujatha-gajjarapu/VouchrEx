import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class AdminAccessService {
  requireAdminAccess(adminToken: string | undefined) {
    const configuredToken = process.env.ADMIN_API_TOKEN?.trim();

    if (!configuredToken) {
      throw new ServiceUnavailableException(
        'ADMIN_API_TOKEN is required for manual Phase 1 admin operations.'
      );
    }

    if (!adminToken) {
      throw new UnauthorizedException('Admin token is required.');
    }

    const expected = Buffer.from(configuredToken);
    const provided = Buffer.from(adminToken);

    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException('Admin token is invalid.');
    }
  }
}
