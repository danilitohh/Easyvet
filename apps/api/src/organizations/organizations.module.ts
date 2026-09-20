import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { OrganizationsService } from './organizations.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OrganizationController } from './organization.controller';

// Encapsulates organization persistence without exposing a public CRUD API in this phase.
@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [OrganizationController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
