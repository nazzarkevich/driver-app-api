import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CarriersService } from './carriers.service';
import { Pagination } from 'src/dtos/pagination.dto';
import { CarrierDto } from './dtos/carrier.dto';

@ApiTags('Carrier')
@Controller('carriers')
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  async getAllCarriers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('search') search?: string,
  ): Promise<Pagination<CarrierDto>> {
    return this.carriersService.findAll(page, search);
  }
}
