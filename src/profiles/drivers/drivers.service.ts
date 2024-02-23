import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDriverProfileDto } from './dtos/create-driver-profile.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProfile({ userId }: CreateDriverProfileDto) {
    await this.prismaService.driverProfile.create({
      data: {
        userId,
      },
    });
  }
}
