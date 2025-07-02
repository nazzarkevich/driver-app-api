import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { BusinessDto } from './dtos/business.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBusinessDto } from './dtos/create-business.dto';
import { UpdateBusinessDto } from './dtos/update-business.dto';
import { CreateBusinessWithAdminDto } from './dtos/create-business-with-admin.dto';
import { UserType } from '@prisma/client';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async createBusiness({
    name,
    description,
  }: CreateBusinessDto): Promise<void> {
    await this.prismaService.business.create({
      data: {
        name,
        description,
        activationDate: new Date(),
        isActive: true,
      },
    });
  }

  async createBusinessWithAdmin(
    dto: CreateBusinessWithAdminDto,
  ): Promise<BusinessDto> {
    return this.prismaService.$transaction(async (tx) => {
      // Check if admin email already exists
      const existingUser = await tx.user.findUnique({
        where: { email: dto.adminEmail },
      });

      if (existingUser) {
        throw new BadRequestException('Admin email already exists');
      }

      // Create business
      const business = await tx.business.create({
        data: {
          name: dto.businessName,
          description: dto.description,
          isActive: true,
          activationDate: new Date(),
        },
      });

      // Create admin user in Supabase
      const { data: authData, error: authError } =
        await this.supabaseService.client.auth.admin.createUser({
          email: dto.adminEmail,
          password: dto.adminPassword,
          user_metadata: {
            firstName: dto.adminFirstName,
            lastName: dto.adminLastName,
          },
        });

      if (authError || !authData.user) {
        throw new BadRequestException(
          authError?.message || 'Failed to create admin user',
        );
      }

      // Create admin user in our database
      await tx.user.create({
        data: {
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          email: dto.adminEmail,
          type: UserType.Manager,
          isAdmin: true,
          businessId: business.id,
          supabaseId: authData.user.id,
          phoneId:
            dto.adminPhoneNumber && dto.adminCountryCode
              ? (
                  await tx.phone.create({
                    data: {
                      number: dto.adminPhoneNumber,
                      countryCode: dto.adminCountryCode,
                    },
                  })
                ).id
              : undefined,
        },
      });

      // Set up default data for the business
      await this.setupDefaultBusinessData(tx, business.id);

      return new BusinessDto(business);
    });
  }

  private async setupDefaultBusinessData(tx: any, businessId: number) {
    // Create default countries for the business if needed
    // For now, we'll skip this as countries might be global
    // You could add business-specific settings here
    console.log(`Setting up default data for business ${businessId}`);
  }

  async findAll(): Promise<BusinessDto[]> {
    const allBusinesses = await this.prismaService.business.findMany({});

    return allBusinesses.map((business) => new BusinessDto(business));
  }

  async findActiveBusinesses(): Promise<BusinessDto[]> {
    const activeBusinesses = await this.prismaService.business.findMany({
      where: { isActive: true },
    });

    return activeBusinesses.map((business) => new BusinessDto(business));
  }

  async findOne(id: number): Promise<BusinessDto> {
    const business = await this.prismaService.business.findUnique({
      where: {
        id,
      },
    });

    if (!business) {
      throw new NotFoundException();
    }

    return new BusinessDto(business);
  }

  async update(
    id: number,
    attrs: Partial<UpdateBusinessDto>,
  ): Promise<BusinessDto> {
    const business = await this.findOne(id);

    if (!business) {
      throw new Error('Business not found');
    }

    Object.assign(business, attrs);

    const updatedBusiness = await this.prismaService.business.update({
      where: {
        id,
      },
      data: attrs,
    });

    return new BusinessDto(updatedBusiness);
  }

  async activateBusiness(id: number): Promise<BusinessDto> {
    return this.update(id, { isActive: true, activationDate: new Date() });
  }

  async deactivateBusiness(id: number): Promise<BusinessDto> {
    return this.update(id, { isActive: false });
  }

  async remove(id: number): Promise<void> {
    await this.prismaService.business.delete({
      where: {
        id,
      },
    });
  }

  async getCurrentBusiness(businessId: number): Promise<BusinessDto> {
    return this.findOne(businessId);
  }

  async getDefaultBusiness(): Promise<BusinessDto> {
    const defaultBusinessId = process.env.DEFAULT_BUSINESS_ID
      ? parseInt(process.env.DEFAULT_BUSINESS_ID)
      : 1; // Default to UALogistics (ID: 1)

    const business = await this.prismaService.business.findUnique({
      where: {
        id: defaultBusinessId,
        isActive: true,
      },
    });

    if (!business) {
      throw new NotFoundException(
        `Default business with ID ${defaultBusinessId} not found or inactive`,
      );
    }

    return new BusinessDto(business);
  }

  async getDefaultBusinessId(): Promise<number> {
    const defaultBusiness = await this.getDefaultBusiness();
    return defaultBusiness.id;
  }
}
