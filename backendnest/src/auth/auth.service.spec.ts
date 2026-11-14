import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as passwordUtil from '../common/utils/password.util';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: any; permission: any };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('returns a session payload for valid login credentials', async () => {
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hash',
      phone: null,
      status: 'ACTIVE',
      roleId: 'role-1',
      terminalId: null,
      avatarColor: '#000',
      lastActiveAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      role: {
        id: 'role-1',
        name: 'DISPATCHER',
        label: 'Dispatcher',
        description: 'Ops',
        isSystem: false,
        permissionIds: ['perm-queue-view'],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    });

    prisma.permission.findMany.mockResolvedValue([{ id: 'perm-queue-view', name: 'queue.view', label: 'View Queue', module: 'Queue', description: null }]);

    const result = await service.login({ email: 'test@example.com', password: 'password123' } as any);

    expect(result.token).toBe('signed-token');
    expect(result.user.email).toBe('test@example.com');
    expect(result.role.name).toBe('DISPATCHER');
    expect(result.permissions[0].name).toBe('queue.view');
  });

  it('returns a refreshed access token for a valid refresh token', async () => {
    const result = await service.refreshAccessToken('refresh-token' as any);
    expect(result.token).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
  });
});
