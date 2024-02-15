import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserRequestType {
  name: string;
  id: number;
  iat: number;
  exp: number;
}

export const CurrentUser = createParamDecorator(
  (data: any, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();

    return request.currentUser;
  },
);
