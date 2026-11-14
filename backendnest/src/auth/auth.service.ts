import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { hashPassword, verifyPassword } from '../common/utils/password.util';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private buildSessionPayload(user: any, role: any, permissions: any[]) {
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, role: role.name });
    const refreshToken = this.jwtService.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || undefined,
        roleId: user.roleId,
        status: user.status,
        terminalId: user.terminalId || undefined,
        avatarColor: user.avatarColor || undefined,
        lastActiveAt: user.lastActiveAt?.toISOString() || undefined,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      role: {
        id: role.id,
        name: role.name,
        label: role.label,
        description: role.description || undefined,
        isSystem: role.isSystem,
        permissionIds: role.permissionIds,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      },
      permissions: permissions.map((p) => ({
        id: p.id,
        name: p.name,
        label: p.label,
        module: p.module,
        description: p.description || undefined,
      })),
      token: accessToken,
      refreshToken,
      expiresAt: Date.now() + 8 * 3600 * 1000,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new HttpException('No account found with this email.', HttpStatus.NOT_FOUND);
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, loginDto.password);
    if (!isPasswordValid) {
      throw new HttpException('Incorrect password.', HttpStatus.UNAUTHORIZED);
    }

    if (user.status === 'SUSPENDED') {
      throw new HttpException('This account is suspended.', HttpStatus.FORBIDDEN);
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: user.role.permissionIds },
      },
    });

    return this.buildSessionPayload(user, user.role, permissions);
  }

  async refreshAccessToken(refreshToken: string) {
    if (!refreshToken) {
      throw new HttpException('Refresh token is required.', HttpStatus.BAD_REQUEST);
    }

    try {
      const payload = this.jwtService.verify(refreshToken);
      if (payload?.type !== 'refresh') {
        throw new HttpException('Invalid refresh token.', HttpStatus.UNAUTHORIZED);
      }
    } catch (error) {
      throw new HttpException('Invalid refresh token.', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: this.jwtService.decode(refreshToken)?.sub as string },
      include: { role: true },
    });

    if (!user) {
      throw new HttpException('User not found.', HttpStatus.NOT_FOUND);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: user.role.permissionIds } },
    });

    return this.buildSessionPayload(user, user.role, permissions);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found.', HttpStatus.NOT_FOUND);
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, changePasswordDto.oldPassword);
    if (!isPasswordValid) {
      throw new HttpException('Incorrect old password.', HttpStatus.BAD_REQUEST);
    }

    const newHash = await hashPassword(changePasswordDto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Password changed successfully.' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      throw new HttpException('No account found with this email.', HttpStatus.NOT_FOUND);
    }

    // In a real application, send reset password link via email
    return { message: 'Password reset link sent to your email.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    // In a real application, validate reset token. Here we mock it.
    if (resetPasswordDto.token === 'invalid') {
      throw new HttpException('Invalid reset token.', HttpStatus.BAD_REQUEST);
    }

    const newHash = await hashPassword(resetPasswordDto.newPassword);
    // Find the first user as a mock reset target
    const user = await this.prisma.user.findFirst();
    if (!user) {
      throw new HttpException('No users exist.', HttpStatus.NOT_FOUND);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { message: 'Password has been reset successfully.' };
  }
}
