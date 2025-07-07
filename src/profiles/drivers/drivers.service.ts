import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { Pagination } from 'src/dtos/pagination.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import prismaWithPagination from 'src/prisma/prisma-client';
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

  async findAll(page: number): Promise<Pagination<DriverProfileDto>> {
    const [driversProfilesWithPagination, metadata] =
      await prismaWithPagination.driverProfile
        .paginate({
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                imageUrl: {
                  select: {
                    id: true,
                    url: true,
                  },
                },
              },
            },
          },
        })
        .withPages({ page });

    const driversProfiles = driversProfilesWithPagination.map(
      (profile) => new DriverProfileDto(profile),
    );

    return {
      items: driversProfiles,
      ...metadata,
    };
  }

  async findOne(id: number): Promise<DriverProfileDto> {
    const profile = await this.prismaService.driverProfile.findUnique({
      where: {
        id,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    return new DriverProfileDto(profile);
  }

  async findManyByIds(driverProfileIds: number[]): Promise<DriverProfileDto[]> {
    if (driverProfileIds?.length === 0) {
      return [];
    }

    const driverProfiles = await this.prismaService.driverProfile.findMany({
      where: {
        id: {
          in: driverProfileIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
      },
    });

    return driverProfiles.map((profile) => new DriverProfileDto(profile));
  }

  async remove(id: number): Promise<void> {
    await this.prismaService.driverProfile.delete({
      where: {
        id,
      },
    });
  }
}
