import { Injectable, NotFoundException } from '@nestjs/common';

import { UserDto } from './dtos/user.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import prismaWithPagination from 'src/prisma/prisma-client';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async findOne(id: number): Promise<UserDto> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException();
    }

    return new UserDto(user);
  }

  async findAll({ page }: { page: number }): Promise<Pagination<UserDto>> {
    const [usersWithPagination, metadata] = await prismaWithPagination.user
      .paginate({
        include: {
          courierProfile: true,
          driverProfile: true,
        },
      })
      .withPages({ page });

    const users = usersWithPagination.map((user) => new UserDto(user));

    return {
      items: users,
      ...metadata,
    };
  }

  async update(id: number, attrs: Partial<UpdateUserDto>): Promise<UserDto> {
    const user = await this.findOne(id);

    if (!user) {
      throw new Error('User not found');
    }

    Object.assign(user, attrs);

    const updatedUser = await this.prismaService.user.update({
      where: {
        id,
      },
      data: attrs,
    });

    return new UserDto(updatedUser);
  }

  async remove(id: number): Promise<void> {
    await this.prismaService.user.delete({
      where: {
        id,
      },
    });
  }
}
