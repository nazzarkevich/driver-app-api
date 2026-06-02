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
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';

import { Pagination } from 'src/dtos/pagination.dto';
import { ParcelDto } from 'src/parcels/dtos/parcel.dto';
import { CourierJourneyDto } from './dtos/courier-journey.dto';
import { CourierJourneysService } from './courier-journeys.service';
import { CreateCourierJourneyDto } from './dtos/create-courier-journey.dto';
import { CreateCourierJourneyNoteDto } from './dtos/create-courier-journey-note.dto';
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
  @Permissions(Permission.COURIER_JOURNEY_CREATE)
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
  @Permissions(Permission.COURIER_JOURNEY_READ)
  async findCourierJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CourierJourneyDto> {
    return this.courierJourneysService.findOne(id, currentUser.businessId);
  }

  @Get()
  @Permissions(Permission.COURIER_JOURNEY_READ)
  async findAllCourierJourneys(@CurrentUser() currentUser: UserRequestType) {
    return this.courierJourneysService.findAll(currentUser.businessId);
  }

  @Put('/:id')
  @Permissions(Permission.COURIER_JOURNEY_UPDATE)
  updateCourierJourney(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourierJourneyDto,
  ): Promise<CourierJourneyDto> {
    return this.courierJourneysService.update(id, body, currentUser.businessId);
  }

  @Get('/:courierJourneyId/parcels')
  @Permissions(Permission.COURIER_JOURNEY_READ)
  async findJourneyParcels(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Param('courierJourneyId', ParseIntPipe) courierJourneyId: number,
  ): Promise<Pagination<ParcelDto>> {
    return this.courierJourneysService.findParcelsByCourierJourneyId(
      page,
      courierJourneyId,
    );
  }

  @Post('/:id/notes')
  @Permissions(Permission.COURIER_JOURNEY_NOTE_CREATE)
  @ApiOperation({ summary: 'Add a note to courier journey' })
  @ApiBody({ type: CreateCourierJourneyNoteDto })
  addNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) courierJourneyId: number,
    @Body() body: CreateCourierJourneyNoteDto,
  ) {
    return this.courierJourneysService.addNote(
      courierJourneyId,
      body.content,
      currentUser.id,
      currentUser.businessId,
    );
  }

  @Get('/:id/notes')
  @Permissions(Permission.COURIER_JOURNEY_NOTE_READ)
  @ApiOperation({ summary: 'Get all notes for a courier journey' })
  getNotes(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) courierJourneyId: number,
  ) {
    return this.courierJourneysService.getNotes(
      courierJourneyId,
      currentUser.businessId,
    );
  }

  @Delete('/:id/notes/:noteId')
  @Permissions(Permission.COURIER_JOURNEY_NOTE_DELETE)
  @ApiOperation({ summary: 'Delete a note from courier journey' })
  deleteNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) courierJourneyId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.courierJourneysService.deleteNote(
      noteId,
      currentUser.id,
      currentUser.businessId,
    );
  }
}
