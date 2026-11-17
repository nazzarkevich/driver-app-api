import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { UserRequestType } from 'src/users/decorators/current-user.decorator';

export function resolveBusinessScope(
  user: UserRequestType,
  requested?: string,
) {
  const id = requested === undefined ? user.businessId : Number(requested);
  if (
    requested !== undefined &&
    (!/^[1-9]\d*$/.test(requested) || !Number.isSafeInteger(id))
  ) {
    throw new BadRequestException('Invalid business ID');
  }
  if (!user.isSuperAdmin && id !== user.businessId) {
    throw new ForbiddenException('Cannot access another business');
  }
  return id;
}
