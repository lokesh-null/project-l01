import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':userId')
  async getChatHistory(
    @CurrentUser() user: { userId: string },
    @Param('userId') otherUserId: string,
    @Query('limit') limit?: string,
  ) {
    const canChat = await this.chatService.canChat(
      user.userId,
      otherUserId,
    );

    if (!canChat) {
      throw new ForbiddenException(
        'You are not allowed to view this chat',
      );
    }

    const messages = await this.chatService.getConversation(
      user.userId,
      otherUserId,
      limit ? Number(limit) : 50,
    );

    return messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      sender: {
        id: msg.sender.id,
        username: msg.sender.username,
      },
      receiver: {
        id: msg.receiver.id,
        username: msg.receiver.username,
      },
      createdAt: msg.createdAt,
    }));
  }
}
