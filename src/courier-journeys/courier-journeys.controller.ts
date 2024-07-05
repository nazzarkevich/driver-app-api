import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { Pagination } from 'src/dtos/pagination.dto';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { CourierJourneyDto } from './dtos/courier-journey.dto';
import { CourierJourneysService } from './courier-journeys.service';
import { CreateCourierJourneyDto } from './dtos/create-courier-journey.dto';
import { UpdateCourierJourneyDto } from './dtos/update-courier-journey.dto';

@Controller('courier-journeys')
export class CourierJourneysController {
  constructor(
    private readonly courierJourneysService: CourierJourneysService,
  ) {}

  @Post()
  async createCourierJourney(
    @Body() body: CreateCourierJourneyDto,
  ): Promise<void> {
    return this.courierJourneysService.createCourierJourney(body);
  }

  @Get('/:id')
  async getJourney(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CourierJourneyDto> {
    return this.courierJourneysService.findOne(id);
  }

  @Get()
  async findAllJourneys(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('isCompleted') isCompleted?: boolean,
  ): Promise<Pagination<CourierJourneyDto>> {
    return this.courierJourneysService.findAll(page, isCompleted);
  }

  @Put('/:id')
  updateJourney(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourierJourneyDto,
  ): Promise<CourierJourneyDto> {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.courierJourneysService.updateCourierJourney(id, body);
  }

  @Get('/:courierJourneyId/parcels')
  async findJourneyParcels(
    @Query('page', ParseIntPipe) page: number = 1,
    @Param('courierJourneyId', ParseIntPipe) courierJourneyId: number,
  ): Promise<Pagination<ParcelDto>> {
    return this.courierJourneysService.findParcelsByCourierJourneyId(
      page,
      courierJourneyId,
    );
  }
}
