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
import { Pagination } from 'src/dtos/pagination.dto';
import prismaWithPagination from 'src/prisma/prisma-client';
import { DriverProfileDto } from './dtos/driver-profile.dto';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';
import { CreateDriverWithUserDto } from './dtos/create-driver-with-user.dto';
import { UpdateDriverProfileDto } from './dtos/update-driver-profile.dto';

const USER_SELECT = {
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
};

@Injectable()
export class DriversService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly authProfilesService: AuthProfilesService,
    private readonly auditService: AuditService,
    private readonly staffAccountUpdater: StaffAccountUpdater,
  ) {}

  async createProfile(
    { userId }: CreateDriverProfileDto,
    businessId: number,
  ): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
        businessId,
        isDeleted: false,
        type: UserType.InternationalDriver,
        staffApprovalStatus: 'Approved',
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

  async createProfileWithUser(
    dto: CreateDriverWithUserDto,
    businessId: number,
  ): Promise<DriverProfileDto> {
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
            type: UserType.InternationalDriver,
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

        const driverProfile = await tx.driverProfile.create({
          data: {
            userId: user.id,
          },
          include: {
            user: {
              select: USER_SELECT,
            },
          },
        });

        return driverProfile;
      });
    } catch (error) {
      await this.supabaseService.client.auth.admin
        .deleteUser(supabaseUserId)
        .catch(() => {});
      throw error;
    }

    return new DriverProfileDto(result);
  }

  async findAll(
    page: number,
    currentUser: UserRequestType,
  ): Promise<Pagination<DriverProfileDto>> {
    const [driversProfilesWithPagination, metadata] =
      await prismaWithPagination.driverProfile
        .paginate({
          where: {
            isDeleted: false,
            user: {
              businessId: currentUser.businessId,
              isDeleted: false,
              isBlocked: false,
              type: UserType.InternationalDriver,
              staffApprovalStatus: 'Approved',
            },
          },
          include: {
            user: {
              select: USER_SELECT,
            },
          },
          orderBy: {
            createdAt: 'desc',
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

  async findOne(id: number, businessId?: number): Promise<DriverProfileDto> {
    const profile = await this.prismaService.driverProfile.findFirst({
      where: {
        id,
        isDeleted: false,
        user: {
          isDeleted: false,
          type: UserType.InternationalDriver,
          staffApprovalStatus: 'Approved',
          ...(businessId !== undefined ? { businessId } : {}),
        },
      },
      include: {
        user: {
          select: USER_SELECT,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    return new DriverProfileDto(profile);
  }

  async findManyByIds(
    driverProfileIds: number[],
    businessId: number,
  ): Promise<DriverProfileDto[]> {
    if (driverProfileIds?.length === 0) {
      return [];
    }

    const driverProfiles = await this.prismaService.driverProfile.findMany({
      where: {
        isDeleted: false,
        user: {
          businessId,
          isDeleted: false,
          isBlocked: false,
          type: UserType.InternationalDriver,
          staffApprovalStatus: 'Approved',
        },
        id: {
          in: driverProfileIds,
        },
      },
      include: {
        user: {
          select: USER_SELECT,
        },
      },
    });

    if (driverProfiles.length !== driverProfileIds.length) {
      throw new NotFoundException('One or more driver profiles not found');
    }

    return driverProfiles.map((profile) => new DriverProfileDto(profile));
  }

  async update(
    id: number,
    dto: UpdateDriverProfileDto,
    businessId: number,
  ): Promise<DriverProfileDto> {
    const profile = await this.findOne(id, businessId);
    await this.staffAccountUpdater.update(profile.user.id, businessId, dto);
    return this.findOne(id, businessId);
  }

  async toggleBlock(
    id: number,
    currentUser: UserRequestType,
  ): Promise<DriverProfileDto> {
    await this.findOne(id, currentUser.businessId);
    const profile = await this.prismaService.driverProfile.findUnique({
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
      throw new NotFoundException('Driver profile not found');
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
      'DriverProfile',
      String(id),
      `${action} driver ${profile.user.firstName} ${profile.user.lastName}`,
    );

    return this.findOne(id);
  }

  async remove(id: number, businessId: number): Promise<void> {
    await this.findOne(id, businessId);
    await this.prismaService.driverProfile.update({
      where: {
        id,
      },
      data: { isDeleted: true },
    });
  }
}
