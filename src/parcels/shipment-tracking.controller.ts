import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/decorators/public.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import {
  TrackingLookupDto,
  TrackingResolveDto,
} from './dtos/public-tracking.dto';
import { ShipmentTrackingService } from './shipment-tracking.service';
import { TrackingRateLimitGuard } from './tracking-rate-limit.guard';

@ApiTags('Tracking')
@Public()
@UseGuards(TrackingRateLimitGuard)
@Controller('public/tracking')
export class PublicTrackingController {
  constructor(private readonly tracking: ShipmentTrackingService) {}

  @Post('lookup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  lookup(@Body() body: TrackingLookupDto) {
    return this.tracking.lookup(body);
  }

  @Post('resolve')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resolve(@Body() body: TrackingResolveDto) {
    return this.tracking.resolve(body.token);
  }
}

@ApiTags('Shipment')
@Controller('shipments')
export class ShipmentTrackingController {
  constructor(private readonly tracking: ShipmentTrackingService) {}

  @Post(':id/tracking-links')
  @Permissions(Permission.PARCEL_READ, Permission.PARCEL_UPDATE)
  @Header('Cache-Control', 'no-store')
  issue(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tracking.issueLink(user, id);
  }

  @Post(':id/tracking-links/revoke')
  @HttpCode(200)
  @Permissions(Permission.PARCEL_READ, Permission.PARCEL_UPDATE)
  revoke(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tracking.revokeLinks(user, id);
  }
}
