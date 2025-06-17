import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserDto } from './dtos/user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { Prisma, AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { UserRequestType } from './decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findOne(id: number, include?: Prisma.UserInclude): Promise<UserDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      include,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
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

  async update(
    id: number,
    attrs: Partial<UpdateUserDto>,
    currentUser?: UserRequestType,
  ): Promise<UserDto> {
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

    // Log the user update action
    await this.auditService.logUserAction(
      currentUser || null,
      AuditAction.UPDATE,
      'User',
      id.toString(),
      `Updated user profile for ${user.firstName} ${user.lastName}`,
      {
        updatedFields: Object.keys(attrs),
        previousValues: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        newValues: attrs,
      },
    );

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
