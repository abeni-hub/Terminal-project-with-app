import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in user' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out user' })
  logout() {
    return { success: true };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh session token' })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user session' })
  async me(@CurrentUser() user: any) {
    // In a real application, return the full session.
    // For now we map user and load role properties.
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
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  changePassword(@CurrentUser('id') userId: string, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
