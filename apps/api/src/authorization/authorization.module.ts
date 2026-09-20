import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { PermissionGuard } from './permission.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { TenantContextGuard } from './tenant-context.guard';
import { TenantContextService } from './tenant-context.service';

// Authorization infrastructure is shared by tenant and platform controllers without generic repositories.
@Module({
  imports: [PrismaModule],
  providers: [TenantContextService, TenantContextGuard, PermissionGuard, PlatformAdminGuard],
  exports: [TenantContextService, TenantContextGuard, PermissionGuard, PlatformAdminGuard],
})
export class AuthorizationModule {}
