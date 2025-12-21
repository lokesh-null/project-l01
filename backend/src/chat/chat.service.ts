import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow, FollowStatus } from '../follows/follow.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async canChat(userA: string, userB: string): Promise<boolean> {
    const follow = await this.followRepo
      .createQueryBuilder('follow')
      .where(
        `(follow.followerId = :userA AND follow.followingId = :userB)
         OR
         (follow.followerId = :userB AND follow.followingId = :userA)`,
        { userA, userB },
      )
      .andWhere('follow.status = :status', {
        status: FollowStatus.ACCEPTED,
      })
      .getOne();

    return !!follow;
  }
}
