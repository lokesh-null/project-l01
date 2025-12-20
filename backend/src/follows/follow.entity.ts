import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Unique } from 'typeorm';

export enum FollowStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
}

@Unique(['follower', 'following'])
@Entity()
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  follower: User; // who sent request

  @ManyToOne(() => User)
  following: User; // who is being followed

  @Column({
    type: 'enum',
    enum: FollowStatus,
  })
  status: FollowStatus;

  @CreateDateColumn()
  createdAt: Date;
}
