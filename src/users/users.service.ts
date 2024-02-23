import { Injectable, NotFoundException } from '@nestjs/common';

import { UserDto } from './dtos/user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dtos/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async findOne(id: number) {
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

  async findAll(): Promise<UserDto[]> {
    const allUsers = await this.prismaService.user.findMany({});

    return allUsers.map((user) => new UserDto(user));
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

  async remove(id: number) {
    await this.prismaService.user.delete({
      where: {
        id,
      },
    });
  }
}
