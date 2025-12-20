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
    relations: {
      following: true,
    },
  });

  if (!follow) {
    throw new BadRequestException('Follow request not found');
  }

  if (follow.following.id !== userId) {
    throw new BadRequestException('Not authorized');
  }

  if (follow.status === FollowStatus.ACCEPTED) {
    return { id: follow.id, status: follow.status };
  }

  follow.status = FollowStatus.ACCEPTED;
  await this.followRepo.save(follow);

  return {
    id: follow.id,
    status: follow.status,
  };
}

  async getPendingRequests(userId: string) {
  const pendingRequests = await this.followRepo.find({
    where: {
      status: FollowStatus.PENDING,
      following: { id: userId },
    },
    relations: {
      follower: true,
    },
    order: {
      createdAt: 'DESC',
    },
  });

  return pendingRequests.map((follow) => ({
    followId: follow.id,
    requestedAt: follow.createdAt,
    user: {
      id: follow.follower.id,
      username: follow.follower.username,
    },
  }));
}

async getFollowers(userId: string) {
  const followers = await this.followRepo
    .createQueryBuilder('follow')
    .innerJoinAndSelect('follow.follower', 'follower')
    .where('follow.followingId = :userId', { userId })
    .andWhere('follow.status = :status', {
      status: FollowStatus.ACCEPTED,
    })
    .orderBy('follow.createdAt', 'DESC')
    .getMany();

  return followers.map((follow) => ({
    followedAt: follow.createdAt,
    user: {
      id: follow.follower.id,
      username: follow.follower.username,
    },
  }));
}

async getFollowing(userId: string) {
  const following = await this.followRepo
    .createQueryBuilder('follow')
    .innerJoinAndSelect('follow.following', 'following')
    .where('follow.followerId = :userId', { userId })
    .andWhere('follow.status = :status', {
      status: FollowStatus.ACCEPTED,
    })
    .orderBy('follow.createdAt', 'DESC')
    .getMany();

  return following.map((follow) => ({
    followedAt: follow.createdAt,
    user: {
      id: follow.following.id,
      username: follow.following.username,
    },
  }));
}

async rejectRequest(followId: string, userId: string) {
  const follow = await this.followRepo.findOne({
    where: { id: followId },
    relations: {
      following: true,
    },
  });

  if (!follow) {
    throw new BadRequestException('Follow request not found');
  }

  if (follow.following.id !== userId) {
    throw new BadRequestException('Not authorized to reject this request');
  }

  if (follow.status !== FollowStatus.PENDING) {
    throw new BadRequestException('Only pending requests can be rejected');
  }

  await this.followRepo.remove(follow);

  return {
    message: 'Follow request rejected',
  };
}

async unfollow(targetUserId: string, userId: string) {
  const follow = await this.followRepo.findOne({
    where: {
      status: FollowStatus.ACCEPTED,
    },
    relations: {
      follower: true,
      following: true,
    },
  });

  if (!follow) {
    throw new BadRequestException('Follow relationship not found');
  }

  if (follow.follower.id !== userId || follow.following.id !== targetUserId) {
    throw new BadRequestException('Not authorized to unfollow');
  }

  await this.followRepo.remove(follow);

  return { message: 'Unfollowed successfully' };
}

async removeFollower(targetUserId: string, userId: string) {
  const follow = await this.followRepo.findOne({
    where: {
      status: FollowStatus.ACCEPTED,
    },
    relations: {
      follower: true,
      following: true,
    },
  });

  if (!follow) {
    throw new BadRequestException('Follower relationship not found');
  }

  if (follow.following.id !== userId || follow.follower.id !== targetUserId) {
    throw new BadRequestException('Not authorized to remove follower');
  }

  await this.followRepo.remove(follow);

  return { message: 'Follower removed successfully' };
}

}



