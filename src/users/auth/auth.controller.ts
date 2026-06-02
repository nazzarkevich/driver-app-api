import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import {
  CurrentUser,
  UserRequestType,
} from '../decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { SignInDto } from '../dtos/sign-in.dto';
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { RegisterCustomerDto } from '../dtos/register-customer.dto';
import { Public } from 'src/decorators/public.decorator';
import { UserDto } from '../dtos/user.dto';
import { OAuthSignInDto } from '../dtos/oauth-sign-in.dto';
import { UserType } from '@prisma/client';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { SupabaseVerifyGuard } from 'src/guards/supabase-verify.guard';
import {
  ADMIN_EXTRA_PERMISSIONS,
  AppName,
  getAllowedApps,
  ROLE_PERMISSIONS,
} from 'src/permissions/permissions';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @ApiCreatedResponse({
    description: 'Create a user',
    type: UserDto,
  })
  @ApiConflictResponse({
    description: "Can't create a user with the same email address",
  })
  @Public()
  @Post('/signup')
  async createUser(@Body() body: CreateUserDto) {
    return this.authService.signUp(body);
  }

  @ApiCreatedResponse({
    description: 'Successfully login',
  })
  @ApiBadRequestResponse({ description: "User doesn't exist" })
  @Public()
  @Post('/login')
  async login(@Body() body: SignInDto) {
    return this.authService.signIn(body);
  }

  @ApiCreatedResponse({
    description: 'Successfully authenticated with OAuth provider',
  })
  @ApiBadRequestResponse({ description: 'OAuth authentication failed' })
  @Public()
  @Post('/oauth')
  async oauthSignIn(@Body() body: OAuthSignInDto) {
    return this.authService.handleOAuthSignIn(
      body.provider,
      body.token,
      body.app,
    );
  }

  @ApiCreatedResponse({
    description: 'Successfully refreshed token',
  })
  @ApiBadRequestResponse({ description: 'Invalid refresh token' })
  @Public()
  @Post('/refresh')
  async refreshToken(@Body() body: RefreshTokenDto, @Req() request: Request) {
    const refreshToken =
      body.refreshToken || request.headers['x-refresh-token'];
    const accessToken = request.headers.authorization?.split(' ')[1];

    console.log('📨 /auth/refresh endpoint called:', {
      hasBodyRefreshToken: !!body.refreshToken,
      hasHeaderRefreshToken: !!request.headers['x-refresh-token'],
      hasAccessToken: !!accessToken,
      bodyRefreshTokenLength: body.refreshToken?.length || 0,
      headerRefreshTokenLength: request.headers['x-refresh-token']
        ? (request.headers['x-refresh-token'] as string).length
        : 0,
    });

    if (!refreshToken) {
      console.error(
        '❌ No refresh token provided in request body or X-Refresh-Token header',
      );
      throw new BadRequestException(
        'Refresh token is required in request body or X-Refresh-Token header',
      );
    }

    if (
      typeof refreshToken === 'string' &&
      (refreshToken.length < 50 || refreshToken.length > 500)
    ) {
      console.error(
        `❌ Refresh token appears invalid (length: ${refreshToken.length})`,
      );
      throw new BadRequestException(
        'Invalid refresh token format. Token appears corrupted. Please log in again.',
      );
    }

    return this.authService.refreshToken(
      refreshToken as string,
      accessToken as string,
    );
  }

  @ApiCreatedResponse({
    description: 'Customer registered successfully',
    type: UserDto,
  })
  @ApiConflictResponse({
    description: 'Account already registered or profile already linked',
  })
  @ApiBearerAuth()
  @Public()
  @UseGuards(SupabaseVerifyGuard)
  @Post('/register/customer')
  async registerCustomer(
    @Body() body: RegisterCustomerDto,
    @Req() request: Request,
  ) {
    return this.authService.registerCustomer(body, request.supabaseUserId);
  }

  @ApiOkResponse({
    description: 'Successfully logged out',
  })
  @Post('/logout')
  async logout(@CurrentUser() user: UserRequestType, @Req() request: Request) {
    const accessToken =
      request.accessToken || request.headers.authorization?.split(' ')[1];
    await this.authService.logout(accessToken, user.id.toString());
    return { message: 'Successfully logged out' };
  }

  @Get('me')
  async me(@CurrentUser() user: UserRequestType) {
    const include: any = { phoneNumber: true, business: true };

    if (user.type === UserType.InternationalDriver) {
      include.driverProfile = true;
    } else if (user.type === UserType.ParcelCourier) {
      include.courierProfile = true;
    }

    const userData = await this.usersService.findOne(user.id, include);

    const rolePermissions = ROLE_PERMISSIONS[user.type] ?? [];
    const effectivePermissions = user.isAdmin
      ? [...rolePermissions, ...ADMIN_EXTRA_PERMISSIONS]
      : rolePermissions;

    const allowedApps = user.isSuperAdmin
      ? Object.values(AppName)
      : getAllowedApps(effectivePermissions);

    return { ...userData, allowedApps };
  }
}
