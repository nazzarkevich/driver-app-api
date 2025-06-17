import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserType } from '@prisma/client';

export interface UserRequestType {
  name: string;
  id: number;
  iat: number;
  exp: number;
  type: UserType;
  isAdmin: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: any, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();

    return request.currentUser;
  },
);
