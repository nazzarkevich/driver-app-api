import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserDto } from './dtos/user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import {
  Prisma,
  AuditAction,
  UserType,
  StaffApprovalStatus,
} from '@prisma/client';
import { canManageStaff, STAFF_TYPES } from './staff-access';
import { AuditService } from '../audit/audit.service';
import { UserRequestType } from './decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findOne(
    id: number,
    include?: Prisma.UserInclude,
    currentUser?: UserRequestType,
  ): Promise<UserDto> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id,
        isDeleted: false,
        ...(currentUser ? { businessId: currentUser.businessId } : {}),
      },
      include,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return new UserDto(user);
  }

  async updateSelf(
    currentUser: UserRequestType,
    body: Record<string, unknown>,
  ) {
    const allowed = ['firstName', 'lastName', 'phoneNumber'];
    if (
      !body ||
      Array.isArray(body) ||
      typeof body !== 'object' ||
      Object.keys(body).some((key) => !allowed.includes(key))
    ) {
      throw new BadRequestException(
        'Only name and contact phone can be updated',
      );
    }
    const data: Prisma.UserUpdateInput = {};
    for (const key of ['firstName', 'lastName'] as const) {
      if (body[key] !== undefined) {
        if (
          typeof body[key] !== 'string' ||
          !body[key].trim() ||
          body[key].trim().length > 100
        ) {
          throw new BadRequestException(
            'Names must contain between 1 and 100 characters',
          );
        }
        data[key] = body[key].trim();
      }
    }
    let phone: { countryCode: string; number: string } | undefined;
    if (body.phoneNumber !== undefined) {
      const input = body.phoneNumber as Record<string, unknown>;
      if (
        !input ||
        Array.isArray(input) ||
        typeof input !== 'object' ||
        Object.keys(input).some(
          (key) => !['countryCode', 'number'].includes(key),
        ) ||
        typeof input.countryCode !== 'string' ||
        typeof input.number !== 'string'
      ) {
        throw new BadRequestException('A complete contact phone is required');
      }
      const countryCode = input.countryCode.trim();
      let number = input.number.replace(/[\s()-]/g, '');
      if (
        (countryCode === '+380' || countryCode === '+44') &&
        number.startsWith('0')
      ) {
        number = number.slice(1);
      }
      if (
        !/^\+[1-9]\d{0,3}$/.test(countryCode) ||
        !/^\d+$/.test(number) ||
        countryCode.length - 1 + number.length < 7 ||
        countryCode.length - 1 + number.length > 15 ||
        (countryCode === '+380' && number.length !== 9) ||
        (countryCode === '+44' && number.length !== 10)
      ) {
        throw new BadRequestException('Contact phone format is invalid');
      }
      phone = { countryCode, number };
    }
    const updated = await this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: currentUser.id,
          businessId: currentUser.businessId,
          isDeleted: false,
        },
      });
      if (!user) throw new NotFoundException('User not found');
      if (phone) {
        const record = await tx.phone.upsert({
          where: { countryCode_number: phone },
          create: phone,
          update: {},
        });
        data.phoneNumber = { connect: { id: record.id } };
      }
      return tx.user.update({
        where: { id: user.id },
        data,
        include: {
          phoneNumber: true,
          business: true,
          driverProfile: true,
          courierProfile: true,
        },
      });
    });
    await this.auditService.log({
      userId: currentUser.id,
      businessId: currentUser.businessId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: String(currentUser.id),
      description: 'Updated own contact profile',
      metadata: { updatedFields: Object.keys(body) },
    });
    return new UserDto(updated);
  }

  async findAll({
    page,
    currentUser,
  }: {
    page: number;
    currentUser: UserRequestType;
  }): Promise<Pagination<UserDto>> {
    const [usersWithPagination, metadata] = await prismaWithPagination.user
      .paginate({
        where: { businessId: currentUser.businessId, isDeleted: false },
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

    const user = await this.findOne(id, undefined, currentUser);

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
    return this.changeStaffAccess(id, type, currentUser, false);
  }

  async pendingStaff(
    page: number,
    search: string | undefined,
    actor: UserRequestType,
    type?: 'driver' | 'courier',
  ): Promise<Pagination<UserDto>> {
    if (!canManageStaff(actor))
      throw new ForbiddenException('Only managers and admins can review staff');
    const where: Prisma.UserWhereInput = {
      businessId: actor.businessId,
      isDeleted: false,
      staffApprovalStatus: StaffApprovalStatus.Pending,
      type: type
        ? type === 'driver'
          ? UserType.InternationalDriver
          : UserType.ParcelCourier
        : { in: STAFF_TYPES },
      ...(search?.trim()
        ? {
            OR: [
              { firstName: { contains: search.trim(), mode: 'insensitive' } },
              { lastName: { contains: search.trim(), mode: 'insensitive' } },
              { email: { contains: search.trim(), mode: 'insensitive' } },
              {
                phoneNumber: {
                  number: { contains: search.trim(), mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, totalCount] = await this.prismaService.$transaction([
      this.prismaService.user.findMany({
        where,
        include: { phoneNumber: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * 15,
        take: 15,
      }),
      this.prismaService.user.count({ where }),
    ]);
    const pageCount = Math.ceil(totalCount / 15);
    return {
      items: items.map((user) => new UserDto(user)),
      totalCount,
      currentPage: page,
      pageCount,
      isFirstPage: page === 1,
      isLastPage: page >= pageCount,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: page < pageCount ? page + 1 : null,
    };
  }

  async approveStaff(id: number, type: UserType, actor: UserRequestType) {
    if (!STAFF_TYPES.includes(type))
      throw new BadRequestException('Choose driver or courier');
    return this.changeStaffAccess(id, type, actor, true);
  }

  private async changeStaffAccess(
    id: number,
    type: UserType,
    actor: UserRequestType,
    approving: boolean,
  ): Promise<UserDto> {
    if (!canManageStaff(actor))
      throw new ForbiddenException('Only managers and admins can manage staff');
    if (id === actor.id)
      throw new ForbiddenException('You cannot change your own role');
    if (!actor.isSuperAdmin && !STAFF_TYPES.includes(type)) {
      throw new ForbiddenException(
        'Staff management can only assign driver or courier roles',
      );
    }
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const target = await tx.user.findFirst({
            where: { id, businessId: actor.businessId, isDeleted: false },
            include: { driverProfile: true, courierProfile: true },
          });
          if (!target) throw new NotFoundException('Account not found');
          if (
            !actor.isSuperAdmin &&
            (target.isAdmin ||
              target.isSuperAdmin ||
              target.type === UserType.Manager ||
              target.type === UserType.Moderator)
          ) {
            throw new ForbiddenException(
              'Only a super admin can change a privileged account',
            );
          }
          if (target.isBlocked)
            throw new ConflictException({
              code: 'STAFF_ACCOUNT_BLOCKED',
              message:
                'Unblock the account before approving or changing its role',
            });
          const pending =
            target.staffApprovalStatus === StaffApprovalStatus.Pending;
          if (!approving && pending)
            throw new ConflictException('Approve this account first');
          if (
            approving &&
            (!STAFF_TYPES.includes(target.type) ||
              (!pending && target.type !== type))
          ) {
            throw new ConflictException(
              'The account was already updated. Refresh and use Change type.',
            );
          }
          if (
            [UserType.Customer, UserType.Member, UserType.Subscriber].includes(
              type as any,
            ) &&
            !target.customerProfileId
          ) {
            throw new BadRequestException(
              'A customer role requires a linked customer profile',
            );
          }
          // Even a repair must not deactivate a historical counterpart with unfinished work.
          const [journeys, collections] = await Promise.all([
            type !== UserType.InternationalDriver && target.driverProfile
              ? tx.journey.findMany({
                  where: {
                    businessId: actor.businessId,
                    isDeleted: false,
                    status: { not: 'Cancelled' },
                    closedAt: null,
                    driverProfiles: { some: { id: target.driverProfile.id } },
                  },
                  select: { id: true },
                })
              : [],
            type !== UserType.ParcelCourier && target.courierProfile
              ? tx.courierJourney.findMany({
                  where: {
                    businessId: actor.businessId,
                    isDeleted: false,
                    isCompleted: false,
                    courierProfiles: { some: { id: target.courierProfile.id } },
                  },
                  select: { id: true },
                })
              : [],
          ]);
          if (journeys.length || collections.length)
            throw new ConflictException({
              statusCode: 409,
              code: 'STAFF_HAS_UNFINISHED_WORK',
              message:
                'Спочатку завершіть або перепризначте роботу: ' +
                [
                  ...journeys.map(({ id }) => `поїздка #${id}`),
                  ...collections.map(({ id }) => `збір #${id}`),
                ].join(', '),
              journeyIds: journeys.map(({ id }) => id),
              courierJourneyIds: collections.map(({ id }) => id),
            });
          const alreadyConsistent =
            !pending &&
            target.type === type &&
            (type !== UserType.InternationalDriver ||
              (target.driverProfile && !target.driverProfile.isDeleted)) &&
            (type !== UserType.ParcelCourier ||
              (target.courierProfile && !target.courierProfile.isDeleted)) &&
            (type === UserType.InternationalDriver ||
              !target.driverProfile ||
              target.driverProfile.isDeleted) &&
            (type === UserType.ParcelCourier ||
              !target.courierProfile ||
              target.courierProfile.isDeleted);
          if (alreadyConsistent) {
            return new UserDto(
              await tx.user.findUniqueOrThrow({
                where: { id },
                include: {
                  phoneNumber: true,
                  driverProfile: true,
                  courierProfile: true,
                },
              }),
            );
          }
          if (type === UserType.InternationalDriver) {
            await tx.driverProfile.upsert({
              where: { userId: id },
              create: { userId: id },
              update: { isDeleted: false },
            });
          } else if (target.driverProfile) {
            await tx.driverProfile.update({
              where: { userId: id },
              data: { isDeleted: true },
            });
          }
          if (type === UserType.ParcelCourier) {
            await tx.courierProfile.upsert({
              where: { userId: id },
              create: { userId: id },
              update: { isDeleted: false },
            });
          } else if (target.courierProfile) {
            await tx.courierProfile.update({
              where: { userId: id },
              data: { isDeleted: true },
            });
          }
          const updated = await tx.user.update({
            where: { id },
            data: {
              type,
              staffApprovalStatus: StaffApprovalStatus.Approved,
              ...(pending ? { staffApprovedAt: new Date() } : {}),
            },
            include: {
              phoneNumber: true,
              driverProfile: true,
              courierProfile: true,
            },
          });
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              businessId: actor.businessId,
              action: AuditAction.UPDATE,
              entityType: 'User',
              entityId: String(id),
              description: pending
                ? 'Approved staff account'
                : 'Changed staff role or repaired profile',
              metadata: {
                previousType: target.type,
                type,
                previousStatus: target.staffApprovalStatus,
                staffApprovalStatus: updated.staffApprovalStatus,
              },
            },
          });
          return new UserDto(updated);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Account or assignments changed. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  async remove(id: number, actor: UserRequestType): Promise<void> {
    await this.findOne(id, undefined, actor);
    await this.prismaService.user.delete({
      where: {
        id,
      },
    });
  }
}
