import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Injectable,
} from '@nestjs/common';
import { TokenUtils } from 'src/utils/token.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class UserInterceptor implements NestInterceptor {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async intercept(context: ExecutionContext, handler: CallHandler) {
    const request = context.switchToHttp().getRequest();

    // If currentUser is already set by the guard, don't override it
    if (request.currentUser) {
      return handler.handle();
    }

    const token = TokenUtils.extractTokenFromHeader(request);
    let currentUser = null;

    if (token) {
      try {
        const {
          data: { user },
          error,
        } = await this.supabaseService.client.auth.getUser(token);

        if (!error && user) {
          // Load user with business context from database
          const dbUser = await this.prismaService.user.findUnique({
            where: { supabaseId: user.id },
            include: { business: true },
          });

          if (dbUser && dbUser.business?.isActive) {
            currentUser = {
              id: dbUser.id,
              name: `${dbUser.firstName} ${dbUser.lastName}`,
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
              businessId: dbUser.businessId,
              type: dbUser.type,
              isAdmin: dbUser.isAdmin,
              isSuperAdmin: dbUser.isSuperAdmin,
            };
          }
        }
      } catch (error) {
        console.error('Supabase token verification failed:', error);
        // Don't throw - let the guard handle authentication
      }
    }

    request.currentUser = currentUser;
    return handler.handle();
  }
}
