import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { OrganizationsService } from './organizations.service';

// Encapsulates organization persistence without exposing a public CRUD API in this phase.
@Module({
  imports: [PrismaModule],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
