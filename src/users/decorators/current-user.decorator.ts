import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserType } from '@prisma/client';

export interface UserRequestType {
  name: string;
  id: number;
  businessId: number;
  iat: number;
  exp: number;
  type: UserType;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: any, context: ExecutionContext): UserRequestType => {
    const request = context.switchToHttp().getRequest();
    return request.currentUser;
  },
);
