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

import { AdminGuard } from 'src/guards/admin.guard';
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
  @UseGuards(AdminGuard)
  createBusiness(@Body() body: CreateBusinessDto) {
    return this.businessesService.createBusiness(body);
  }

  @Post('with-admin')
  createBusinessWithAdmin(@Body() body: CreateBusinessWithAdminDto) {
    return this.businessesService.createBusinessWithAdmin(body);
  }

  @Get()
  async findAllBusinesses() {
    return this.businessesService.findAll();
  }

  @Get('active')
  async findActiveBusinesses() {
    return this.businessesService.findActiveBusinesses();
  }

  @Get('current')
  async getCurrentBusiness(@CurrentUser() currentUser: UserRequestType) {
    return this.businessesService.getCurrentBusiness(currentUser.businessId);
  }

  @Get('/:id')
  async findBusiness(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.findOne(id);
  }

  @Put('/:id')
  @UseGuards(AdminGuard)
  updateBusiness(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBusinessDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.businessesService.update(id, body);
  }

  @Put('/:id/activate')
  @UseGuards(AdminGuard)
  activateBusiness(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.activateBusiness(id);
  }

  @Put('/:id/deactivate')
  @UseGuards(AdminGuard)
  deactivateBusiness(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.deactivateBusiness(id);
  }

  @Delete('/:id')
  @UseGuards(AdminGuard)
  removeBusiness(@Param('id', ParseIntPipe) id: number) {
    // TODO: Question: do we need to remove items or archive?
    return this.businessesService.remove(id);
  }
}
