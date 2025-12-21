import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private onlineUsers = new Map<string, string>();
  // userId -> socketId

  setOnline(userId: string, socketId: string) {
    this.onlineUsers.set(userId, socketId);
  }

  setOffline(userId: string) {
    this.onlineUsers.delete(userId);
  }

  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  getSocketId(userId: string): string | undefined {
    return this.onlineUsers.get(userId);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers.keys());
  }
}
