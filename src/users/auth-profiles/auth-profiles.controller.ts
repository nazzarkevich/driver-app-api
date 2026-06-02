import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { AuthProfilesService } from './auth-profiles.service';
import { AdminGuard } from 'src/guards/admin.guard';
import {
  CurrentUser,
  UserRequestType,
} from '../decorators/current-user.decorator';

@Controller('auth-profiles')
export class AuthProfilesController {
  private readonly logger = new Logger(AuthProfilesController.name);

  constructor(private readonly authProfilesService: AuthProfilesService) {}

  @Get('me')
  async getMyAuthProfile(@CurrentUser() user: UserRequestType) {
    this.logger.log(`Getting auth profile for user with ID: ${user.id}`);
    return this.authProfilesService.findByUserId(user.id);
  }

  @Get()
  @UseGuards(AdminGuard)
  async getAllAuthProfiles() {
    this.logger.log('Getting all auth profiles (admin only)');
    return this.authProfilesService.getAll();
  }
}
