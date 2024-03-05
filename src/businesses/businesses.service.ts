import { Injectable, NotFoundException } from '@nestjs/common';

import { BusinessDto } from './dtos/business.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBusinessDto } from './dtos/create-business.dto';
import { UpdateBusinessDto } from './dtos/update-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prismaService: PrismaService) {}

  async createBusiness({
    name,
    description,
  }: CreateBusinessDto): Promise<void> {
    await this.prismaService.business.create({
      data: {
        name,
        description,
        activationDate: new Date(),
      },
    });
  }

  async findAll(): Promise<BusinessDto[]> {
    const allBusinesses = await this.prismaService.business.findMany({});

    return allBusinesses.map((business) => new BusinessDto(business));
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
}
