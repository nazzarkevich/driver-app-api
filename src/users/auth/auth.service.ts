import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserType } from '@prisma/client';

import { SignInDto } from '../dtos/sign-in.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DriversService } from 'src/profiles/drivers/drivers.service';
import { CouriersService } from 'src/profiles/couriers/couriers.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { UserDto } from '../dtos/user.dto';
import { AuthProfilesService } from '../auth-profiles/auth-profiles.service';
import { BusinessesService } from 'src/businesses/businesses.service';
import { TokenStorageService } from 'src/auth/token-storage.service';

@Injectable()
export class AuthService {
  private refreshLocks = new Map<string, Promise<any>>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly driversService: DriversService,
    private readonly couriersService: CouriersService,
    private readonly supabaseService: SupabaseService,
    private readonly authProfilesService: AuthProfilesService,
    private readonly businessesService: BusinessesService,
    private readonly tokenStorageService: TokenStorageService,
  ) {}

  private isDriver(type: UserType): boolean {
    return type === UserType.InternationalDriver;
  }

  private isCourier(type: UserType): boolean {
    return type === UserType.ParcelCourier;
  }

  private async createDriverProfile(userId: number): Promise<void> {
    await this.driversService.createProfile({
      userId,
    });
  }

  private async createCourierProfile(userId: number): Promise<void> {
    await this.couriersService.createProfile({
      userId,
    });
  }

  async refreshToken(
    refreshToken: string,
    oldAccessToken?: string,
  ): Promise<{
    token: string;
    refreshToken: string;
    user: UserDto;
    dbUser?: any;
  }> {
    if (!refreshToken || refreshToken.trim() === '') {
      console.error('❌ Refresh token is missing or empty');
      throw new BadRequestException('Refresh token is required');
    }

    const lockKey = refreshToken.substring(0, 20);

    if (this.refreshLocks.has(lockKey)) {
      console.log('⏳ Refresh already in progress for this token, waiting...');
      return this.refreshLocks.get(lockKey);
    }

    const refreshPromise = this.performTokenRefresh(
      refreshToken,
      oldAccessToken,
    );
    this.refreshLocks.set(lockKey, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      this.refreshLocks.delete(lockKey);
      console.log('🔓 Released refresh lock for token');
    }
  }

  private async performTokenRefresh(
    refreshToken: string,
    oldAccessToken?: string,
  ): Promise<{
    token: string;
    refreshToken: string;
    user: UserDto;
    dbUser?: any;
  }> {
    try {
      console.log('🔄 Attempting to refresh session with Supabase...');
      const { data, error } =
        await this.supabaseService.client.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (error) {
        console.error('❌ Supabase refresh failed:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });

        if (error.message?.includes('Already Used')) {
          throw new UnauthorizedException(
            'Refresh token has already been used. This usually means another request already refreshed your session. Please use the latest tokens or log in again.',
          );
        }

        if (error.message?.includes('expired') || error.status === 401) {
          throw new UnauthorizedException(
            'Refresh token has expired. Please log in again.',
          );
        }

        throw new UnauthorizedException(
          `Token refresh failed: ${error.message}`,
        );
      }

      if (!data.session) {
        console.error('❌ No session returned from Supabase');
        throw new UnauthorizedException(
          'Failed to refresh session. Please log in again.',
        );
      }

      console.log(
        `✅ Supabase session refreshed for user: ${data.session.user.id}`,
      );

      this.authProfilesService
        .updateLastSignIn(data.session.user.id)
        .catch((err) => {
          console.warn(
            `⚠️  Failed to update last sign-in (non-critical): ${err.message}`,
          );
        });

      const user = await this.prismaService.user.findUnique({
        where: { supabaseId: data.session.user.id },
        include: {
          phoneNumber: true,
          business: true,
        },
      });

      if (!user) {
        console.error(
          `❌ User not found with supabaseId: ${data.session.user.id}`,
        );
        throw new UnauthorizedException(
          'User not found in application database',
        );
      }

      if (user.isBlocked) {
        console.error(`❌ User is blocked: ${user.email}`);
        throw new UnauthorizedException('User is blocked');
      }

      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30);

      if (oldAccessToken) {
        console.log(`🔄 Updating token storage for user ${user.id}`);
        this.tokenStorageService.updateAccessToken(
          oldAccessToken,
          data.session.access_token,
          data.session.refresh_token,
          refreshTokenExpiresAt,
        );
      } else {
        console.log(`💾 Storing new tokens for user ${user.id}`);
        this.tokenStorageService.storeRefreshToken(
          data.session.access_token,
          data.session.refresh_token,
          user.id.toString(),
          refreshTokenExpiresAt,
        );
      }

      console.log(
        `✅ Token refresh completed successfully for user ${user.id}`,
      );

      return {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: new UserDto(user),
        dbUser: user,
      };
    } catch (error) {
      if (oldAccessToken) {
        console.log(
          `🧹 Cleaning up old token due to refresh failure: ${error.message}`,
        );
        this.tokenStorageService.removeToken(oldAccessToken);
      }

      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('❌ Unexpected error during token refresh:', error);
      throw new UnauthorizedException(
        'An error occurred while refreshing your session. Please log in again.',
      );
    }
  }

  async logout(accessToken: string, userId?: string): Promise<void> {
    try {
      // Sign out from Supabase
      const { error } = await this.supabaseService.client.auth.signOut();

      if (error) {
        console.error('Error signing out from Supabase:', error.message);
      }

      // Remove tokens from storage
      if (userId) {
        this.tokenStorageService.removeUserTokens(userId);
      } else {
        this.tokenStorageService.removeToken(accessToken);
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Always clean up tokens even if Supabase logout fails
      if (userId) {
        this.tokenStorageService.removeUserTokens(userId);
      } else {
        this.tokenStorageService.removeToken(accessToken);
      }
    }
  }

  async signUp({
    email,
    password,
    type,
    firstName,
    lastName,
    phoneNumber,
    countryCode,
  }: CreateUserDto): Promise<{
    token: string;
    refreshToken: string;
    user: UserDto;
  }> {
    // First create the user in Supabase
    const { data: authData, error: authError } =
      await this.supabaseService.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            firstName,
            lastName,
          },
        },
      });

    if (authError || !authData.user) {
      throw new BadRequestException(
        authError?.message || 'Failed to create user',
      );
    }

    this.authProfilesService
      .createOrUpdate(authData.user.id, 'email', new Date())
      .catch((err) => {
        console.warn(
          `⚠️  Failed to create auth profile (non-critical): ${err.message}`,
        );
      });

    // Get the default business ID
    const businessId = await this.businessesService.getDefaultBusinessId();

    // Then create the user in our database
    const user = await this.prismaService.user.create({
      data: {
        email,
        firstName,
        lastName,
        type: type || UserType.Member,
        supabaseId: authData.user.id,
        business: {
          connect: { id: businessId },
        },
        phoneNumber: {
          create: {
            countryCode,
            number: phoneNumber,
          },
        },
      },
      include: {
        phoneNumber: true,
      },
    });

    if (this.isDriver(type)) {
      await this.createDriverProfile(user.id);
    }

    if (this.isCourier(type)) {
      await this.createCourierProfile(user.id);
    }

    // Store refresh token for automatic refresh handling
    if (authData.session?.access_token && authData.session?.refresh_token) {
      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30);

      this.tokenStorageService.storeRefreshToken(
        authData.session.access_token,
        authData.session.refresh_token,
        user.id.toString(),
        refreshTokenExpiresAt,
      );
    }

    return {
      token: authData.session?.access_token,
      refreshToken: authData.session?.refresh_token,
      user: new UserDto(user),
    };
  }

  async signIn({ email, password }: SignInDto): Promise<{
    token: string;
    refreshToken: string;
    user: UserDto;
  }> {
    const {
      data: { session },
      error,
    } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !session) {
      throw new UnauthorizedException(error, 'Invalid credentials');
    }

    this.authProfilesService.updateLastSignIn(session.user.id).catch((err) => {
      console.warn(
        `⚠️  Failed to update last sign-in (non-critical): ${err.message}`,
      );
    });

    console.log(`Looking for user with supabaseId: ${session.user.id}`);
    console.log(`User email from Supabase: ${session.user.email}`);

    const user = await this.prismaService.user.findUnique({
      where: { supabaseId: session.user.id },
      include: {
        phoneNumber: true,
      },
    });

    if (!user) {
      console.log(`No user found with supabaseId: ${session.user.id}`);
      // Let's also check if a user exists with this email
      const userByEmail = await this.prismaService.user.findUnique({
        where: { email: session.user.email },
        include: { phoneNumber: true },
      });

      if (userByEmail) {
        console.log(`Found user by email but supabaseId mismatch:`, {
          dbSupabaseId: userByEmail.supabaseId,
          authSupabaseId: session.user.id,
        });
        // Update the supabaseId in the database to match
        const updatedUser = await this.prismaService.user.update({
          where: { email: session.user.email },
          data: { supabaseId: session.user.id },
          include: { phoneNumber: true },
        });
        console.log(`Updated user supabaseId successfully`);
        return {
          token: session.access_token,
          refreshToken: session.refresh_token,
          user: new UserDto(updatedUser),
        };
      }

      throw new UnauthorizedException('User not found in application database');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    // Store refresh token for automatic refresh handling
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30);

    this.tokenStorageService.storeRefreshToken(
      session.access_token,
      session.refresh_token,
      user.id.toString(),
      refreshTokenExpiresAt,
    );

    return {
      token: session.access_token,
      refreshToken: session.refresh_token,
      user: new UserDto(user),
    };
  }

  async handleOAuthSignIn(
    provider: string,
    token: string,
    businessId?: number,
  ): Promise<{ token: string; refreshToken: string; user: UserDto }> {
    // Exchange the provider token for a Supabase session
    const { data, error } =
      await this.supabaseService.client.auth.signInWithIdToken({
        provider: provider as any, // 'google', 'facebook', etc.
        token,
      });

    if (error || !data.session) {
      throw new UnauthorizedException(
        error?.message || `Failed to authenticate with ${provider}`,
      );
    }

    const supabaseUser = data.session.user;

    // Check if the user already exists in our database
    let user = await this.prismaService.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { phoneNumber: true },
    });

    this.authProfilesService
      .createOrUpdate(supabaseUser.id, provider, new Date())
      .catch((err) => {
        console.warn(
          `⚠️  Failed to update auth profile (non-critical): ${err.message}`,
        );
      });

    // If the user doesn't exist in our database yet, create them
    if (!user) {
      // Use provided businessId or default business
      const finalBusinessId =
        businessId || (await this.businessesService.getDefaultBusinessId());

      const userData = supabaseUser.user_metadata || {};

      user = await this.prismaService.user.create({
        data: {
          email: supabaseUser.email,
          firstName:
            userData.full_name?.split(' ')[0] || userData.name || 'User',
          lastName: userData.full_name?.split(' ').slice(1).join(' ') || '',
          type: UserType.Member, // Default type for OAuth users
          supabaseId: supabaseUser.id,
          business: {
            connect: { id: finalBusinessId },
          },
          // Create phone if provided by OAuth provider
          ...(userData.phone && {
            phoneNumber: {
              create: {
                countryCode: '+44', // Default country code
                number: userData.phone,
              },
            },
          }),
        },
        include: {
          phoneNumber: true,
        },
      });
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    // Store refresh token for automatic refresh handling
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30);

    this.tokenStorageService.storeRefreshToken(
      data.session.access_token,
      data.session.refresh_token,
      user.id.toString(),
      refreshTokenExpiresAt,
    );

    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: new UserDto(user),
    };
  }
}
