import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'aatransport_jwt_secret_key_change_in_production',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
      },
    });

    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User is unauthorized or suspended.');
    }

    // Fetch permission records so the PermissionsGuard can compare by name or ID
    const permissionIdsOrNames = user.role?.permissionIds || [];
    const permissions = await this.prisma.permission.findMany({
      where: {
        OR: [
          { id: { in: permissionIdsOrNames } },
          { name: { in: permissionIdsOrNames } },
        ],
      },
      select: { id: true, name: true },
    });

    return { ...user, permissions };
  }
}
