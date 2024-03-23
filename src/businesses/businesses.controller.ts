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

// TODO: Question: how we can know current business?

@ApiTags('Business')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  async createBusiness(@Body() body: CreateBusinessDto) {
    return this.businessesService.createBusiness(body);
  }

  @Get()
  async getAllBusinesses() {
    return this.businessesService.findAll();
  }

  @Get('/:id')
  async getBusiness(@Param('id', ParseIntPipe) id: number) {
    return this.businessesService.findOne(id);
  }

  @Put('/:id')
  updateBusiness(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBusinessDto,
  ) {
    // TODO: Add permission
    // 1) user can edit their details
    // 2) Admin can edit all users details

    return this.businessesService.update(id, body);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeBusiness(@Param('id', ParseIntPipe) id: number) {
    // TODO: Question: do we need to remove items or archive?
    return this.businessesService.remove(id);
  }
}
