import {
  Get,
  Put,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Controller,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SuperAdminGuard } from 'src/guards/super-admin.guard';
import { BusinessAdminGuard } from 'src/guards/business-admin.guard';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dtos/create-business.dto';
import { UpdateBusinessDto } from './dtos/update-business.dto';
import { CreateBusinessWithAdminDto } from './dtos/create-business-with-admin.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';

// TODO: Question: how we can know current business?

@ApiTags('Business')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  createBusiness(@Body() body: CreateBusinessDto) {
    return this.businessesService.createBusiness(body);
  }

  @Post('with-admin')
  @UseGuards(SuperAdminGuard)
  createBusinessWithAdmin(@Body() body: CreateBusinessWithAdminDto) {
    return this.businessesService.createBusinessWithAdmin(body);
  }

  @Get()
  @UseGuards(SuperAdminGuard)
  async findAllBusinesses() {
    return this.businessesService.findAll();
  }

  @Get('active')
  @UseGuards(SuperAdminGuard)
  async findActiveBusinesses() {
    return this.businessesService.findActiveBusinesses();
  }

  @Get('current')
  async getCurrentBusiness(@CurrentUser() currentUser: UserRequestType) {
    return this.businessesService.getCurrentBusiness(currentUser.businessId);
  }

  @Get('/:id')
  @UseGuards(BusinessAdminGuard)
  async findBusiness(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!currentUser.isSuperAdmin && currentUser.businessId !== id) {
      throw new Error('Access denied to this business');
    }
    return this.businessesService.findOne(id);
  }

  @Put('/:id')
  @UseGuards(BusinessAdminGuard)
  updateBusiness(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBusinessDto,
  ) {
    if (!currentUser.isSuperAdmin && currentUser.businessId !== id) {
      throw new Error('Access denied to this business');
    }
    return this.businessesService.update(id, body);
  }

  @Put('/:id/activate')
  @UseGuards(SuperAdminGuard)
  activateBusiness(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.activateBusiness(id);
  }

  @Put('/:id/deactivate')
  @UseGuards(SuperAdminGuard)
  deactivateBusiness(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.deactivateBusiness(id);
  }

  @Delete('/:id')
  @UseGuards(SuperAdminGuard)
  removeBusiness(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.remove(id);
  }
}
