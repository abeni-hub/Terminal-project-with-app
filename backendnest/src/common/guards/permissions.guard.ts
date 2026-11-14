import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      return false;
    }
    if (user.role.name === 'SUPER_ADMIN') {
      return true;
    }

    const userPermSet = new Set<string>();
    (user.permissions || []).forEach((p: { id?: string; name?: string }) => {
      if (p.id) userPermSet.add(p.id);
      if (p.name) userPermSet.add(p.name);
    });
    (user.role?.permissionIds || []).forEach((item: string) => {
      userPermSet.add(item);
    });

    return requiredPermissions.some((permission) => userPermSet.has(permission));
  }
}
