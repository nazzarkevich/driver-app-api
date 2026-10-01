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
import { ApiTags, ApiQuery, ApiOperation, ApiBody } from '@nestjs/swagger';

import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { ParcelsService } from './parcels.service';
import { TariffsService } from 'src/tariffs/tariffs.service';

import { CreateParcelDto } from './dtos/create-parcel.dto';
import { CreateParcelNoteDto } from './dtos/create-parcel-note.dto';
import { UpdateParcelDto } from './dtos/update-parcel.dto';
import { ParcelDto } from './dtos/parcel.dto';
import { UpdateParcelJourneyDto } from './dtos/update-parcel-journey.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';
import { SuperAdminQueryDto } from 'src/dtos/super-admin-query.dto';
import { CreateBulkParcelsDto } from './dtos/create-bulk-parcels.dto';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import {
  ParcelPriceOptionsDto,
  ParcelPriceOptionsResponseDto,
} from './dtos/parcel-price-options.dto';

@ApiTags('Parcel')
@Controller('parcels')
export class ParcelsController {
  constructor(
    private readonly parcelsService: ParcelsService,
    private readonly tariffsService: TariffsService,
  ) {}

  @Post()
  @Permissions(Permission.PARCEL_CREATE)
  async createParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateParcelDto,
  ) {
    return this.parcelsService.createParcel(currentUser, body);
  }

  @Post('bulk')
  @Permissions(Permission.PARCEL_CREATE)
  async createBulkParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateBulkParcelsDto,
  ): Promise<ParcelDto[]> {
    return this.parcelsService.createBulk(currentUser, body);
  }

  @Post('price-options')
  @Permissions(Permission.PARCEL_CREATE)
  @ApiOperation({
    summary: 'Resolve eligible tariff price options for a parcel',
  })
  async calculatePrice(
    @CurrentUser() currentUser: UserRequestType,
    @Body() dto: ParcelPriceOptionsDto,
  ): Promise<ParcelPriceOptionsResponseDto> {
    return this.tariffsService.findPriceOptions(currentUser, dto);
  }

  @Get()
  @Permissions(Permission.PARCEL_READ)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'SuperAdmin only: specify business to query',
  })
  @ApiQuery({
    name: 'deliveryStatus',
    required: false,
    type: String,
    description:
      'Filter by delivery status: Initial, InProgress, Delivered, Cancelled, Returned, Lost',
  })
  @ApiQuery({
    name: 'trackingNumber',
    required: false,
    type: String,
    description: 'Search by tracking number',
  })
  @ApiQuery({ name: 'senderId', required: false, type: Number })
  @ApiQuery({ name: 'recipientId', required: false, type: Number })
  @ApiQuery({ name: 'journeyId', required: false, type: Number })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter parcels from this date (ISO format: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter parcels until this date (ISO format: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'originCountryId',
    required: false,
    type: Number,
    description:
      'Filter parcels by origin country ID (1: Ukraine, 2: United Kingdom)',
  })
  @ApiQuery({
    name: 'destinationCountryId',
    required: false,
    type: Number,
    description:
      'Filter parcels by destination country ID (1: Ukraine, 2: United Kingdom)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search parcels by tracking number, address (street, city, postcode), recipient name, or sender name',
  })
  @ApiQuery({
    name: 'cargoType',
    required: false,
    type: String,
    description:
      'Filter parcels by cargo type (comma-separated): Unknown, Regular, Passport, Document, Money',
  })
  @ApiQuery({
    name: 'paymentStatus',
    required: false,
    type: String,
    description:
      'Filter parcels by payment status (comma-separated): NotPaid, PartiallyPaid, Paid',
  })
  @ApiQuery({
    name: 'courierId',
    required: false,
    type: Number,
    description:
      'Filter parcels by courier (pickedUpByCourierId or deliveredByCourierId)',
  })
  @ApiQuery({
    name: 'driverId',
    required: false,
    type: Number,
    description:
      'Filter parcels by driver (pickedUpByDriverId or deliveredByDriverId)',
  })
  async findAllParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page') page?: string,
    @Query() query?: SuperAdminQueryDto,
    @Query('deliveryStatus') deliveryStatus?: string,
    @Query('trackingNumber') trackingNumber?: string,
    @Query('senderId') senderId?: string,
    @Query('recipientId') recipientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('originCountryId') originCountryId?: string,
    @Query('destinationCountryId') destinationCountryId?: string,
    @Query('search') search?: string,
    @Query('cargoType') cargoType?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('courierId') courierId?: string,
    @Query('driverId') driverId?: string,
    @Query('journeyId') journeyId?: string,
  ): Promise<Pagination<ParcelDto> | ParcelDto[]> {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const senderIdNumber = senderId ? parseInt(senderId, 10) : undefined;
    const recipientIdNumber = recipientId
      ? parseInt(recipientId, 10)
      : undefined;

    const startDateParsed = startDate ? new Date(startDate) : undefined;
    const endDateParsed = endDate ? new Date(endDate) : undefined;
    const originCountryIdNumber = originCountryId
      ? parseInt(originCountryId, 10)
      : undefined;
    const destinationCountryIdNumber = destinationCountryId
      ? parseInt(destinationCountryId, 10)
      : undefined;
    const courierIdNumber = courierId ? parseInt(courierId, 10) : undefined;
    const driverIdNumber = driverId ? parseInt(driverId, 10) : undefined;
    const journeyIdNumber = journeyId ? parseInt(journeyId, 10) : undefined;

    // SuperAdmin can specify different businessId, regular users use their own
    const targetBusinessId =
      currentUser.isSuperAdmin && query?.businessId
        ? query.businessId
        : currentUser.businessId;

    return this.parcelsService.findAll(
      targetBusinessId,
      currentUser,
      pageNumber,
      deliveryStatus,
      trackingNumber,
      senderIdNumber,
      recipientIdNumber,
      startDateParsed,
      endDateParsed,
      originCountryIdNumber,
      destinationCountryIdNumber,
      search,
      cargoType,
      paymentStatus,
      courierIdNumber,
      driverIdNumber,
      journeyIdNumber,
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
  @Permissions(Permission.PARCEL_READ)
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
  @Permissions(Permission.PARCEL_UPDATE)
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

  @Put('/:id/journey')
  @Permissions(Permission.PARCEL_UPDATE)
  @ApiOperation({ summary: 'Assign, move, or remove parcel journey' })
  updateParcelJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateParcelJourneyDto,
  ): Promise<ParcelDto[]> {
    return this.parcelsService.updateJourneyAssignment(id, body, currentUser);
  }

  @Delete('/:id')
  @Permissions(Permission.PARCEL_DELETE)
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

  @Get('/:id/group')
  @Permissions(Permission.PARCEL_READ)
  @ApiOperation({ summary: 'Get all parcels in the same group' })
  @ApiQuery({
    name: 'businessId',
    required: false,
    type: Number,
    description: 'SuperAdmin only: specify business context',
  })
  async getParcelGroup(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query() query?: SuperAdminQueryDto,
  ): Promise<ParcelDto[]> {
    const targetBusinessId =
      currentUser.isSuperAdmin && query?.businessId
        ? query.businessId
        : currentUser.businessId;

    return this.parcelsService.findGroup(id, targetBusinessId, currentUser);
  }

  @Post('/:id/notes')
  @Permissions(Permission.PARCEL_NOTE_CREATE)
  @ApiOperation({ summary: 'Add a note to parcel' })
  @ApiBody({ type: CreateParcelNoteDto })
  addNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
    @Body() body: CreateParcelNoteDto,
  ) {
    return this.parcelsService.addNote(
      parcelId,
      body.content,
      currentUser.id,
      currentUser.businessId,
    );
  }

  @Get('/:id/notes')
  @Permissions(Permission.PARCEL_NOTE_READ)
  @ApiOperation({ summary: 'Get all notes for a parcel' })
  getNotes(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
  ) {
    return this.parcelsService.getNotes(parcelId, currentUser.businessId);
  }

  @Delete('/:id/notes/:noteId')
  @Permissions(Permission.PARCEL_NOTE_DELETE)
  @ApiOperation({ summary: 'Delete a note from parcel' })
  deleteNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.parcelsService.deleteNote(
      noteId,
      currentUser.id,
      currentUser.businessId,
    );
  }

  @Put('/:id/mark-delivered')
  @Permissions(Permission.PARCEL_MARK_DELIVERED)
  @ApiOperation({ summary: 'Mark parcel as delivered' })
  markAsDelivered(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
  ) {
    return this.parcelsService.markAsDelivered(
      parcelId,
      currentUser.businessId,
      currentUser.id,
    );
  }

  @Put('/:id/mark-picked-up')
  @Permissions(Permission.PARCEL_MARK_PICKED_UP)
  @ApiOperation({ summary: 'Mark a parcel or its whole group as picked up' })
  markAsPickedUp(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
  ): Promise<ParcelDto[]> {
    return this.parcelsService.markAsPickedUp(
      parcelId,
      currentUser.businessId,
      currentUser.id,
    );
  }
}
