import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './follow.entity';
import { FollowsService } from './follows.service';
import { FollowsController } from './follows.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, User])],
  providers: [FollowsService],
  controllers: [FollowsController],
})
export class FollowsModule {}
