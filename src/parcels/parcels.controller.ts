import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { MarkParcelPaidDto } from './dtos/mark-parcel-paid.dto';
import { CollectParcelPaymentDto } from './dtos/collect-parcel-payment.dto';
import { ReverseParcelPaymentDto } from './dtos/reverse-parcel-payment.dto';
import { ReconcileParcelPaymentDto } from './dtos/reconcile-parcel-payment.dto';
import { CashCollectionType } from './dtos/cash-collection.dto';
import { ParcelPaymentsService } from './parcel-payments.service';
import { AuditService } from 'src/audit/audit.service';
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
import {
  CorrectParcelStatusDto,
  ReportParcelDamageDto,
  ReverseParcelStatusDto,
  ResolveParcelDamageDto,
  TransitionParcelStatusDto,
} from './dtos/transition-parcel-status.dto';

@ApiTags('Parcel')
@Controller('parcels')
export class ParcelsController {
  constructor(
    private readonly parcelsService: ParcelsService,
    private readonly tariffsService: TariffsService,
    private readonly parcelPaymentsService: ParcelPaymentsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions(Permission.PARCEL_CREATE)
  async createParcel(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateParcelDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.parcelsService.createParcel(currentUser, body, idempotencyKey);
  }

  @Post('bulk')
  @Permissions(Permission.PARCEL_CREATE)
  async createBulkParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateBulkParcelsDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ParcelDto[]> {
    return this.parcelsService.createBulk(currentUser, body, idempotencyKey);
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

  @Get('/:id/payments')
  @Permissions(Permission.PARCEL_READ)
  async getParcelPayments(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
  ) {
    const parcel = await this.parcelsService.findOne(
      id,
      currentUser.businessId,
      currentUser,
    );
    return this.parcelPaymentsService.history(
      id,
      parcel.businessId,
      page ? parseInt(page, 10) : 1,
    );
  }

  @Get('/:id/history')
  @Permissions(Permission.PARCEL_READ)
  async getParcelHistory(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parcel = await this.parcelsService.findOne(
      id,
      currentUser.businessId,
      currentUser,
    );
    return this.auditService.getParcelHistory(
      id,
      parcel.businessId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('/:id/payments')
  @Permissions(Permission.PARCEL_MARK_PAID)
  async collectParcelPayment(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CollectParcelPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ParcelDto> {
    await this.parcelPaymentsService.collect(
      id,
      body,
      currentUser,
      idempotencyKey,
    );
    return this.parcelsService.findOne(id, currentUser.businessId, currentUser);
  }

  @Post('/:id/payments/:entryId/reverse')
  @Permissions(Permission.PARCEL_PAYMENT_CORRECT)
  async reverseParcelPayment(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() body: ReverseParcelPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ParcelDto> {
    await this.parcelPaymentsService.reverse(
      id,
      entryId,
      body,
      currentUser,
      idempotencyKey,
    );
    return this.parcelsService.findOne(id, currentUser.businessId, currentUser);
  }

  @Post('/:id/payments/reconcile')
  @Permissions(Permission.PARCEL_PAYMENT_RECONCILE)
  async reconcileParcelPayment(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReconcileParcelPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ParcelDto> {
    await this.parcelPaymentsService.reconcile(
      id,
      body,
      currentUser,
      idempotencyKey,
    );
    return this.parcelsService.findOne(id, currentUser.businessId, currentUser);
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
  @Permissions(Permission.PARCEL_STATUS_UPDATE)
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
  @Permissions(Permission.PARCEL_STATUS_CORRECT)
  @ApiOperation({ summary: 'Assign, move, or remove parcel journey' })
  updateParcelJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateParcelJourneyDto,
  ): Promise<ParcelDto[]> {
    return this.parcelsService.updateJourneyAssignment(id, body, currentUser);
  }

  @Put('/:id/mark-paid')
  @Permissions(Permission.PARCEL_MARK_PAID)
  @ApiOperation({ summary: 'Confirm full payment for this parcel only' })
  markParcelAsPaid(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MarkParcelPaidDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ParcelDto> {
    return this.parcelsService
      .findOne(id, currentUser.businessId, currentUser)
      .then(async (parcel) => {
        await this.parcelPaymentsService.collect(
          id,
          {
            expectedUpdatedAt: body.expectedUpdatedAt,
            collection: {
              type: CashCollectionType.Full,
              payerParty: parcel.paidBy,
            },
          },
          currentUser,
          idempotencyKey,
          true,
        );
        return this.parcelsService.findOne(
          id,
          currentUser.businessId,
          currentUser,
        );
      });
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

  @Post('/:id/status-transitions')
  @Permissions(Permission.PARCEL_STATUS_UPDATE)
  transitionStatus(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
    @Body() body: TransitionParcelStatusDto,
  ): Promise<ParcelDto> {
    return this.parcelsService.transitionStatus(parcelId, body, currentUser);
  }

  @Post('/:id/status-transitions/reverse')
  @Permissions(Permission.PARCEL_STATUS_CORRECT)
  reverseStatus(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
    @Body() body: ReverseParcelStatusDto,
  ): Promise<ParcelDto> {
    return this.parcelsService.reverseStatusTransition(
      parcelId,
      body,
      currentUser,
    );
  }

  @Post('/:id/status-transitions/correct')
  @Permissions(Permission.PARCEL_STATUS_UPDATE)
  correctStatus(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
    @Body() body: CorrectParcelStatusDto,
  ): Promise<ParcelDto> {
    return this.parcelsService.correctStatus(parcelId, body, currentUser);
  }

  @Post('/:id/damage-reports')
  @Permissions(Permission.PARCEL_STATUS_UPDATE)
  reportDamage(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
    @Body() body: ReportParcelDamageDto,
  ): Promise<ParcelDto> {
    return this.parcelsService.reportDamage(parcelId, body, currentUser);
  }

  @Post('/:id/damage-reports/resolve')
  @Permissions(Permission.PARCEL_STATUS_UPDATE)
  resolveDamage(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) parcelId: number,
    @Body() body: ResolveParcelDamageDto,
  ): Promise<ParcelDto> {
    return this.parcelsService.resolveDamage(parcelId, body, currentUser);
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
