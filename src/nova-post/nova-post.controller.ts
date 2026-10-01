import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchNovaPostWarehousesDto } from './dtos/search-warehouses.dto';
import { SearchNovaPostCitiesDto } from './dtos/search-cities.dto';
import { NovaPostService } from './nova-post.service';

@ApiTags('Nova Post')
@Controller('nova-post')
export class NovaPostController {
  constructor(private readonly novaPostService: NovaPostService) {}

  @Get('cities')
  @ApiOperation({ summary: 'Search Nova Post cities' })
  searchCities(@Query() query: SearchNovaPostCitiesDto) {
    return this.novaPostService.searchCities(query);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'Search and cache Nova Post warehouses' })
  searchWarehouses(@Query() query: SearchNovaPostWarehousesDto) {
    return this.novaPostService.searchWarehouses(query);
  }
}
