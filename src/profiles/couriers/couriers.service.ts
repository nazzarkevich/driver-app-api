import { StaffAccountUpdater } from '../staff-account-updater';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, UserType } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { AuthProfilesService } from 'src/users/auth-profiles/auth-profiles.service';
import { AuditService } from 'src/audit/audit.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { CreateCourierProfileDto } from './dtos/create-courier-profile.dto';
import { CreateCourierWithUserDto } from './dtos/create-courier-with-user.dto';
import { UpdateCourierProfileDto } from './dtos/update-courier-profile.dto';
import { CourierProfileDto } from './dtos/courier-profile.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';

@Injectable()
export class CouriersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly authProfilesService: AuthProfilesService,
    private readonly auditService: AuditService,
    private readonly staffAccountUpdater: StaffAccountUpdater,
  ) {}

  async createProfile(
    { userId }: CreateCourierProfileDto,
    businessId: number,
  ): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
        businessId,
        isDeleted: false,
        type: UserType.ParcelCourier,
        staffApprovalStatus: 'Approved',
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

  async createProfileWithUser(
    dto: CreateCourierWithUserDto,
    businessId: number,
  ): Promise<CourierProfileDto> {
    const existingUser = await this.prismaService.user.findFirst({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const { data: authData, error: authError } =
      await this.supabaseService.client.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

    if (authError || !authData.user) {
      throw new BadRequestException(
        authError?.message || 'Failed to create auth user',
      );
    }

    const supabaseUserId = authData.user.id;

    let result;
    try {
      result = await this.prismaService.$transaction(async (tx) => {
        const contact = {
          number: dto.phoneNumber,
          countryCode: dto.phoneCountryCode,
        };
        const phone = await tx.phone.upsert({
          where: { countryCode_number: contact },
          create: contact,
          update: {},
        });

        const user = await tx.user.create({
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            type: UserType.ParcelCourier,
            businessId,
            phoneId: phone.id,
            imageId: dto.imageId,
          },
        });

        await tx.authProfile.create({
          data: {
            userId: user.id,
            provider: 'Supabase' as any,
            providerId: supabaseUserId,
            email: dto.email,
            lastSignIn: new Date(),
          },
        });

        const courierProfile = await tx.courierProfile.create({
          data: {
            userId: user.id,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isBlocked: true,
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
              },
            },
          },
        });

        return courierProfile;
      });
    } catch (error) {
      await this.supabaseService.client.auth.admin
        .deleteUser(supabaseUserId)
        .catch(() => {});
      throw error;
    }

    return new CourierProfileDto(result);
  }

  async findAllCouriersProfiles(
    page: number,
    businessId: number,
  ): Promise<Pagination<CourierProfileDto>> {
    const [courierProfilesWithPagination, metadata] =
      await prismaWithPagination.courierProfile
        .paginate({
          where: {
            isDeleted: false,
            user: {
              businessId,
              isDeleted: false,
              isBlocked: false,
              type: UserType.ParcelCourier,
              staffApprovalStatus: 'Approved',
            },
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isBlocked: true,
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

  async findCourierProfile(
    id: number,
    businessId: number,
  ): Promise<CourierProfileDto> {
    const profile = await this.prismaService.courierProfile.findFirst({
      where: {
        id,
        isDeleted: false,
        user: {
          businessId,
          isDeleted: false,
          type: UserType.ParcelCourier,
          staffApprovalStatus: 'Approved',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isBlocked: true,
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
    businessId: number,
  ): Promise<CourierProfileDto[]> {
    if (couriersProfileIds?.length === 0) {
      return [];
    }

    const couriersProfiles = await this.prismaService.courierProfile.findMany({
      where: {
        isDeleted: false,
        user: {
          businessId,
          isDeleted: false,
          isBlocked: false,
          type: UserType.ParcelCourier,
          staffApprovalStatus: 'Approved',
        },
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
          },
        },
      },
    });

    return couriersProfiles.map((profile) => new CourierProfileDto(profile));
  }

  async update(
    id: number,
    dto: UpdateCourierProfileDto,
    businessId: number,
  ): Promise<CourierProfileDto> {
    const profile = await this.findCourierProfile(id, businessId);
    await this.staffAccountUpdater.update(profile.user.id, businessId, dto);
    return this.findCourierProfile(id, businessId);
  }

  async toggleBlock(
    id: number,
    currentUser: UserRequestType,
  ): Promise<CourierProfileDto> {
    await this.findCourierProfile(id, currentUser.businessId);
    const profile = await this.prismaService.courierProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            isBlocked: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Courier profile not found');
    }

    const newIsBlocked = !profile.user.isBlocked;

    await this.prismaService.user.update({
      where: { id: profile.user.id },
      data: { isBlocked: newIsBlocked },
    });

    const action = newIsBlocked ? AuditAction.BLOCK : AuditAction.UNBLOCK;
    await this.auditService.logUserAction(
      currentUser,
      action,
      'CourierProfile',
      String(id),
      `${action} courier ${profile.user.firstName} ${profile.user.lastName}`,
    );

    return this.findCourierProfile(id, currentUser.businessId);
  }

  async removeCourierProfile(id: number, businessId: number): Promise<void> {
    await this.findCourierProfile(id, businessId);
    await this.prismaService.courierProfile.update({
      where: {
        id,
      },
      data: { isDeleted: true },
    });
  }
}
