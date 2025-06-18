import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';

import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { ParcelsService } from './parcels.service';

import { CreateParcelDto } from './dtos/create-parcel.dto';
import { UpdateParcelDto } from './dtos/update-parcel.dto';
import {
  ConnectedParcelsService,
  ConnectionType,
} from './connected-parcels.service';
import { ParcelDto } from './dtos/parcel.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';
import { SuperAdminQueryDto } from 'src/dtos/super-admin-query.dto';

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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'SuperAdmin only: specify business to query',
  })
  async findAllParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page') page?: string,
    @Query() query?: SuperAdminQueryDto,
  ): Promise<Pagination<ParcelDto> | ParcelDto[]> {
    const pageNumber = page ? parseInt(page, 10) : undefined;

    // SuperAdmin can specify different businessId, regular users use their own
    const targetBusinessId =
      currentUser.isSuperAdmin && query?.businessId
        ? query.businessId
        : currentUser.businessId;

    return this.parcelsService.findAll(
      targetBusinessId,
      currentUser,
      pageNumber,
    );
  }

  @Get('/cross-business')
  @UseGuards(SuperAdminGuard)
  @ApiQuery({
    name: 'businessIds',
    required: true,
    type: String,
    description: 'Comma-separated business IDs (e.g., "1,2,3")',
  })
  async findParcelsAcrossBusinesses(
    @CurrentUser() currentUser: UserRequestType,
    @Query('businessIds') businessIds: string,
  ): Promise<ParcelDto[]> {
    const ids = businessIds.split(',').map((id) => parseInt(id.trim(), 10));
    return this.parcelsService.findAcrossBusinesses(ids, currentUser);
  }

  @Get('/:id')
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'SuperAdmin only: specify business context',
  })
  async findParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query() query?: SuperAdminQueryDto,
  ): Promise<ParcelDto> {
    const targetBusinessId =
      currentUser.isSuperAdmin && query?.businessId
        ? query.businessId
        : currentUser.businessId;

    return this.parcelsService.findOne(id, targetBusinessId, currentUser);
  }

  @Put('/:id')
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'SuperAdmin only: specify business context',
  })
  updateParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateParcelDto,
    @Query() query?: SuperAdminQueryDto,
  ): Promise<ParcelDto> {
    const targetBusinessId =
      currentUser.isSuperAdmin && query?.businessId
        ? query.businessId
        : currentUser.businessId;

    return this.parcelsService.update(id, body, targetBusinessId, currentUser);
  }

  @Delete('/:id')
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'SuperAdmin only: specify business context',
  })
  removeParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query() query?: SuperAdminQueryDto,
  ): Promise<void> {
    const targetBusinessId =
      currentUser.isSuperAdmin && query?.businessId
        ? query.businessId
        : currentUser.businessId;

    return this.parcelsService.remove(id, targetBusinessId, currentUser);
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
