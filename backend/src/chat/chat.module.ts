import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';
import { ChatService } from './chat.service';
import { Follow } from '../follows/follow.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Follow]),
  ],
  providers: [
    ChatGateway,
    PresenceService,
    ChatService,
  ],
})
export class ChatModule {}
