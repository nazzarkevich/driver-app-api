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

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly driversService: DriversService,
    private readonly couriersService: CouriersService,
    private readonly supabaseService: SupabaseService,
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

  async signUp({
    email,
    password,
    type,
    firstName,
    lastName,
    phoneNumber,
    countryCode,
  }: CreateUserDto): Promise<{ token: string; user: UserDto }> {
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

    // Then create the user in our database
    const user = await this.prismaService.user.create({
      data: {
        email,
        firstName,
        lastName,
        type,
        supabaseId: authData.user.id,
        business: {
          connect: { id: 1 }, // TODO: Question: how to pass businessId?
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
      user: new UserDto(user),
    };
  }

  async signIn({
    email,
    password,
  }: SignInDto): Promise<{ token: string; user: UserDto }> {
    console.log('email: ', email);
    console.log('password: ', password);

    const {
      data: { session },
      error,
    } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });

    console.log('session: ', session);
    console.log('error: ', error);

    if (error || !session) {
      throw new UnauthorizedException(error, 'Invalid credentials');
    }

    const user = await this.prismaService.user.findUnique({
      where: { supabaseId: session.user.id },
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
      token: session.access_token,
      user: new UserDto(user),
    };
  }
  ß;
}
