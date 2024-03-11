import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { UserType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

import { SignInDto } from '../dtos/auth.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DriversService } from 'src/profiles/drivers/drivers.service';
import { CouriersService } from 'src/profiles/couriers/couriers.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly driversService: DriversService,
    private readonly couriersService: CouriersService,
  ) {}

  async signUp({ email, password, type, firstName, ...rest }: CreateUserDto) {
    const userExists = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });

    if (userExists) {
      throw new ConflictException();
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prismaService.user.create({
      data: {
        business: {
          connect: { id: 1 },
        },
        email,
        firstName,
        password: hashedPassword,
        type,
        ...rest,
      },
    });

    if (this.isDriver(type)) {
      this.createDriverProfile(user.id);
    }

    if (this.isCourier(type)) {
      this.createCourierProfile(user.id);
    }

    return this.generateJWT(user.id, firstName);
  }

  async signIn({ email, password }: SignInDto) {
    const user = await this.prismaService.user.findUnique({ where: { email } });

    if (!user) {
      throw new HttpException('The email or password are incorrect', 400);
    }

    const hashedPassword = user.password;

    const isValidPassword = await bcrypt.compare(password, hashedPassword);

    if (!isValidPassword) {
      throw new HttpException('The email or password are incorrect', 400);
    }

    return this.generateJWT(user.id, user.firstName);
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

  private isDriver(type: UserType): boolean {
    return type === UserType.InternationalDriver;
  }

  private isCourier(type: UserType): boolean {
    return type === UserType.ParcelCourier;
  }

  private async generateJWT(id: number, name: string) {
    // TODO: Question: what data should be included in the token?
    return jwt.sign(
      {
        id: id,
        name: name,
      },
      process.env.JSON_TOKEN_KEY,
      {
        expiresIn: '1d',
      },
    );
  }
}
