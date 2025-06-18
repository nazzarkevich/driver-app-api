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
import {
  ConnectedParcelsService,
  ConnectionType,
} from './connected-parcels.service';

@ApiTags('Parcel')
@Controller('parcels')
export class ParcelsController {
  constructor(
    private readonly parcelsService: ParcelsService,
    private readonly connectedParcelsService: ConnectedParcelsService,
  ) {}

  @Post()
  async createParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateParcelDto,
  ) {
    return this.parcelsService.createParcel(currentUser, body);
  }

  @Get()
  async findParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    const parcels = await this.parcelsService.findParcels(
      page,
      currentUser.businessId,
    );

    return parcels;
  }

  @Get('/:id')
  async findParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const parcel = await this.parcelsService.findParcel(
      id,
      currentUser.businessId,
    );

    return parcel;
  }

  @Put('/:id')
  updateParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateParcelDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.parcelsService.updateParcel(id, body, currentUser.businessId);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // TODO: remove address first
    return this.parcelsService.removeParcel(id, currentUser.businessId);
  }

  // ========== PARCEL CONNECTIONS ENDPOINTS ==========

  @Get('/:id/connections')
  async getParcelConnections(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.connectedParcelsService.getConnectedParcels(id);
  }

  @Post('/:id/connect/:targetId')
  async connectParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Param('targetId', ParseIntPipe) targetId: number,
    @Body() body: { connectionType: ConnectionType },
  ) {
    return this.connectedParcelsService.connectParcels(
      id,
      targetId,
      body.connectionType,
    );
  }

  @Delete('/:id/disconnect/:targetId')
  async disconnectParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.connectedParcelsService.disconnectParcels(id, targetId);
  }

  @Get('/groups/list')
  async getParcelGroups(@CurrentUser() currentUser: UserRequestType) {
    return this.connectedParcelsService.getParcelGroups(currentUser.businessId);
  }
}
