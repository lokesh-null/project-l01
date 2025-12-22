import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow, FollowStatus } from '../follows/follow.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { MessageStatus } from './message.entity';

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
      status: MessageStatus.SENT
    });

    return this.messageRepo.save(message);
  }

  async markDelivered(messageId: string) {
    await this.messageRepo.update(
      { id: messageId },
      { status: MessageStatus.DELIVERED },
    );
  }


  async markRead(messageId: string) {
    await this.messageRepo.update(
      { id: messageId },
      { status: MessageStatus.READ },
    );
  }


  async getConversation(
    userA: string,
    userB: string,
    limit = 30,
    before?: string,
    ) {
    const qb = this.messageRepo
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .leftJoinAndSelect('message.receiver', 'receiver')
        .where(
        `(sender.id = :userA AND receiver.id = :userB)
        OR
        (sender.id = :userB AND receiver.id = :userA)`,
        { userA, userB },
        )
        .orderBy('message.createdAt', 'DESC')
        .take(limit);

    if (before) {
        qb.andWhere(
        'message.createdAt < (SELECT "createdAt" FROM message WHERE id = :before)',
        { before },
        );
    }

    const messages = await qb.getMany();

    // Return oldest → newest for UI
    return messages.reverse();
  } 


}
