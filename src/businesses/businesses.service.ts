import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBusinessDto } from './dtos/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prismaService: PrismaService) {}

  async createBusiness({ name, description }: CreateBusinessDto) {
    await this.prismaService.business.create({
      data: {
        name,
        description,
        activationDate: new Date(),
      },
    });
  }
}
