import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { validateEnvironment } from './config/env';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { LocationsModule } from './locations/locations.module';
import { MembershipsModule } from './memberships/memberships.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { CsrfOriginMiddleware } from './http/csrf-origin.middleware';
import { OwnersModule } from './owners/owners.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ClinicalModule } from './clinical/clinical.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { VaccinationsModule } from './vaccinations/vaccinations.module';
import { DewormingsModule } from './dewormings/dewormings.module';
import { ProceduresModule } from './procedures/procedures.module';
import { AnesthesiaModule } from './anesthesia/anesthesia.module';
import { HospitalizationsModule } from './hospitalizations/hospitalizations.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { DocumentsModule } from './documents/documents.module';
import { ConsentsModule } from './consents/consents.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { GroomingModule } from './grooming/grooming.module';
import { InventoryModule } from './inventory/inventory.module';
import { CommercialModule } from './commercial/commercial.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PlatformModule,
    OrganizationsModule,
    UsersModule,
    MembershipsModule,
    LocationsModule,
    OwnersModule,
    PatientsModule,
    AppointmentsModule,
    ClinicalModule,
    PrescriptionsModule,
    VaccinationsModule,
    DewormingsModule,
    ProceduresModule,
    AnesthesiaModule,
    HospitalizationsModule,
    DiagnosticsModule,
    DocumentsModule,
    ConsentsModule,
    FollowUpsModule,
    GroomingModule,
    InventoryModule,
    CommercialModule,
  ],
  providers: [ApiExceptionFilter],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser(), CsrfOriginMiddleware).forRoutes('*');
  }
}
