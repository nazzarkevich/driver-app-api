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

import { CourierJourneysService } from './courier-journeys.service';
import { CreateCourierJourneyDto } from './dtos/create-courier-journey.dto';
import { UpdateCourierJourneyDto } from './dtos/update-courier-journey.dto';

@Controller('courier-journeys')
export class CourierJourneysController {
  constructor(
    private readonly courierJourneysService: CourierJourneysService,
  ) {}

  @Post()
  async createCourierJourney(@Body() body: CreateCourierJourneyDto) {
    return this.courierJourneysService.createCourierJourney(body);
  }

  @Get('/:id')
  async getJourney(@Param('id', ParseIntPipe) id: number) {
    return this.courierJourneysService.findOne(id);
  }

  @Get()
  async findAllJourneys(@Query('isCompleted') isCompleted?: boolean) {
    if (isCompleted) {
      return this.courierJourneysService.findCompletedCourierJourneys();
    }

    return this.courierJourneysService.findAll();
  }

  @Put('/:id')
  updateJourney(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourierJourneyDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.courierJourneysService.updateCourierJourney(id, body);
  }

  @Get('/:courierJourneyId/parcels')
  async findJourneyParcels(
    @Param('courierJourneyId', ParseIntPipe) courierJourneyId: number,
  ) {
    // TODO: Question: how to handle pagination
    return this.courierJourneysService.findParcelsByCourierJourneyId(
      courierJourneyId,
    );
  }
}
