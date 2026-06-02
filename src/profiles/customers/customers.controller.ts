import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation, ApiBody } from '@nestjs/swagger';

import { CustomersService } from './customers.service';
import { CreateCustomerProfileDto } from './dtos/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dtos/update-customer-profile.dto';
import { CustomerProfileDto } from './dtos/customer-profile.dto';
import { CreateCustomerNoteDto } from './dtos/create-customer-note.dto';
import { GrantAccessDto } from './dtos/grant-access.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Pagination } from 'src/dtos/pagination.dto';
import { AddAddressDto } from 'src/addresses/dtos/add-address.dto';
import { UpdateAddressDto } from 'src/addresses/dtos/update-address.dto';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';

@ApiTags('Customer Profile')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Permissions(Permission.CUSTOMER_CREATE)
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
  @Permissions(Permission.CUSTOMER_READ)
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
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  async findAllCustomers(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('isBlocked') isBlocked?: string,
    @Query('originCountryId') originCountryId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<Pagination<CustomerProfileDto> | CustomerProfileDto[]> {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const isBlockedBoolean =
      isBlocked !== undefined ? isBlocked === 'true' : undefined;
    const originCountryIdNumber = originCountryId
      ? parseInt(originCountryId, 10)
      : undefined;
    const isActiveBoolean =
      isActive !== undefined ? isActive === 'true' : undefined;

    return this.customersService.findAll(
      currentUser.businessId,
      pageNumber,
      search,
      isBlockedBoolean,
      originCountryIdNumber,
      isActiveBoolean,
    );
  }

  @Get('/:id')
  @Permissions(Permission.CUSTOMER_READ)
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
  @Permissions(Permission.CUSTOMER_UPDATE)
  updateCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCustomerProfileDto,
  ) {
    return this.customersService.update(id, body, currentUser.businessId);
  }

  @Patch('/:id/block')
  @Permissions(Permission.CUSTOMER_BLOCK)
  async toggleBlockCustomer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: UserRequestType,
  ): Promise<CustomerProfileDto> {
    return this.customersService.toggleBlock(id, currentUser);
  }

  @Delete('/:id')
  @Permissions(Permission.CUSTOMER_DELETE)
  removeCustomer(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.customersService.remove(id, currentUser.businessId);
  }

  @Post('/:id/grant-access')
  @Permissions(Permission.CUSTOMER_GRANT_ACCESS)
  @ApiOperation({
    summary:
      'Grant account access to a customer (admin creates User + AuthProfile with temporary password)',
  })
  @ApiBody({ type: GrantAccessDto })
  async grantAccess(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: GrantAccessDto,
  ): Promise<CustomerProfileDto> {
    return this.customersService.grantAccess(id, body, currentUser);
  }

  @Post('/:id/notes')
  @Permissions(Permission.CUSTOMER_NOTE_CREATE)
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
  @Permissions(Permission.CUSTOMER_NOTE_READ)
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
  @Permissions(Permission.CUSTOMER_NOTE_DELETE)
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

  @Post('/:id/addresses')
  @Permissions(Permission.CUSTOMER_ADDRESS_CREATE)
  @ApiOperation({ summary: 'Add an address to a customer profile' })
  @ApiBody({ type: AddAddressDto })
  addAddress(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) customerId: number,
    @Body() body: AddAddressDto,
  ): Promise<CustomerProfileDto> {
    return this.customersService.addAddress(
      customerId,
      body,
      currentUser.businessId,
    );
  }

  @Patch('/:id/addresses/:addressId')
  @Permissions(Permission.CUSTOMER_ADDRESS_UPDATE)
  @ApiOperation({ summary: 'Update an address of a customer profile' })
  updateAddress(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) customerId: number,
    @Param('addressId', ParseIntPipe) addressId: number,
    @Body() body: UpdateAddressDto,
  ): Promise<CustomerProfileDto> {
    return this.customersService.updateAddress(
      customerId,
      addressId,
      body,
      currentUser.businessId,
    );
  }

  @Patch('/:id/addresses/:addressId/primary')
  @Permissions(Permission.CUSTOMER_ADDRESS_UPDATE)
  @ApiOperation({ summary: 'Set an address as primary for a customer profile' })
  setPrimaryAddress(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) customerId: number,
    @Param('addressId', ParseIntPipe) addressId: number,
  ): Promise<CustomerProfileDto> {
    return this.customersService.setPrimaryAddress(
      customerId,
      addressId,
      currentUser.businessId,
    );
  }

  @Delete('/:id/addresses/:addressId')
  @Permissions(Permission.CUSTOMER_ADDRESS_DELETE)
  @ApiOperation({ summary: 'Remove an address from a customer profile' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAddress(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) customerId: number,
    @Param('addressId', ParseIntPipe) addressId: number,
  ): Promise<void> {
    return this.customersService.removeAddress(
      customerId,
      addressId,
      currentUser.businessId,
    );
  }
}
