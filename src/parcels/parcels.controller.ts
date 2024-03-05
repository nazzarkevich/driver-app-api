import { Controller, Post } from '@nestjs/common';

import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { ParcelsService } from './parcels.service';
// import { CreateParcelDto } from './dtos/create-parcel.dto';

@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post()
  async createBusiness(
    @CurrentUser() currentUser: UserRequestType,
    // @Body() body: CreateParcelDto,
  ) {
    return this.parcelsService.create(currentUser);
    // return this.parcelsService.create(currentUser, body);
  }
}
