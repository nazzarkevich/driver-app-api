import { Body, Controller, Post } from '@nestjs/common';

import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dtos/create-business.dto';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  async createBusiness(@Body() body: CreateBusinessDto) {
    return this.businessesService.createBusiness(body);
  }
}
