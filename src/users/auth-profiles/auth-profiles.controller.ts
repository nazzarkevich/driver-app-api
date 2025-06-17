import {
  Controller,
  Get,
  UseGuards,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthProfilesService } from './auth-profiles.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { AdminGuard } from 'src/guards/admin.guard';
import {
  CurrentUser,
  UserRequestType,
} from '../decorators/current-user.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('auth-profiles')
export class AuthProfilesController {
  private readonly logger = new Logger(AuthProfilesController.name);

  constructor(
    private readonly authProfilesService: AuthProfilesService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getMyAuthProfile(@CurrentUser() user: UserRequestType) {
    this.logger.log(`Getting auth profile for user with ID: ${user.id}`);

    // First get the user from the database to find their supabaseId
    const dbUser = await this.prismaService.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser || !dbUser.supabaseId) {
      throw new NotFoundException('User or Supabase ID not found');
    }

    return this.authProfilesService.findBySupabaseId(dbUser.supabaseId);
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  async getAllAuthProfiles() {
    this.logger.log('Getting all auth profiles (admin only)');
    return this.authProfilesService.getAll();
  }
}
