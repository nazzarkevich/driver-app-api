import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { JourneyDto } from './dtos/journey.dto';
import { Pagination } from 'src/dtos/pagination.dto';
import { JourneysService } from './journeys.service';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { CreateJourneyDto } from './dtos/create-journey.dto';
import { UpdateJourneyDto } from './dtos/update-journey.dto';

@ApiTags('Journey')
@Controller('journeys')
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post()
  async createJourney(@Body() body: CreateJourneyDto): Promise<void> {
    return this.journeysService.createJourney(body);
  }

  @Get('/:id')
  async getJourney(@Param('id', ParseIntPipe) id: number): Promise<JourneyDto> {
    return this.journeysService.findOne(id);
  }

  @Get()
  async findAllJourneys(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('isCompleted') isCompleted?: boolean,
  ): Promise<Pagination<JourneyDto>> {
    return this.journeysService.findAll(page, isCompleted);
  }

  @Put('/:id')
  updateJourney(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateJourneyDto,
  ): Promise<JourneyDto> {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.journeysService.updateJourney(id, body);
  }

  @Get('/:journeyId/parcels')
  async findJourneyParcels(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Param('journeyId', ParseIntPipe) journeyId: number,
  ): Promise<Pagination<ParcelDto>> {
    return this.journeysService.findParcelsByJourneyId(page, journeyId);
  }
}
