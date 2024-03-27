import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourierProfileDto } from './dtos/create-courier-profile.dto';
import { CourierProfileDto } from './dtos/courier-profile.dto';

@Injectable()
export class CouriersService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProfile({ userId }: CreateCourierProfileDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.prismaService.courierProfile.findUnique({
      where: {
        userId,
      },
    });

    if (profile) {
      throw new ForbiddenException('User has profile');
    }

    await this.prismaService.courierProfile.create({
      data: {
        userId: user.id,
      },
    });
  }

  async findAllCouriersProfiles(): Promise<CourierProfileDto[]> {
    const allProfiles = await this.prismaService.courierProfile.findMany({});

    return allProfiles.map((profile) => new CourierProfileDto(profile));
  }

  async findCourierProfile(id: number): Promise<CourierProfileDto> {
    const profile = await this.prismaService.courierProfile.findUnique({
      where: {
        id,
      },
    });

    if (!profile) {
      throw new NotFoundException();
    }

    return new CourierProfileDto(profile);
  }

  async findManyByIds(
    couriersProfileIds: number[],
  ): Promise<CourierProfileDto[]> {
    if (couriersProfileIds?.length === 0) {
      return [];
    }

    const couriersProfiles = await this.prismaService.courierProfile.findMany({
      where: {
        id: {
          in: couriersProfileIds,
        },
      },
    });

    return couriersProfiles.map((profile) => new CourierProfileDto(profile));
  }

  async removeCourierProfile(id: number): Promise<void> {
    await this.prismaService.courierProfile.delete({
      where: {
        id,
      },
    });
  }
}
