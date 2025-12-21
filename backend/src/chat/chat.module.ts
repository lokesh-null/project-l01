import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { PresenceService } from './presence.service';

@Module({
  imports: [
    AuthModule, // 🔴 reuse JwtService config
  ],
  providers: [ChatGateway, PresenceService],
})
export class ChatModule {}
