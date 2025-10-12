import { UserRequestType } from '../users/decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      accessToken?: string;
      refreshToken?: string;
      tokenWasRefreshed?: boolean;
      currentUser?: UserRequestType;
      user?: any;
    }
  }
}
