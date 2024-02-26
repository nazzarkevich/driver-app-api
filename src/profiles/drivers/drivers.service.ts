import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { DriverProfileDto } from './dtos/driver-profile.dto';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProfile({ userId }: CreateDriverProfileDto): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.prismaService.driverProfile.findUnique({
      where: {
        userId,
      },
    });

    if (profile) {
      throw new ForbiddenException('User has profile');
    }

    await this.prismaService.driverProfile.create({
      data: {
        userId: user.id,
      },
    });
  }

  async findAll(): Promise<DriverProfileDto[]> {
    const allProfiles = await this.prismaService.driverProfile.findMany({});

    return allProfiles.map((profile) => new DriverProfileDto(profile));
  }

  async findOne(id: number): Promise<DriverProfileDto> {
    const profile = await this.prismaService.driverProfile.findUnique({
      where: {
        id,
      },
    });

    if (!profile) {
      throw new NotFoundException();
    }

    return new DriverProfileDto(profile);
  }

  async remove(id: number): Promise<void> {
    await this.prismaService.driverProfile.delete({
      where: {
        id,
      },
    });
  }
}
