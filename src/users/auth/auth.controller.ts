import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiTags,
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

/* 
  TODO: 
  1) Add Auth0
*/

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

  @Get('me')
  me(@CurrentUser() user: UserRequestType) {
    // TODO: Question: what data should be returned for /me endpoint?
    return this.usersService.findOne(user.id);
  }
}
