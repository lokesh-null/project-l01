import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

import { PresenceService } from './presence.service';
import { ChatService } from './chat.service';
import { User } from '../users/user.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
  ) {}

  // ===============================
  // CONNECTION / DISCONNECTION
  // ===============================

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);

      client.data.user = {
        userId: payload.sub,
        email: payload.email,
      };

      this.presenceService.setOnline(payload.sub, client.id);

      console.log(`🟢 ${payload.email} is ONLINE`);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      this.presenceService.setOffline(user.userId);
      console.log(`🔴 ${user.email} went OFFLINE`);
    }
  }

  // ===============================
  // PRIVATE MESSAGE (SENT → DELIVERED)
  // ===============================

  @SubscribeMessage('private_message')
  async handlePrivateMessage(
    @MessageBody()
    payload: { toUserId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUser = client.data.user;
    if (!fromUser) return;

    // 1️⃣ Permission check
    const canChat = await this.chatService.canChat(
      fromUser.userId,
      payload.toUserId,
    );

    if (!canChat) {
      client.emit('error', 'Not allowed to chat with this user');
      return;
    }

    // 2️⃣ Receiver online?
    const targetSocketId =
      this.presenceService.getSocketId(payload.toUserId);

    if (!targetSocketId) {
      client.emit('error', 'User is offline');
      return;
    }

    // 3️⃣ Save message (SENT)
    const savedMessage = await this.chatService.saveMessage(
      { id: fromUser.userId } as User,
      { id: payload.toUserId } as User,
      payload.message,
    );

    // 4️⃣ Deliver message to receiver
    this.server.to(targetSocketId).emit('private_message', {
      id: savedMessage.id,
      fromUserId: fromUser.userId,
      message: savedMessage.content,
      status: savedMessage.status,
      createdAt: savedMessage.createdAt,
    });

    // 5️⃣ Mark as DELIVERED
    await this.chatService.markDelivered(savedMessage.id);

    // 🔔 Real-time unread count update for receiver
const receiverSocketId =
  this.presenceService.getSocketId(payload.toUserId);

if (receiverSocketId) {
  const unreadCounts =
    await this.chatService.getUnreadCountsForUser(payload.toUserId);

  this.server
    .to(receiverSocketId)
    .emit('unread_counts_update', unreadCounts);
}

// 🔔 Real-time unread count update for reader
const readerId = client.data.user.userId;
const readerSocketId =
  this.presenceService.getSocketId(readerId);

if (readerSocketId) {
  const unreadCounts =
    await this.chatService.getUnreadCountsForUser(readerId);

  this.server
    .to(readerSocketId)
    .emit('unread_counts_update', unreadCounts);
}

    // 6️⃣ Notify sender
    client.emit('message_status', {
      messageId: savedMessage.id,
      status: 'DELIVERED',
    });
  }

  // ===============================
  // READ RECEIPT (DELIVERED → READ)
  // ===============================

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @MessageBody() payload: { messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user) return;

    // 1️⃣ Update DB
    await this.chatService.markRead(payload.messageId);

    // 2️⃣ Notify sender (simple global emit for now)
    this.server.emit('message_status', {
      messageId: payload.messageId,
      status: 'READ',
    });
  }

  @SubscribeMessage('typing_start')
async handleTypingStart(
  @MessageBody() payload: { toUserId: string },
  @ConnectedSocket() client: Socket,
) {
  const fromUser = client.data.user;
  if (!fromUser) return;

  // Permission check
  const canChat = await this.chatService.canChat(
    fromUser.userId,
    payload.toUserId,
  );
  if (!canChat) return;

  const targetSocketId =
    this.presenceService.getSocketId(payload.toUserId);

  if (!targetSocketId) return;

  this.server.to(targetSocketId).emit('typing_start', {
    fromUserId: fromUser.userId,
  });
}

@SubscribeMessage('typing_stop')
async handleTypingStop(
  @MessageBody() payload: { toUserId: string },
  @ConnectedSocket() client: Socket,
) {
  const fromUser = client.data.user;
  if (!fromUser) return;

  const targetSocketId =
    this.presenceService.getSocketId(payload.toUserId);

  if (!targetSocketId) return;

  this.server.to(targetSocketId).emit('typing_stop', {
    fromUserId: fromUser.userId,
  });
}

@SubscribeMessage('message_delete_for_me')
async handleDeleteForMe(
  @MessageBody() payload: { messageId: string },
  @ConnectedSocket() client: Socket,
) {
  const user = client.data.user;
  if (!user) return;

  try {
    await this.chatService.deleteForMe(
      payload.messageId,
      user.userId,
    );

    client.emit('message_deleted_for_me', {
      messageId: payload.messageId,
    });
  } catch (err) {
    client.emit('error', err.message);
  }
}

@SubscribeMessage('message_unsend')
async handleUnsend(
  @MessageBody() payload: { messageId: string },
  @ConnectedSocket() client: Socket,
) {
  const user = client.data.user;
  if (!user) return;

  try {
    const message = await this.chatService.unsendMessage(
      payload.messageId,
      user.userId,
    );

    this.server.emit('message_unsent', {
      messageId: message.id,
    });
  } catch (err) {
    client.emit('error', err.message);
  }
}


}
