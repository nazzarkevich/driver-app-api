import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { ParcelsService } from './parcels.service';
import { AdminGuard } from 'src/guards/admin.guard';
import { CreateParcelDto } from './dtos/create-parcel.dto';
import { UpdateParcelDto } from './dtos/update-parcel.dto';

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
  async findParcels(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    const parcels = await this.parcelsService.findParcels(page);

    return parcels;
  }

  @Get('/:id')
  async findParcel(@Param('id', ParseIntPipe) id: number) {
    const parcel = await this.parcelsService.findParcel(id);

    return parcel;
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
