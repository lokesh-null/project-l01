import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async signup(username: string, email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.usersRepo.create({
      username,
      email,
      password: hashedPassword,
    });

    await this.usersRepo.save(user);

    return { message: 'User created successfully' };
  }

  async login(email: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return { access_token: token };
  }
}
