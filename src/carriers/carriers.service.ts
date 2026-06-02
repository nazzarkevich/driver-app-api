import { Injectable } from '@nestjs/common';
import { UserType } from '@prisma/client';

import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { CarrierDto } from './dtos/carrier.dto';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  isBlocked: true,
  type: true,
  phoneNumber: {
    select: {
      number: true,
      countryCode: true,
    },
  },
  imageUrl: {
    select: {
      id: true,
      url: true,
    },
  },
  courierProfile: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  driverProfile: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

@Injectable()
export class CarriersService {
  async findAll(
    page: number,
    search?: string,
  ): Promise<Pagination<CarrierDto>> {
    const where: any = {
      isDeleted: false,
      OR: [
        { type: UserType.InternationalDriver, driverProfile: { isNot: null } },
        { type: UserType.ParcelCourier, courierProfile: { isNot: null } },
      ],
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            {
              phoneNumber: {
                number: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        },
      ];
    }

    const [usersWithPagination, metadata] = await prismaWithPagination.user
      .paginate({
        where,
        select: USER_SELECT,
        orderBy: {
          createdAt: 'desc',
        },
      })
      .withPages({ page });

    const carriers = usersWithPagination.map((user) => {
      const isDriver = user.type === UserType.InternationalDriver;
      const profile = isDriver ? user.driverProfile : user.courierProfile;

      return new CarrierDto({
        id: profile?.id,
        type: isDriver ? 'driver' : 'courier',
        userId: user.id,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isBlocked: user.isBlocked,
          phoneNumber: user.phoneNumber,
          imageUrl: user.imageUrl,
        },
        createdAt: profile?.createdAt,
        updatedAt: profile?.updatedAt,
      });
    });

    return {
      items: carriers,
      ...metadata,
    };
  }
}
