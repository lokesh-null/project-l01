import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io'
import { Socket } from 'socket.io';
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
  constructor(private readonly jwtService: JwtService, 
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
  ) {}
  
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.split(' ')[1];

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
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('private_message')
  async handlePrivateMessage(
    @MessageBody()
    payload: { toUserId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUser = client.data.user;

    if (!fromUser) {
      return;
    }

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

  // 3️⃣ Persist message
  await this.chatService.saveMessage(
    { id: fromUser.userId } as User,
    { id: payload.toUserId } as User,
    payload.message,
  );

  // 4️⃣ Deliver message
  this.server.to(targetSocketId).emit('private_message', {
    fromUserId: fromUser.userId,
    message: payload.message,
  });

}


}
