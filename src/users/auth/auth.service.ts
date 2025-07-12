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

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly driversService: DriversService,
    private readonly couriersService: CouriersService,
    private readonly supabaseService: SupabaseService,
    private readonly authProfilesService: AuthProfilesService,
    private readonly businessesService: BusinessesService,
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
  ): Promise<{ token: string; user: UserDto }> {
    const { data, error } =
      await this.supabaseService.client.auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Update the auth profile's last sign-in time
    await this.authProfilesService.updateLastSignIn(data.session.user.id);

    const user = await this.prismaService.user.findUnique({
      where: { supabaseId: data.session.user.id },
      include: {
        phoneNumber: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found in application database');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    return {
      token: data.session.access_token,
      user: new UserDto(user),
    };
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

    // Create or update the auth profile
    await this.authProfilesService.createOrUpdate(
      authData.user.id,
      'email', // Default provider is email
      new Date(),
    );

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

    // Update the auth profile's last sign-in time
    await this.authProfilesService.updateLastSignIn(session.user.id);

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

    // Create or update the auth profile
    await this.authProfilesService.createOrUpdate(
      supabaseUser.id,
      provider,
      new Date(),
    );

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

    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: new UserDto(user),
    };
  }
}
