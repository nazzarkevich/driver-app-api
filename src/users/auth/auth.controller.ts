import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiOkResponse,
} from '@nestjs/swagger';

import {
  CurrentUser,
  UserRequestType,
} from '../decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { SignInDto } from '../dtos/sign-in.dto';
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { Public } from 'src/decorators/public.decorator';
import { UserDto } from '../dtos/user.dto';
import { OAuthSignInDto } from '../dtos/oauth-sign-in.dto';
import { UserType } from '@prisma/client';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';

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
      body.businessId,
    );
  }

  @ApiCreatedResponse({
    description: 'Successfully refreshed token',
  })
  @ApiBadRequestResponse({ description: 'Invalid refresh token' })
  @Public()
  @Post('/refresh')
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
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
    const include: any = {
      phoneNumber: true,
      business: true,
    };

    // Add profile based on user type
    if (user.type === UserType.InternationalDriver) {
      include.driverProfile = true;
    } else if (user.type === UserType.ParcelCourier) {
      include.courierProfile = true;
    }

    return this.usersService.findOne(user.id, include);
  }
}
