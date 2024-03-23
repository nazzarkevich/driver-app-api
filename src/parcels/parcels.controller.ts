import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { ParcelsService } from './parcels.service';
import { CreateParcelDto } from './dtos/create-parcel.dto';
import { UpdateParcelDto } from './dtos/update-parcel.dto';
import { AdminGuard } from 'src/guards/admin.guard';

@ApiTags('Parcel')
@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post()
  async createParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateParcelDto,
  ) {
    return this.parcelsService.createParcel(currentUser, body);
  }

  @Get()
  async findParcels() {
    try {
      const parcels = await this.parcelsService.findParcels();

      return parcels;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Get('/:id')
  async findParcel(@Param('id', ParseIntPipe) id: number) {
    try {
      const parcel = await this.parcelsService.findParcel(id);

      return parcel;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Put('/:id')
  updateParcel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateParcelDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.parcelsService.updateParcel(id, body);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeParcel(@Param('id', ParseIntPipe) id: number) {
    // TODO: remove address first
    return this.parcelsService.removeParcel(id);
  }
}
