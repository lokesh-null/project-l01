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

  async getUnreadCounts(userId: string) {
    const rows = await this.messageRepo
      .createQueryBuilder('message')
      .select('message.senderId', 'senderId')
      .addSelect('COUNT(message.id)', 'count')
      .where('message.receiverId = :userId', { userId })
      .andWhere('message.status != :status', { status: 'READ' })
      .groupBy('message.senderId')
      .getRawMany();

    return rows;
  }

  async getConversations(userId: string) {
  // 1️⃣ Fetch all messages involving the user
  const messages = await this.messageRepo.find({
    where: [
      { sender: { id: userId } },
      { receiver: { id: userId } },
    ],
    relations: ['sender', 'receiver'],
    order: { createdAt: 'DESC' },
  });

  const conversationMap = new Map<
    string,
    {
      user: { id: string; username: string };
      lastMessage: {
        content: string;
        createdAt: Date;
        status: string;
      };
      unreadCount: number;
    }
  >();

  for (const msg of messages) {
    const isSender = msg.sender.id === userId;
    const otherUser = isSender ? msg.receiver : msg.sender;

    // If conversation already processed, skip
    if (conversationMap.has(otherUser.id)) continue;

    // Count unread messages from this user
    const unreadCount = await this.messageRepo
  .createQueryBuilder('message')
  .where('message.senderId = :senderId', {
    senderId: otherUser.id,
  })
  .andWhere('message.receiverId = :receiverId', {
    receiverId: userId,
  })
  .andWhere('message.status = :status', {
    status: 'DELIVERED',
  })
  .getCount();


    conversationMap.set(otherUser.id, {
      user: {
        id: otherUser.id,
        username: otherUser.username,
      },
      lastMessage: {
        content: msg.content,
        createdAt: msg.createdAt,
        status: msg.status,
      },
      unreadCount,
    });
  }

  return Array.from(conversationMap.values());
}

async getUnreadCountsForUser(userId: string) {
  const rows = await this.messageRepo
    .createQueryBuilder('message')
    .select('message.senderId', 'senderId')
    .addSelect('COUNT(message.id)', 'count')
    .where('message.receiverId = :userId', { userId })
    .andWhere('message.status != :status', { status: 'READ' })
    .groupBy('message.senderId')
    .getRawMany();

  return rows.map(row => ({
    fromUserId: row.senderId,
    unreadCount: Number(row.count),
  }));
}

async deleteForMe(messageId: string, userId: string) {
  const message = await this.messageRepo.findOne({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (!message.deletedFor.includes(userId)) {
    message.deletedFor.push(userId);
    await this.messageRepo.save(message);
  }
}

async unsendMessage(messageId: string, userId: string) {
  const message = await this.messageRepo.findOne({
    where: { id: messageId },
    relations: ['sender', 'receiver'],
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (message.sender.id !== userId) {
    throw new Error('Not allowed to unsend this message');
  }

  message.deletedFor = [
    message.sender.id,
    message.receiver.id,
  ];

  await this.messageRepo.save(message);

  return message;
}


}
