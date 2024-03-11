import { Body, Controller, Get, Post } from '@nestjs/common';

import {
  CurrentUser,
  UserRequestType,
} from '../decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { SignInDto } from '../dtos/auth.dto';
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { Public } from 'src/decorators/public.decorator';

/* 
  TODO: 
  1) Add Auth0
*/

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('/signup')
  async createUser(@Body() body: CreateUserDto) {
    return this.authService.signUp(body);
  }

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
