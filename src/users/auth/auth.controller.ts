import { Body, Controller, Get, Post } from '@nestjs/common';

import {
  CurrentUser,
  UserRequestType,
} from '../decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { SignInDto } from '../dtos/auth.dto';
import { CreateUserDto } from '../dtos/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  async createUser(@Body() body: CreateUserDto) {
    return this.authService.signUp(body);
  }

  @Post('/login')
  async login(@Body() body: SignInDto) {
    return this.authService.signIn(body);
  }

  @Get('me')
  me(@CurrentUser() user: UserRequestType) {
    return user;
  }
}

/* 
  1) Add Auth0
  2) 
*/
