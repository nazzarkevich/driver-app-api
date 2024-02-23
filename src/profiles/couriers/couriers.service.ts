import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourierProfileDto } from './dtos/create-courier-profile.dto';

@Injectable()
export class CouriersService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProfile({ userId }: CreateCourierProfileDto) {
    await this.prismaService.courierProfile.create({
      data: {
        userId,
      },
    });
  }
}
