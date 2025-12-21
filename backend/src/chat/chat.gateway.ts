import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PresenceService } from './presence.service';
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly jwtService: JwtService, private readonly presenceService: PresenceService,) {}
  
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

}
