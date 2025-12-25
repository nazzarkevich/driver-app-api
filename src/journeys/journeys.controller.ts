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
} from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation, ApiBody } from '@nestjs/swagger';

import { JourneyDto } from './dtos/journey.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { JourneysService } from './journeys.service';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { CreateJourneyDto } from './dtos/create-journey.dto';
import { CreateJourneyNoteDto } from './dtos/create-journey-note.dto';
import { UpdateJourneyDto } from './dtos/update-journey.dto';
import { VehicleDto } from 'src/vehicles/dtos/vehicle.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';

@ApiTags('Journey')
@Controller('journeys')
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post()
  async createJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateJourneyDto,
  ): Promise<JourneyDto> {
    return this.journeysService.createJourney(body, currentUser.businessId);
  }

  @Get('/available-vehicles')
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    description: 'Date in ISO format (YYYY-MM-DD)',
  })
  async getAvailableVehicles(
    @CurrentUser() currentUser: UserRequestType,
    @Query('date') date: string,
  ): Promise<VehicleDto[]> {
    const departureDate = new Date(date);
    return this.journeysService.getAvailableVehicles(
      departureDate,
      currentUser.businessId,
    );
  }

  @Get('/:id')
  async findJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<JourneyDto> {
    return this.journeysService.findOne(id, currentUser.businessId);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'isCompleted', required: false, type: Boolean })
  @ApiQuery({ name: 'driverProfileId', required: false, type: Number })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter journeys from this date (ISO format: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter journeys until this date (ISO format: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'startCountryId',
    required: false,
    type: Number,
    description:
      'Filter journeys by origin country ID (1: Ukraine, 2: United Kingdom)',
  })
  @ApiQuery({
    name: 'endCountryId',
    required: false,
    type: Number,
    description:
      'Filter journeys by destination country ID (1: Ukraine, 2: United Kingdom)',
  })
  async findAllJourneys(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page') page?: string,
    @Query('isCompleted') isCompleted?: string,
    @Query('driverProfileId') driverProfileId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('startCountryId') startCountryId?: string,
    @Query('endCountryId') endCountryId?: string,
  ): Promise<Pagination<JourneyDto> | JourneyDto[]> {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const completedStatus =
      isCompleted !== undefined ? isCompleted === 'true' : undefined;
    const driverProfileIdNumber = driverProfileId
      ? parseInt(driverProfileId, 10)
      : undefined;

    const startDateParsed = startDate ? new Date(startDate) : undefined;
    const endDateParsed = endDate ? new Date(endDate) : undefined;
    const startCountryIdNumber = startCountryId
      ? parseInt(startCountryId, 10)
      : undefined;
    const endCountryIdNumber = endCountryId
      ? parseInt(endCountryId, 10)
      : undefined;

    return this.journeysService.findAll(
      currentUser.businessId,
      pageNumber,
      completedStatus,
      driverProfileIdNumber,
      startDateParsed,
      endDateParsed,
      startCountryIdNumber,
      endCountryIdNumber,
    );
  }

  @Put('/:id')
  updateJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateJourneyDto,
  ): Promise<JourneyDto> {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.journeysService.update(id, body, currentUser.businessId);
  }

  @Delete('/:id')
  async removeJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.journeysService.remove(id, currentUser.businessId);
  }

  @Get('/:journeyId/parcels')
  async findJourneyParcels(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Param('journeyId', ParseIntPipe) journeyId: number,
  ): Promise<Pagination<ParcelDto>> {
    return this.journeysService.findParcelsByJourneyId(
      page,
      journeyId,
      currentUser.businessId,
    );
  }

  @Post('/:id/notes')
  @ApiOperation({ summary: 'Add a note to journey' })
  @ApiBody({ type: CreateJourneyNoteDto })
  addNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) journeyId: number,
    @Body() body: CreateJourneyNoteDto,
  ) {
    return this.journeysService.addNote(
      journeyId,
      body.content,
      currentUser.id,
      currentUser.businessId,
    );
  }

  @Get('/:id/notes')
  @ApiOperation({ summary: 'Get all notes for a journey' })
  getNotes(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) journeyId: number,
  ) {
    return this.journeysService.getNotes(
      journeyId,
      currentUser.businessId,
    );
  }

  @Delete('/:id/notes/:noteId')
  @ApiOperation({ summary: 'Delete a note from journey' })
  deleteNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) journeyId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.journeysService.deleteNote(
      noteId,
      currentUser.id,
      currentUser.businessId,
    );
  }
}
