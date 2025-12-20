import { Controller, Post, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FollowsService } from './follows.service';
import { Get } from '@nestjs/common';

@Controller('follows')
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':userId')
  follow(@Param('userId') userId: string, @Request() req) {
    return this.followsService.sendFollowRequest(req.user.userId, userId);
  }

  @Post('accept/:followId')
  accept(@Param('followId') followId: string, @Request() req) {
    return this.followsService.acceptRequest(followId, req.user.userId);
  }
  @Get('pending')
  getPending(@Request() req) {
    return this.followsService.getPendingRequests(req.user.userId);
  }
}
