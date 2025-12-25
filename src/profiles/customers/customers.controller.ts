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

import { CustomersService } from './customers.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { CreateCustomerNoteDto } from './dtos/create-customer-note.dto';
import { AdminGuard } from 'src/guards/admin.guard';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Pagination } from 'src/dtos/pagination.dto';

@ApiTags('Customer Profile')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer profile' })
  @ApiBody({
    type: CreateCustomerProfileDto,
    examples: {
      'uk-customer': {
        summary: 'UK Customer',
        value: {
          firstName: 'John',
          lastName: 'Doe',
          gender: 'Male',
          phoneNumber: {
            number: '07950999888',
            countryCode: '+44',
          },
          note: 'Regular customer',
          address: {
            street: '123 High Street',
            city: 'London',
            region: 'Greater London',
            countryIsoCode: 'GB',
            postcode: 'SW1A 1AA',
            flat: '4B',
          },
        },
      },
    },
  })
  async createProfile(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreateCustomerProfileDto,
  ) {
    return this.customersService.createProfile(body, currentUser.businessId);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by first name, last name, or phone number',
  })
  @ApiQuery({
    name: 'isBlocked',
    required: false,
    type: Boolean,
    description: 'Filter by blocked status',
  })
  @ApiQuery({
    name: 'originCountryId',
    required: false,
    type: Number,
    description: 'Filter by origin country ID (1: Ukraine, 2: United Kingdom)',
  })
  async findAllCustomers(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('isBlocked') isBlocked?: string,
    @Query('originCountryId') originCountryId?: string,
  ): Promise<Pagination<CustomerProfileDto> | CustomerProfileDto[]> {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const isBlockedBoolean =
      isBlocked !== undefined ? isBlocked === 'true' : undefined;
    const originCountryIdNumber = originCountryId
      ? parseInt(originCountryId, 10)
      : undefined;

    return this.customersService.findAll(
      currentUser.businessId,
      pageNumber,
      search,
      isBlockedBoolean,
      originCountryIdNumber,
    );
  }

  @Get('/:id')
  async findCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const profiles = await this.customersService.findOne(
      id,
      currentUser.businessId,
    );

    return profiles;
  }

  @Put('/:id')
  updateCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCustomerProfileDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.customersService.update(id, body, currentUser.businessId);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.customersService.remove(id, currentUser.businessId);
  }

  @Post('/:id/notes')
  @ApiOperation({ summary: 'Add a note to customer profile' })
  @ApiBody({ type: CreateCustomerNoteDto })
  addNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) customerProfileId: number,
    @Body() body: CreateCustomerNoteDto,
  ) {
    return this.customersService.addNote(
      customerProfileId,
      body.content,
      currentUser.id,
      currentUser.businessId,
    );
  }

  @Get('/:id/notes')
  @ApiOperation({ summary: 'Get all notes for a customer profile' })
  getNotes(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) customerProfileId: number,
  ) {
    return this.customersService.getNotes(
      customerProfileId,
      currentUser.businessId,
    );
  }

  @Delete('/:id/notes/:noteId')
  @ApiOperation({ summary: 'Delete a note from customer profile' })
  deleteNote(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) customerProfileId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.customersService.deleteNote(
      noteId,
      currentUser.id,
      currentUser.businessId,
    );
  }
}
