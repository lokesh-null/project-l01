import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow, FollowStatus } from '../follows/follow.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
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

  async saveMessage(
    sender: User,
    receiver: User,
    content: string,
  ) {
    const message = this.messageRepo.create({
      sender,
      receiver,
      content,
    });

    return this.messageRepo.save(message);
  }
  async getConversation(
    userA: string,
    userB: string,
    limit = 50,
  ) {
    return this.messageRepo.find({
      where: [
        {
          sender: { id: userA },
          receiver: { id: userB },
        },
        {
          sender: { id: userB },
          receiver: { id: userA },
        },
      ],
      order: {
        createdAt: 'ASC',
      },
      take: limit,
      relations: ['sender', 'receiver'],
    });
  }


}
