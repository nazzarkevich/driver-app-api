import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthProvider, UserType } from '@prisma/client';

import { SignInDto } from '../dtos/sign-in.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { RegisterCustomerDto } from '../dtos/register-customer.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { UserDto } from '../dtos/user.dto';
import { AuthProfilesService } from '../auth-profiles/auth-profiles.service';
import { BusinessesService } from 'src/businesses/businesses.service';
import { TokenStorageService } from 'src/auth/token-storage.service';
import {
  ADMIN_EXTRA_PERMISSIONS,
  AppName,
  getAllowedApps,
  ROLE_PERMISSIONS,
} from 'src/permissions/permissions';

@Injectable()
export class AuthService {
  private refreshLocks = new Map<string, Promise<any>>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly authProfilesService: AuthProfilesService,
    private readonly businessesService: BusinessesService,
    private readonly tokenStorageService: TokenStorageService,
  ) {}

  private async findUserBySupabaseId(supabaseId: string) {
    const authProfile = await this.prismaService.authProfile.findUnique({
      where: {
        provider_providerId: {
          provider: AuthProvider.Supabase,
          providerId: supabaseId,
        },
      },
      include: {
        user: {
          include: {
            phoneNumber: true,
            driverProfile: true,
            courierProfile: true,
            business: true,
          },
        },
      },
    });

    return authProfile?.user ?? null;
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
      throw new BadRequestException('Refresh token is required');
    }

    const lockKey = refreshToken.substring(0, 20);

    if (this.refreshLocks.has(lockKey)) {
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
      const { data, error } =
        await this.supabaseService.client.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (error) {
        if (error.message?.includes('Already Used')) {
          throw new UnauthorizedException(
            'Refresh token has already been used. Please use the latest tokens or log in again.',
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
        throw new UnauthorizedException(
          'Failed to refresh session. Please log in again.',
        );
      }

      this.authProfilesService
        .updateLastSignIn(data.session.user.id)
        .catch((err) =>
          console.warn(`⚠️  Failed to update last sign-in: ${err.message}`),
        );

      const user = await this.findUserBySupabaseId(data.session.user.id);

      if (!user) {
        throw new UnauthorizedException(
          'User not found in application database',
        );
      }

      if (user.isBlocked) {
        throw new UnauthorizedException('User is blocked');
      }

      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30);

      if (oldAccessToken) {
        this.tokenStorageService.updateAccessToken(
          oldAccessToken,
          data.session.access_token,
          data.session.refresh_token,
          refreshTokenExpiresAt,
        );
      } else {
        this.tokenStorageService.storeRefreshToken(
          data.session.access_token,
          data.session.refresh_token,
          user.id.toString(),
          refreshTokenExpiresAt,
        );
      }

      return {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: new UserDto(user),
        dbUser: user,
      };
    } catch (error) {
      if (oldAccessToken) {
        this.tokenStorageService.removeToken(oldAccessToken);
      }

      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new UnauthorizedException(
        'An error occurred while refreshing your session. Please log in again.',
      );
    }
  }

  async logout(accessToken: string, userId?: string): Promise<void> {
    try {
      const { error } = await this.supabaseService.client.auth.signOut();
      if (error) {
        console.error('Error signing out from Supabase:', error.message);
      }

      if (userId) {
        this.tokenStorageService.removeUserTokens(userId);
      } else {
        this.tokenStorageService.removeToken(accessToken);
      }
    } catch (error) {
      console.error('Error during logout:', error);
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
    firstName,
    lastName,
    phoneNumber,
    countryCode,
  }: CreateUserDto): Promise<{
    token: string;
    refreshToken: string;
    user: UserDto;
  }> {
    const { data: authData, error: authError } =
      await this.supabaseService.client.auth.signUp({
        email,
        password,
        options: { data: { firstName, lastName } },
      });

    if (authError || !authData.user) {
      throw new BadRequestException(
        authError?.message || 'Failed to create user',
      );
    }

    const businessId = await this.businessesService.getDefaultBusinessId();

    const user = await this.prismaService.user.create({
      data: {
        email,
        firstName,
        lastName,
        type: UserType.Customer,
        business: { connect: { id: businessId } },
        phoneNumber: {
          create: { countryCode, number: phoneNumber },
        },
      },
      include: { phoneNumber: true },
    });

    await this.authProfilesService.createOrUpdate(
      user.id,
      authData.user.id,
      AuthProvider.Supabase,
      new Date(),
      email,
    );

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

  async signIn({ email, password, app }: SignInDto): Promise<{
    token: string;
    refreshToken: string;
    allowedApps: AppName[];
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

    this.authProfilesService
      .updateLastSignIn(session.user.id)
      .catch((err) =>
        console.warn(`⚠️  Failed to update last sign-in: ${err.message}`),
      );

    let user = await this.findUserBySupabaseId(session.user.id);

    if (!user) {
      const userByEmail = await this.prismaService.user.findFirst({
        where: { email: session.user.email },
        include: {
          phoneNumber: true,
          driverProfile: true,
          courierProfile: true,
          business: true,
        },
      });

      if (userByEmail) {
        await this.authProfilesService.createOrUpdate(
          userByEmail.id,
          session.user.id,
          AuthProvider.Supabase,
          new Date(),
          email,
        );
        user = userByEmail;
      } else {
        throw new UnauthorizedException(
          'User not found in application database',
        );
      }
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    const rolePermissions = ROLE_PERMISSIONS[user.type] ?? [];
    const effectivePermissions = user.isAdmin
      ? [...rolePermissions, ...ADMIN_EXTRA_PERMISSIONS]
      : rolePermissions;
    const allowedApps = user.isSuperAdmin
      ? Object.values(AppName)
      : getAllowedApps(effectivePermissions);

    if (app && !allowedApps.includes(app)) {
      throw new ForbiddenException(`Access to '${app}' is not allowed`);
    }

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
      allowedApps,
      user: new UserDto(user),
    };
  }

  async handleOAuthSignIn(
    provider: string,
    token: string,
    app?: AppName,
  ): Promise<{
    token: string;
    refreshToken: string;
    allowedApps: AppName[];
    user: UserDto;
  }> {
    const { data, error } =
      await this.supabaseService.client.auth.signInWithIdToken({
        provider: provider as any,
        token,
      });

    if (error || !data.session) {
      throw new UnauthorizedException(
        error?.message || `Failed to authenticate with ${provider}`,
      );
    }

    const supabaseUser = data.session.user;

    let user = await this.findUserBySupabaseId(supabaseUser.id);

    this.authProfilesService
      .updateLastSignIn(supabaseUser.id)
      .catch((err) =>
        console.warn(`⚠️  Failed to update auth profile: ${err.message}`),
      );

    if (!user) {
      const finalBusinessId =
        await this.businessesService.getDefaultBusinessId();

      const userData = supabaseUser.user_metadata || {};

      user = await this.prismaService.user.create({
        data: {
          email: supabaseUser.email,
          firstName: userData.full_name?.split(' ')[0] || userData.name || null,
          lastName: userData.full_name?.split(' ').slice(1).join(' ') || null,
          type: UserType.Customer,
          business: { connect: { id: finalBusinessId } },
          ...(userData.phone && {
            phoneNumber: {
              create: { countryCode: '+44', number: userData.phone },
            },
          }),
        },
        include: {
          phoneNumber: true,
          driverProfile: true,
          courierProfile: true,
          business: true,
        },
      });

      await this.authProfilesService.createOrUpdate(
        user.id,
        supabaseUser.id,
        AuthProvider.Supabase,
        new Date(),
        supabaseUser.email,
      );
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    const rolePermissions = ROLE_PERMISSIONS[user.type] ?? [];
    const effectivePermissions = user.isAdmin
      ? [...rolePermissions, ...ADMIN_EXTRA_PERMISSIONS]
      : rolePermissions;
    const allowedApps = user.isSuperAdmin
      ? Object.values(AppName)
      : getAllowedApps(effectivePermissions);

    if (app && !allowedApps.includes(app)) {
      throw new ForbiddenException(`Access to '${app}' is not allowed`);
    }

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
      allowedApps,
      user: new UserDto(user),
    };
  }

  async registerCustomer(
    dto: RegisterCustomerDto,
    supabaseUserId: string,
  ): Promise<{ user: UserDto }> {
    const existing =
      await this.authProfilesService.findByProviderId(supabaseUserId);
    if (existing) {
      throw new ConflictException(
        'This Supabase account is already registered',
      );
    }

    const businessId = await this.businessesService.getDefaultBusinessId();

    const customerProfile = await this.prismaService.customerProfile.findFirst({
      where: {
        businessId,
        phoneNumber: {
          number: dto.phone,
          countryCode: dto.countryCode,
        },
      },
      include: { user: true },
    });

    if (customerProfile?.user) {
      throw new ConflictException(
        'This customer profile already has an account',
      );
    }

    const user = await this.prismaService.$transaction(async (prisma) => {
      let profileId: number;

      if (!customerProfile) {
        const phone = await prisma.phone.create({
          data: { number: dto.phone, countryCode: dto.countryCode },
        });

        const newProfile = await prisma.customerProfile.create({
          data: {
            businessId: businessId,
            phoneId: phone.id,
            firstName: dto.firstName ?? null,
            lastName: dto.lastName ?? null,
            email: dto.email,
          },
        });

        profileId = newProfile.id;
      } else {
        profileId = customerProfile.id;

        await prisma.customerProfile.update({
          where: { id: profileId },
          data: { email: dto.email },
        });
      }

      const newUser = await prisma.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName ?? customerProfile?.firstName ?? null,
          lastName: dto.lastName ?? customerProfile?.lastName ?? null,
          type: UserType.Customer,
          businessId: businessId,
          customerProfileId: profileId,
        },
        include: { phoneNumber: true },
      });

      await prisma.authProfile.create({
        data: {
          userId: newUser.id,
          provider: AuthProvider.Supabase,
          providerId: supabaseUserId,
          email: dto.email,
          phone: `${dto.countryCode}${dto.phone}`,
          lastSignIn: new Date(),
        },
      });

      return newUser;
    });

    return { user: new UserDto(user) };
  }
}
