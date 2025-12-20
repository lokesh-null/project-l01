import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    const userId = req.user.userId;

    const user = await this.usersService.findById(userId);

    // 🔒 NEVER return password
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
    };
  }
}
