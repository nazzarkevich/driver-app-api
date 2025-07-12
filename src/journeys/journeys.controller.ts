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
import { ApiTags, ApiQuery } from '@nestjs/swagger';

import { JourneyDto } from './dtos/journey.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { JourneysService } from './journeys.service';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { CreateJourneyDto } from './dtos/create-journey.dto';
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
  async findAllJourneys(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page') page?: string,
    @Query('isCompleted') isCompleted?: string,
  ): Promise<Pagination<JourneyDto> | JourneyDto[]> {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const completedStatus =
      isCompleted !== undefined ? isCompleted === 'true' : undefined;
    return this.journeysService.findAll(
      currentUser.businessId,
      pageNumber,
      completedStatus,
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
}
