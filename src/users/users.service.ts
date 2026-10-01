import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserDto } from './dtos/user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { Prisma, AuditAction, UserType } from '@prisma/client';
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
    const protectedAttrs = attrs as Partial<UpdateUserDto> & {
      type?: UserType;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
    };
    if (
      protectedAttrs.type !== undefined ||
      protectedAttrs.isAdmin !== undefined ||
      protectedAttrs.isSuperAdmin !== undefined
    ) {
      throw new ForbiddenException(
        'Role and privilege flags cannot be changed through this endpoint',
      );
    }

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

  async updateRole(
    id: number,
    type: UserType,
    currentUser: UserRequestType,
  ): Promise<UserDto> {
    const target = await this.prismaService.user.findUnique({
      where: { id },
      include: { courierProfile: true, driverProfile: true },
    });
    if (
      !target ||
      (!currentUser.isSuperAdmin &&
        target.businessId !== currentUser.businessId)
    ) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (currentUser.id === id && !currentUser.isSuperAdmin) {
      throw new ForbiddenException('You cannot change your own role');
    }
    if ((target.isAdmin || target.isSuperAdmin) && !currentUser.isSuperAdmin) {
      throw new ForbiddenException(
        'Only a super admin can change an admin user role',
      );
    }

    const customerTypes: UserType[] = [
      UserType.Customer,
      UserType.Member,
      UserType.Subscriber,
    ];
    if (customerTypes.includes(type) && !target.customerProfileId) {
      throw new BadRequestException(
        'A customer role requires a linked customer profile',
      );
    }

    const updatedUser = await this.prismaService.$transaction(async (tx) => {
      if (target.driverProfile) {
        await tx.driverProfile.update({
          where: { userId: id },
          data: { isDeleted: type !== UserType.InternationalDriver },
        });
      } else if (type === UserType.InternationalDriver) {
        await tx.driverProfile.create({ data: { userId: id } });
      }

      if (target.courierProfile) {
        await tx.courierProfile.update({
          where: { userId: id },
          data: { isDeleted: type !== UserType.ParcelCourier },
        });
      } else if (type === UserType.ParcelCourier) {
        await tx.courierProfile.create({ data: { userId: id } });
      }

      return tx.user.update({
        where: { id },
        data: { type },
        include: { courierProfile: true, driverProfile: true },
      });
    });

    await this.auditService.logUserAction(
      currentUser,
      AuditAction.UPDATE,
      'User',
      id.toString(),
      `Changed user role from ${target.type} to ${type}`,
      {
        updatedFields: ['type'],
        previousValues: { type: target.type },
        newValues: { type },
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
