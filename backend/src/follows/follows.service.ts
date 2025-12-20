import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow, FollowStatus } from './follow.entity';
import { User } from '../users/user.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private followRepo: Repository<Follow>,

    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async sendFollowRequest(fromUserId: string, toUserId: string) {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const follower = await this.userRepo.findOneBy({ id: fromUserId });
    const following = await this.userRepo.findOneBy({ id: toUserId });

    if (!follower || !following) {
      throw new BadRequestException('User not found');
    }

    const existing = await this.followRepo.findOne({
      where: { follower, following },
    });

    if (existing) {
      throw new BadRequestException('Follow already exists');
    }

    const status = following.isPrivate
      ? FollowStatus.PENDING
      : FollowStatus.ACCEPTED;

    const follow = this.followRepo.create({
      follower,
      following,
      status,
    });

    const savedFollow = await this.followRepo.save(follow);

return {
  id: savedFollow.id,
  status: savedFollow.status,
  createdAt: savedFollow.createdAt,
  follower: {
    id: follower.id,
    username: follower.username,
  },
  following: {
    id: following.id,
    username: following.username,
  },
};

  }

  async acceptRequest(followId: string, userId: string) {
    const follow = await this.followRepo.findOne({
      where: { id: followId },
      relations: ['following'],
    });

    if (!follow || follow.following.id !== userId) {
      throw new BadRequestException('Not authorized');
    }

    follow.status = FollowStatus.ACCEPTED;
    return {
  id: follow.id,
  status: follow.status,
};

  }
}

