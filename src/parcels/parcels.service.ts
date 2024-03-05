import { Injectable } from '@nestjs/common';

import { UsersService } from 'src/users/users.service';
import { PrismaService } from 'src/prisma/prisma.service';
// import { CreateParcelDto } from './dtos/create-parcel.dto';
import { BusinessesService } from 'src/businesses/businesses.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';

@Injectable()
export class ParcelsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly businessesService: BusinessesService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    user: UserRequestType,
    // body: CreateParcelDto
  ): Promise<void> {
    // console.log(body);
    const currentUser = await this.usersService.findOne(user.id);
    const currentBusiness = await this.businessesService.getCurrentBusiness(
      currentUser.businessId,
    );
    // const sender = await this.
    console.log('currentBusiness: ', currentBusiness);

    // await this.prismaService.parcel.create({
    //   data: {
    //     ...body,
    //     trackingNumber: this.generateTrackingNumber(),
    //     pickupDate: new Date(),
    //   },
    // });
  }

  private generateTrackingNumber() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    const year = today.getFullYear();
    const currentDate = day + month + year;

    const randomSuffix = Math.floor(Math.random() * 1000000000000)
      .toString()
      .padStart(13, '0');

    return currentDate + randomSuffix;
  }
}
