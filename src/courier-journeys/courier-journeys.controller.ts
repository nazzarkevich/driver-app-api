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

import { Pagination } from 'src/dtos/pagination.dto';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { CourierJourneyDto } from './dtos/courier-journey.dto';
import { CourierJourneysService } from './courier-journeys.service';
import { CreateCourierJourneyDto } from './dtos/create-courier-journey.dto';
import { UpdateCourierJourneyDto } from './dtos/update-courier-journey.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';

@ApiTags('Courier Journey')
@Controller('courier-journeys')
export class CourierJourneysController {
  constructor(
    private readonly courierJourneysService: CourierJourneysService,
  ) {}

  @Post()
  async createCourierJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateCourierJourneyDto,
  ): Promise<void> {
    return this.courierJourneysService.createCourierJourney(
      body,
      currentUser.businessId,
    );
  }

  @Get('/:id')
  async findCourierJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CourierJourneyDto> {
    return this.courierJourneysService.findOne(id, currentUser.businessId);
  }

  @Get()
  async findAllCourierJourneys(@CurrentUser() currentUser: UserRequestType) {
    return this.courierJourneysService.findAll(currentUser.businessId);
  }

  @Put('/:id')
  updateCourierJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourierJourneyDto,
  ): Promise<CourierJourneyDto> {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.courierJourneysService.update(id, body, currentUser.businessId);
  }

  @Get('/:courierJourneyId/parcels')
  async findJourneyParcels(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Param('courierJourneyId', ParseIntPipe) courierJourneyId: number,
  ): Promise<Pagination<ParcelDto>> {
    return this.courierJourneysService.findParcelsByCourierJourneyId(
      page,
      courierJourneyId,
    );
  }
}
