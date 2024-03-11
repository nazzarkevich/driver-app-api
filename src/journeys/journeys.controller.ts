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

import { JourneysService } from './journeys.service';
import { CreateJourneyDto } from './dtos/create-journey.dto';
import { UpdateJourneyDto } from './dtos/update-journey.dto';

@Controller('journeys')
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post()
  async createJourney(@Body() body: CreateJourneyDto) {
    return this.journeysService.createJourney(body);
  }

  @Get('/:id')
  async getJourney(@Param('id', ParseIntPipe) id: number) {
    return this.journeysService.findOne(id);
  }

  @Get()
  async findAllJourneys(@Query('isCompleted') isCompleted?: boolean) {
    if (isCompleted) {
      return this.journeysService.findCompletedJourneys();
    }

    return this.journeysService.findAll();
  }

  @Put('/:id')
  updateJourney(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateJourneyDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.journeysService.updateJourney(id, body);
  }

  @Get('/:journeyId/parcels')
  async findJourneyParcels(
    @Param('journeyId', ParseIntPipe) journeyId: number,
  ) {
    // TODO: Question: how to handle pagination
    return this.journeysService.findParcelsByJourneyId(journeyId);
  }
}
