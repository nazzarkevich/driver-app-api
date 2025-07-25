import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourierProfileDto } from './dtos/create-courier-profile.dto';
import { CourierProfileDto } from './dtos/courier-profile.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';

@Injectable()
export class CouriersService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProfile({ userId }: CreateCourierProfileDto): Promise<void> {
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

  async findAllCouriersProfiles(
    page: number,
  ): Promise<Pagination<CourierProfileDto>> {
    const [courierProfilesWithPagination, metadata] =
      await prismaWithPagination.courierProfile
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
          orderBy: {
            createdAt: 'desc',
          },
        })
        .withPages({ page });

    const courierProfiles = courierProfilesWithPagination.map(
      (profile) => new CourierProfileDto(profile),
    );

    return {
      items: courierProfiles,
      ...metadata,
    };
  }

  async findCourierProfile(id: number): Promise<CourierProfileDto> {
    const profile = await this.prismaService.courierProfile.findUnique({
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
