import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const demoPassword = process.env.EASYVET_DEMO_PASSWORD ?? 'EasyvetDemo!2026';

const seedOrganizations = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Veterinaria Demo Norte',
    slug: 'veterinaria-demo-norte',
    locationId: '00000000-0000-4000-8000-000000000011',
    locationName: 'Sede Norte',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Veterinaria Demo Sur',
    slug: 'veterinaria-demo-sur',
    locationId: '00000000-0000-4000-8000-000000000012',
    locationName: 'Sede Sur',
    city: 'Bogotá',
  },
];

const seedUsers = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    email: 'owner.norte@demo.local',
    organizationId: seedOrganizations[0].id,
    membershipId: '00000000-0000-4000-8000-000000000201',
    role: 'OWNER',
    clinicalRole: 'PRACTITIONER',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    email: 'owner.sur@demo.local',
    organizationId: seedOrganizations[1].id,
    membershipId: '00000000-0000-4000-8000-000000000202',
    role: 'OWNER',
    clinicalRole: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    email: 'multi@demo.local',
    organizationId: seedOrganizations[0].id,
    membershipId: '00000000-0000-4000-8000-000000000203',
    role: 'ASSISTANT',
    clinicalRole: 'CLINICAL_ASSISTANT',
  },
];

const seedOwners = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    organizationId: seedOrganizations[0].id,
    firstName: 'Camila',
    lastName: 'Rojas',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-1001',
    email: 'camila.rojas@demo.local',
    phone: '+57 300 000 1001',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    organizationId: seedOrganizations[0].id,
    firstName: 'Andrés',
    lastName: 'Gil',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-1002',
    email: 'andres.gil@demo.local',
    phone: '+57 300 000 1002',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000303',
    organizationId: seedOrganizations[1].id,
    firstName: 'Valentina',
    lastName: 'Mora',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-2001',
    email: 'valentina.mora@demo.local',
    phone: '+57 300 000 2001',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000304',
    organizationId: seedOrganizations[1].id,
    firstName: 'Sofía',
    lastName: 'Torres',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-2002',
    email: 'sofia.torres@demo.local',
    phone: '+57 300 000 2002',
    city: 'Bogotá',
  },
];

const seedPatients = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    organizationId: seedOrganizations[0].id,
    ownerId: seedOwners[0].id,
    name: 'Luna',
    species: 'DOG',
    breed: 'Mestiza',
    sex: 'FEMALE',
    currentWeightKg: 12.4,
  },
  {
    id: '00000000-0000-4000-8000-000000000402',
    organizationId: seedOrganizations[0].id,
    ownerId: seedOwners[0].id,
    name: 'Bruno',
    species: 'DOG',
    breed: 'Labrador',
    sex: 'MALE',
    currentWeightKg: 24.1,
  },
  {
    id: '00000000-0000-4000-8000-000000000403',
    organizationId: seedOrganizations[0].id,
    ownerId: seedOwners[1].id,
    name: 'Nala',
    species: 'CAT',
    breed: 'Criolla',
    sex: 'FEMALE',
    currentWeightKg: 4.2,
  },
  {
    id: '00000000-0000-4000-8000-000000000404',
    organizationId: seedOrganizations[1].id,
    ownerId: seedOwners[2].id,
    name: 'Milo',
    species: 'CAT',
    breed: 'Criollo',
    sex: 'MALE',
    currentWeightKg: 5.1,
  },
  {
    id: '00000000-0000-4000-8000-000000000405',
    organizationId: seedOrganizations[1].id,
    ownerId: seedOwners[2].id,
    name: 'Kira',
    species: 'DOG',
    breed: 'Beagle',
    sex: 'FEMALE',
    currentWeightKg: 9.8,
  },
  {
    id: '00000000-0000-4000-8000-000000000406',
    organizationId: seedOrganizations[1].id,
    ownerId: seedOwners[3].id,
    name: 'Simba',
    species: 'DOG',
    breed: 'Mestizo',
    sex: 'MALE',
    currentWeightKg: 17.6,
  },
];

const seedAvailabilityRules = [
  {
    id: '00000000-0000-4000-8000-000000000501',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    membershipId: null,
    dayOfWeek: 2,
    startLocalTime: '08:00',
    endLocalTime: '18:00',
    slotMinutes: 30,
  },
  {
    id: '00000000-0000-4000-8000-000000000502',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    membershipId: seedUsers[2].membershipId,
    dayOfWeek: 2,
    startLocalTime: '09:00',
    endLocalTime: '17:00',
    slotMinutes: 30,
  },
  {
    id: '00000000-0000-4000-8000-000000000503',
    organizationId: seedOrganizations[1].id,
    clinicLocationId: seedOrganizations[1].locationId,
    membershipId: null,
    dayOfWeek: 2,
    startLocalTime: '08:00',
    endLocalTime: '18:00',
    slotMinutes: 30,
  },
];

const seedAppointments = [
  {
    id: '00000000-0000-4000-8000-000000000601',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[0].id,
    ownerId: seedOwners[0].id,
    assignedMembershipId: seedUsers[2].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'SCHEDULED',
    startsAt: '2030-01-08T14:00:00.000Z',
    endsAt: '2030-01-08T14:30:00.000Z',
    reason: 'Control general',
  },
  {
    id: '00000000-0000-4000-8000-000000000602',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[1].id,
    ownerId: seedOwners[0].id,
    assignedMembershipId: null,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'WAITING_ROOM',
    startsAt: '2030-01-08T15:00:00.000Z',
    endsAt: '2030-01-08T15:30:00.000Z',
    reason: 'Vacunación',
  },
  {
    id: '00000000-0000-4000-8000-000000000603',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[2].id,
    ownerId: seedOwners[1].id,
    assignedMembershipId: seedUsers[0].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'COMPLETED',
    startsAt: '2030-01-07T14:00:00.000Z',
    endsAt: '2030-01-07T14:30:00.000Z',
    reason: 'Consulta completada',
  },
  {
    id: '00000000-0000-4000-8000-000000000604',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[2].id,
    ownerId: seedOwners[1].id,
    assignedMembershipId: seedUsers[0].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'CANCELLED',
    startsAt: '2030-01-08T16:00:00.000Z',
    endsAt: '2030-01-08T16:30:00.000Z',
    reason: 'Cirugía cancelada',
    cancelledAt: '2029-12-20T12:00:00.000Z',
    cancelledByMembershipId: seedUsers[0].membershipId,
    cancellationReason: 'Reprogramada por el cliente',
  },
  {
    id: '00000000-0000-4000-8000-000000000605',
    organizationId: seedOrganizations[1].id,
    clinicLocationId: seedOrganizations[1].locationId,
    patientId: seedPatients[3].id,
    ownerId: seedOwners[2].id,
    assignedMembershipId: '00000000-0000-4000-8000-000000000204',
    createdByMembershipId: '00000000-0000-4000-8000-000000000202',
    status: 'SCHEDULED',
    startsAt: '2030-01-08T14:00:00.000Z',
    endsAt: '2030-01-08T14:30:00.000Z',
    reason: 'Consulta Sur',
  },
  {
    id: '00000000-0000-4000-8000-000000000606',
    organizationId: seedOrganizations[1].id,
    clinicLocationId: seedOrganizations[1].locationId,
    patientId: seedPatients[4].id,
    ownerId: seedOwners[2].id,
    assignedMembershipId: null,
    createdByMembershipId: '00000000-0000-4000-8000-000000000202',
    status: 'COMPLETED',
    startsAt: '2030-01-07T14:00:00.000Z',
    endsAt: '2030-01-07T14:30:00.000Z',
    reason: 'Control Sur',
  },
];

// Clinical seed data is intentionally small and fictitious so tenant isolation can be exercised.
const seedClinicalRecords = [
  {
    id: '00000000-0000-4000-8000-000000000801',
    organizationId: seedOrganizations[0].id,
    patientId: seedPatients[0].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000802',
    organizationId: seedOrganizations[1].id,
    patientId: seedPatients[3].id,
  },
];

const seedProfessionalProfiles = [
  {
    id: '00000000-0000-4000-8000-000000000701',
    organizationId: seedOrganizations[0].id,
    membershipId: seedUsers[0].membershipId,
    displayName: 'Dra. Camila Rojas',
    licenseNumber: 'VET-DEMO-001',
  },
  {
    id: '00000000-0000-4000-8000-000000000702',
    organizationId: seedOrganizations[0].id,
    membershipId: seedUsers[2].membershipId,
    displayName: 'Asistente clínica demo',
    licenseNumber: null,
  },
];

const seedClinicalEncounters = [
  {
    id: '00000000-0000-4000-8000-000000000901',
    organizationId: seedOrganizations[0].id,
    clinicalRecordId: seedClinicalRecords[0].id,
    patientId: seedPatients[0].id,
    ownerIdAtTime: seedOwners[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    appointmentId: null,
    responsibleMembershipId: null,
    status: 'DRAFT',
    version: 1,
    reason: 'Control clínico de QA',
    anamnesis: 'Consulta de seguimiento ficticia.',
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    occurredAt: '2030-01-08T15:00:00.000Z',
    createdByMembershipId: seedUsers[2].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000000902',
    organizationId: seedOrganizations[0].id,
    clinicalRecordId: seedClinicalRecords[0].id,
    patientId: seedPatients[0].id,
    ownerIdAtTime: seedOwners[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    appointmentId: seedAppointments[0].id,
    responsibleMembershipId: seedUsers[0].membershipId,
    status: 'FINALIZED',
    version: 1,
    reason: 'Consulta general ficticia',
    anamnesis: 'La paciente mantiene apetito y actividad normales.',
    physicalExam: 'Mucosas rosadas; auscultación sin hallazgos relevantes.',
    presumptiveDiagnosis: 'Paciente clínicamente estable.',
    diagnosticPlan: 'No requiere pruebas adicionales en esta visita.',
    therapeuticPlan: 'Continuar observación en casa.',
    recommendations: 'Control preventivo en seis meses.',
    followUpPlan: 'Revisión preventiva.',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    finalizedAt: '2030-01-08T15:30:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    occurredAt: '2030-01-08T14:00:00.000Z',
    createdByMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000000903',
    organizationId: seedOrganizations[1].id,
    clinicalRecordId: seedClinicalRecords[1].id,
    patientId: seedPatients[3].id,
    ownerIdAtTime: seedOwners[2].id,
    clinicLocationId: seedOrganizations[1].locationId,
    appointmentId: null,
    responsibleMembershipId: '00000000-0000-4000-8000-000000000204',
    status: 'DRAFT',
    version: 1,
    reason: 'Control Sur ficticio',
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    occurredAt: '2030-01-08T16:00:00.000Z',
    createdByMembershipId: '00000000-0000-4000-8000-000000000204',
  },
  {
    id: '00000000-0000-4000-8000-000000000904',
    organizationId: seedOrganizations[0].id,
    clinicalRecordId: seedClinicalRecords[0].id,
    patientId: seedPatients[0].id,
    ownerIdAtTime: seedOwners[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    appointmentId: null,
    responsibleMembershipId: seedUsers[0].membershipId,
    status: 'FINALIZED',
    version: 1,
    reason: 'Seguimiento posterior al alta ficticio',
    anamnesis: 'Encuentro de demostración para el historial de hospitalización.',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    finalizedAt: '2030-01-07T20:30:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    occurredAt: '2030-01-07T20:00:00.000Z',
    createdByMembershipId: seedUsers[0].membershipId,
  },
];

// Stable fictional episodes cover Norte lifecycle states and one Sur tenant record.
const seedHospitalizations = [
  {
    id: '00000000-0000-4000-8000-000000001601',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    patientId: seedPatients[0].id,
    status: 'DRAFT',
    version: 1,
    admittedAt: null,
    locationName: 'Norte · observación',
    admissionReason: 'Borrador de ingreso de demostración.',
    diagnosis: null,
    treatmentPlan: null,
    medicationsText: null,
    dietInstructions: null,
    notes: 'Registro ficticio; todavía no inicia la hospitalización.',
    responsiblePractitionerMembershipId: null,
    createdByMembershipId: seedUsers[2].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001602',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    patientId: seedPatients[0].id,
    status: 'ACTIVE',
    version: 3,
    admittedAt: '2030-01-08T15:35:00.000Z',
    locationName: 'Norte · observación 1',
    admissionReason: 'Observación clínica de demostración.',
    diagnosis: 'Paciente estable en observación.',
    treatmentPlan: 'Monitorear tolerancia oral y confort.',
    medicationsText: 'Medicaciones de ejemplo: según indicación clínica.',
    dietInstructions: 'Agua disponible; dieta habitual en porciones pequeñas.',
    notes: 'Episodio ficticio para revisar el Kardex activo.',
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    activatedAt: '2030-01-08T15:40:00.000Z',
    activatedByMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001603',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[3].id,
    patientId: seedPatients[0].id,
    status: 'DISCHARGED',
    version: 4,
    admittedAt: '2030-01-07T14:00:00.000Z',
    dischargedAt: '2030-01-07T20:00:00.000Z',
    locationName: 'Norte · recuperación',
    admissionReason: 'Recuperación de demostración.',
    diagnosis: 'Recuperación sin complicaciones.',
    treatmentPlan: 'Observación y soporte.',
    medicationsText: 'Medicaciones de ejemplo registradas en la historia.',
    dietInstructions: 'Reintroducción gradual de alimento.',
    dischargeSummary: 'Paciente estable al momento del alta.',
    dischargeRecommendations: 'Control según evolución clínica.',
    notes: 'Episodio histórico ficticio de demostración.',
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    activatedAt: '2030-01-07T14:05:00.000Z',
    activatedByMembershipId: seedUsers[0].membershipId,
    dischargedByMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001604',
    organizationId: seedOrganizations[1].id,
    clinicalEncounterId: seedClinicalEncounters[2].id,
    patientId: seedPatients[3].id,
    status: 'DRAFT',
    version: 1,
    admittedAt: null,
    locationName: 'Sur · consulta',
    admissionReason: 'Ingreso de demostración del tenant Sur.',
    diagnosis: null,
    treatmentPlan: null,
    medicationsText: null,
    dietInstructions: null,
    notes: null,
    responsiblePractitionerMembershipId: null,
    createdByMembershipId: '00000000-0000-4000-8000-000000000204',
  },
];

// Kardex fixtures exist only for active or discharged episodes, matching the write lifecycle.
const seedHospitalizationEntries = [
  {
    id: '00000000-0000-4000-8000-000000001611',
    organizationId: seedOrganizations[0].id,
    hospitalizationId: seedHospitalizations[1].id,
    entryType: 'EVOLUTION',
    recordedAt: '2030-01-08T15:45:00.000Z',
    content: 'Paciente tranquila, tolera agua y responde al entorno.',
    temperatureC: 38.2,
    heartRateBpm: 96,
    respiratoryRatePerMinute: 24,
    weightKg: null,
    recordedByMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001612',
    organizationId: seedOrganizations[0].id,
    hospitalizationId: seedHospitalizations[2].id,
    entryType: 'MONITORING',
    recordedAt: '2030-01-07T18:00:00.000Z',
    content: 'Control de recuperación previo al alta.',
    temperatureC: 38.1,
    heartRateBpm: 92,
    respiratoryRatePerMinute: 22,
    weightKg: null,
    recordedByMembershipId: seedUsers[0].membershipId,
  },
];

// Procedures and surgeries use fictional records in both demo tenants for phase 6F.2A.
const seedClinicalProcedures = [
  {
    id: '00000000-0000-4000-8000-000000001501',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    patientId: seedPatients[0].id,
    kind: 'PROCEDURE',
    status: 'DRAFT',
    version: 1,
    procedureName: 'Limpieza ótica de control',
    performedAt: '2030-01-08T15:20:00.000Z',
    indication: 'Control preventivo ficticio.',
    description: 'Registro demostrativo editable.',
    createdByMembershipId: seedUsers[2].membershipId,
    responsiblePractitionerMembershipId: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001502',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    patientId: seedPatients[0].id,
    kind: 'PROCEDURE',
    status: 'FINALIZED',
    version: 2,
    procedureName: 'Limpieza dental',
    performedAt: '2030-01-08T14:35:00.000Z',
    indication: 'Profilaxis dental de demostración.',
    description: 'Procedimiento ficticio registrado para visualizar historia clínica.',
    createdByMembershipId: seedUsers[0].membershipId,
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    finalizedAt: '2030-01-08T14:45:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001503',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    patientId: seedPatients[0].id,
    kind: 'SURGERY',
    status: 'DRAFT',
    version: 1,
    procedureName: 'Evaluación quirúrgica',
    performedAt: null,
    createdByMembershipId: seedUsers[2].membershipId,
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001504',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    patientId: seedPatients[0].id,
    kind: 'SURGERY',
    status: 'FINALIZED',
    version: 2,
    procedureName: 'Ovariohisterectomía',
    performedAt: '2030-01-08T14:50:00.000Z',
    indication: 'Cirugía demostrativa ficticia.',
    technique: 'Abordaje convencional descrito para QA.',
    findings: 'Sin hallazgos inesperados.',
    recoveryNotes: 'Recuperación inicial estable.',
    postoperativePlan: 'Control clínico de seguimiento.',
    createdByMembershipId: seedUsers[0].membershipId,
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    finalizedAt: '2030-01-08T15:10:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001505',
    organizationId: seedOrganizations[1].id,
    clinicalEncounterId: seedClinicalEncounters[2].id,
    patientId: seedPatients[3].id,
    kind: 'PROCEDURE',
    status: 'DRAFT',
    version: 1,
    procedureName: 'Evaluación dermatológica Sur',
    performedAt: null,
    createdByMembershipId: '00000000-0000-4000-8000-000000000204',
    responsiblePractitionerMembershipId: '00000000-0000-4000-8000-000000000204',
  },
];

const seedClinicalSurgeryDetails = [
  {
    id: '00000000-0000-4000-8000-000000001601',
    organizationId: seedOrganizations[0].id,
    clinicalProcedureId: seedClinicalProcedures[2].id,
    assistantMembershipId: seedUsers[2].membershipId,
    surgicalArea: 'Abdomen',
  },
  {
    id: '00000000-0000-4000-8000-000000001602',
    organizationId: seedOrganizations[0].id,
    clinicalProcedureId: seedClinicalProcedures[3].id,
    assistantMembershipId: seedUsers[2].membershipId,
    assistantDisplayNameSnapshot: 'Asistente clínica demo',
    surgicalArea: 'Abdomen',
    surgicalSide: 'Línea media',
    bleedingNotes: 'Control adecuado durante el procedimiento.',
    closureNotes: 'Cierre por planos, nota ficticia.',
  },
];

// Anesthesia records are independent evidence: one standalone Draft, one finalized Surgery link and one South tenant draft.
const seedAnesthesiaRecords = [
  {
    id: '00000000-0000-4000-8000-000000001701',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    clinicalProcedureId: null,
    patientId: seedPatients[0].id,
    status: 'DRAFT',
    version: 2,
    startedAt: '2030-01-08T15:10:00.000Z',
    endedAt: null,
    asaClassification: null,
    technique: 'Sedación demostrativa en borrador.',
    preAnestheticAssessment: null,
    medicationsText: 'Narrativa ficticia sin integración a prescripción.',
    airwayManagement: null,
    fluidsText: null,
    complications: null,
    recoveryNotes: null,
    notes: 'Registro anestésico draft de seed.',
    createdByMembershipId: seedUsers[2].membershipId,
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001702',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    clinicalProcedureId: seedClinicalProcedures[3].id,
    patientId: seedPatients[0].id,
    status: 'FINALIZED',
    version: 2,
    startedAt: '2030-01-08T14:50:00.000Z',
    endedAt: '2030-01-08T15:05:00.000Z',
    asaClassification: 'II',
    technique: 'Anestesia general ficticia para cirugía demo.',
    preAnestheticAssessment: 'Evaluación preanestésica ficticia sin hallazgos.',
    medicationsText: 'Narrativa libre de medicamentos anestésicos demo.',
    airwayManagement: 'Tubo endotraqueal demo.',
    fluidsText: 'Fluidos cristaloides demo.',
    complications: null,
    recoveryNotes: 'Recuperación inicial estable, dato ficticio.',
    notes: 'Finalized anesthesia seed.',
    createdByMembershipId: seedUsers[0].membershipId,
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    finalizedAt: '2030-01-08T15:08:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001703',
    organizationId: seedOrganizations[1].id,
    clinicalEncounterId: seedClinicalEncounters[2].id,
    clinicalProcedureId: null,
    patientId: seedPatients[3].id,
    status: 'DRAFT',
    version: 1,
    startedAt: null,
    endedAt: null,
    asaClassification: null,
    technique: null,
    preAnestheticAssessment: null,
    medicationsText: null,
    airwayManagement: null,
    fluidsText: null,
    complications: null,
    recoveryNotes: null,
    notes: 'Registro anestésico draft Sur ficticio.',
    createdByMembershipId: '00000000-0000-4000-8000-000000000204',
    responsiblePractitionerMembershipId: '00000000-0000-4000-8000-000000000204',
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
];

const seedAnesthesiaObservations = [
  {
    id: '00000000-0000-4000-8000-000000001801',
    organizationId: seedOrganizations[0].id,
    anesthesiaRecordId: seedAnesthesiaRecords[0].id,
    observedAt: '2030-01-08T15:15:00.000Z',
    heartRateBpm: 88,
    respiratoryRatePerMinute: 0,
    temperatureC: null,
    bloodPressureText: null,
    spo2Percent: 98,
    etco2MmHg: 34,
    anestheticPlane: null,
    notes: 'Observación ficticia con FR cero documentable.',
  },
  {
    id: '00000000-0000-4000-8000-000000001802',
    organizationId: seedOrganizations[0].id,
    anesthesiaRecordId: seedAnesthesiaRecords[1].id,
    observedAt: '2030-01-08T14:55:00.000Z',
    heartRateBpm: 96,
    respiratoryRatePerMinute: 18,
    temperatureC: 38.2,
    bloodPressureText: 'Doppler 95 mmHg',
    spo2Percent: 99,
    etco2MmHg: 35,
    anestheticPlane: 'Plano estable demo',
    notes: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001803',
    organizationId: seedOrganizations[0].id,
    anesthesiaRecordId: seedAnesthesiaRecords[1].id,
    observedAt: '2030-01-08T15:00:00.000Z',
    heartRateBpm: null,
    respiratoryRatePerMinute: null,
    temperatureC: null,
    bloodPressureText: 'MAP 70',
    spo2Percent: null,
    etco2MmHg: null,
    anestheticPlane: null,
    notes: 'Lectura de presión ficticia.',
  },
];

const seedVitalMeasurements = [
  {
    id: '00000000-0000-4000-8000-000000001001',
    organizationId: seedOrganizations[0].id,
    clinicalRecordId: seedClinicalRecords[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    patientId: seedPatients[0].id,
    measuredAt: '2030-01-08T14:05:00.000Z',
    weightKg: 12.4,
    temperatureC: 38.5,
    heartRateBpm: 96,
    respiratoryRateBpm: 24,
    bodyCondition: 'Bueno',
    hydration: 'Normal',
    mucousMembranes: 'Rosadas',
    skinTurgor: 'Normal',
    observations: 'Medición ficticia de QA.',
    recordedByMembershipId: seedUsers[0].membershipId,
  },
  {
    id: '00000000-0000-4000-8000-000000001002',
    organizationId: seedOrganizations[0].id,
    clinicalRecordId: seedClinicalRecords[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    patientId: seedPatients[0].id,
    measuredAt: '2030-01-08T15:05:00.000Z',
    weightKg: 12.5,
    temperatureC: null,
    heartRateBpm: null,
    respiratoryRateBpm: null,
    bodyCondition: null,
    hydration: null,
    mucousMembranes: null,
    skinTurgor: null,
    observations: 'Medición de borrador ficticia.',
    recordedByMembershipId: seedUsers[2].membershipId,
  },
];

const seedClinicalEvolutions = [
  {
    id: '00000000-0000-4000-8000-000000001101',
    organizationId: seedOrganizations[0].id,
    clinicalRecordId: seedClinicalRecords[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    occurredAt: '2030-01-08T15:20:00.000Z',
    subjective: 'La familia reporta evolución favorable.',
    objective: 'Signos vitales dentro del rango esperado.',
    assessment: 'Sin cambios clínicos relevantes.',
    plan: 'Mantener recomendaciones.',
    authorMembershipId: seedUsers[0].membershipId,
  },
];

// Prescription seed records are fictitious and cover draft/finalized states in both tenants.
const seedPrescriptions = [
  {
    id: '00000000-0000-4000-8000-000000001301',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    patientId: seedPatients[0].id,
    status: 'DRAFT',
    version: 1,
    prescribedByMembershipId: null,
    createdByMembershipId: seedUsers[2].membershipId,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    diagnosisSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001302',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    patientId: seedPatients[0].id,
    status: 'FINALIZED',
    version: 2,
    prescribedByMembershipId: seedUsers[0].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    diagnosisSnapshot: 'Presuntivo: Paciente clínicamente estable.',
    finalizedAt: '2030-01-08T15:35:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001303',
    organizationId: seedOrganizations[1].id,
    clinicalEncounterId: seedClinicalEncounters[2].id,
    patientId: seedPatients[3].id,
    status: 'DRAFT',
    version: 1,
    prescribedByMembershipId: null,
    createdByMembershipId: '00000000-0000-4000-8000-000000000204',
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    diagnosisSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
];

const seedPrescriptionItems = [
  {
    id: '00000000-0000-4000-8000-000000001401',
    prescriptionId: seedPrescriptions[0].id,
    position: 0,
    medicationName: 'Medicamento QA draft',
    presentation: 'Tabletas',
    quantity: '10 tabletas',
    dosage: '1/2 tableta',
    frequency: 'Cada 12 horas',
    duration: '5 días',
    observations: 'Dato ficticio de demostración.',
  },
  {
    id: '00000000-0000-4000-8000-000000001402',
    prescriptionId: seedPrescriptions[1].id,
    position: 0,
    medicationName: 'Antiinflamatorio QA',
    presentation: 'Suspensión',
    quantity: '1 frasco',
    dosage: '2 ml',
    frequency: 'Cada 8 horas',
    duration: '7 días',
    observations: 'Primera indicación ficticia.',
  },
  {
    id: '00000000-0000-4000-8000-000000001403',
    prescriptionId: seedPrescriptions[1].id,
    position: 1,
    medicationName: 'Protector gástrico QA',
    presentation: 'Cápsulas',
    quantity: '7 cápsulas',
    dosage: '1 cápsula',
    frequency: 'Cada 24 horas',
    duration: '7 días',
    observations: 'Segunda indicación ficticia.',
  },
];

// Preventive-care fixtures exercise both lifecycle states and both tenants without
// introducing production-like clinical data into the development seed.
const seedVaccinations = [
  {
    id: '00000000-0000-4000-8000-000000001501',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    patientId: seedPatients[0].id,
    status: 'DRAFT',
    version: 1,
    administeredOn: null,
    nextDueOn: null,
    vaccineName: null,
    vaccineType: null,
    route: null,
    laboratoryName: null,
    lotNumber: null,
    expiryOn: null,
    doseText: null,
    notes: null,
    createdByMembershipId: seedUsers[2].membershipId,
    responsiblePractitionerMembershipId: null,
    administeredByMembershipId: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    administeredByDisplayNameSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001502',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    patientId: seedPatients[0].id,
    status: 'FINALIZED',
    version: 2,
    administeredOn: '2030-01-08',
    nextDueOn: '2030-07-08',
    vaccineName: 'Rabia QA',
    vaccineType: 'Monovalente',
    route: 'Subcutánea',
    laboratoryName: 'Laboratorio QA',
    lotNumber: 'QA-VAC-001',
    expiryOn: '2031-01-08',
    doseText: '1 ml',
    notes: 'Registro ficticio de vacunación para QA.',
    createdByMembershipId: seedUsers[0].membershipId,
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    administeredByMembershipId: null,
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    administeredByDisplayNameSnapshot: null,
    finalizedAt: '2030-01-08T16:00:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
];

const seedDewormings = [
  {
    id: '00000000-0000-4000-8000-000000001503',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[0].id,
    patientId: seedPatients[0].id,
    status: 'DRAFT',
    version: 1,
    administeredOn: null,
    nextDueOn: null,
    productName: null,
    dewormingType: null,
    doseText: null,
    notes: null,
    createdByMembershipId: seedUsers[2].membershipId,
    responsiblePractitionerMembershipId: null,
    administeredByMembershipId: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    administeredByDisplayNameSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001504',
    organizationId: seedOrganizations[0].id,
    clinicalEncounterId: seedClinicalEncounters[1].id,
    patientId: seedPatients[0].id,
    status: 'FINALIZED',
    version: 2,
    administeredOn: '2030-01-08',
    nextDueOn: '2030-04-08',
    productName: 'Antiparasitario QA',
    dewormingType: 'Interna',
    doseText: '1 tableta',
    notes: 'Registro ficticio de desparasitación para QA.',
    createdByMembershipId: seedUsers[0].membershipId,
    responsiblePractitionerMembershipId: seedUsers[0].membershipId,
    administeredByMembershipId: null,
    patientNameSnapshot: 'Luna',
    ownerDisplayNameSnapshot: 'Camila Rojas',
    professionalDisplayNameSnapshot: 'Dra. Camila Rojas',
    professionalLicenseSnapshot: 'VET-DEMO-001',
    administeredByDisplayNameSnapshot: null,
    finalizedAt: '2030-01-08T16:05:00.000Z',
    finalizedByMembershipId: seedUsers[0].membershipId,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001505',
    organizationId: seedOrganizations[1].id,
    clinicalEncounterId: seedClinicalEncounters[2].id,
    patientId: seedPatients[3].id,
    status: 'DRAFT',
    version: 1,
    administeredOn: null,
    nextDueOn: null,
    productName: 'QA Sur',
    dewormingType: null,
    doseText: null,
    notes: 'Registro ficticio de tenant Sur.',
    createdByMembershipId: '00000000-0000-4000-8000-000000000204',
    responsiblePractitionerMembershipId: '00000000-0000-4000-8000-000000000204',
    administeredByMembershipId: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    administeredByDisplayNameSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
  },
];

const seedClinicalAuditEvents = [
  {
    id: '00000000-0000-4000-8000-000000001201',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'CLINICAL_RECORD',
    entityId: seedClinicalRecords[0].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6B.1' },
  },
  {
    id: '00000000-0000-4000-8000-000000001202',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'CLINICAL_ENCOUNTER',
    entityId: seedClinicalEncounters[1].id,
    action: 'FINALIZED',
    metadata: { source: 'seed', stage: '6B.1' },
  },
  {
    id: '00000000-0000-4000-8000-000000001203',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'CLINICAL_EVOLUTION',
    entityId: seedClinicalEvolutions[0].id,
    action: 'EVOLUTION_ADDED',
    metadata: { source: 'seed', stage: '6B.1' },
  },
  {
    id: '00000000-0000-4000-8000-000000001204',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'VITAL_MEASUREMENT',
    entityId: seedVitalMeasurements[0].id,
    action: 'VITAL_ADDED',
    metadata: { source: 'seed', stage: '6B.1' },
  },
  {
    id: '00000000-0000-4000-8000-000000001205',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'PRESCRIPTION',
    entityId: seedPrescriptions[0].id,
    action: 'PRESCRIPTION_CREATED',
    metadata: { source: 'seed', stage: '6D.2', itemCount: 1, newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001206',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'PRESCRIPTION',
    entityId: seedPrescriptions[1].id,
    action: 'PRESCRIPTION_CREATED',
    metadata: { source: 'seed', stage: '6D.2', itemCount: 2, newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001207',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'PRESCRIPTION',
    entityId: seedPrescriptions[1].id,
    action: 'PRESCRIPTION_FINALIZED',
    metadata: { source: 'seed', stage: '6D.2', itemCount: 2, previousVersion: 1, newVersion: 2 },
  },
  {
    id: '00000000-0000-4000-8000-000000001208',
    organizationId: seedOrganizations[1].id,
    actorMembershipId: '00000000-0000-4000-8000-000000000204',
    entityType: 'PRESCRIPTION',
    entityId: seedPrescriptions[2].id,
    action: 'PRESCRIPTION_CREATED',
    metadata: { source: 'seed', stage: '6D.2', itemCount: 0, newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001209',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'VACCINATION',
    entityId: seedVaccinations[0].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6E.2', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001210',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'VACCINATION',
    entityId: seedVaccinations[1].id,
    action: 'FINALIZED',
    metadata: { source: 'seed', stage: '6E.2', previousVersion: 1, newVersion: 2 },
  },
  {
    id: '00000000-0000-4000-8000-000000001211',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'DEWORMING',
    entityId: seedDewormings[0].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6E.2', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001212',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'DEWORMING',
    entityId: seedDewormings[1].id,
    action: 'FINALIZED',
    metadata: { source: 'seed', stage: '6E.2', previousVersion: 1, newVersion: 2 },
  },
  {
    id: '00000000-0000-4000-8000-000000001213',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'CLINICAL_PROCEDURE',
    entityId: seedClinicalProcedures[0].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2A', kind: 'PROCEDURE', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001214',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'CLINICAL_PROCEDURE',
    entityId: seedClinicalProcedures[1].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2A', kind: 'PROCEDURE', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001215',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'CLINICAL_PROCEDURE',
    entityId: seedClinicalProcedures[1].id,
    action: 'FINALIZED',
    metadata: { source: 'seed', stage: '6F.2A', newVersion: 2 },
  },
  {
    id: '00000000-0000-4000-8000-000000001216',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'CLINICAL_PROCEDURE',
    entityId: seedClinicalProcedures[2].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2A', kind: 'SURGERY', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001217',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'CLINICAL_PROCEDURE',
    entityId: seedClinicalProcedures[3].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2A', kind: 'SURGERY', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001218',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'CLINICAL_PROCEDURE',
    entityId: seedClinicalProcedures[3].id,
    action: 'FINALIZED',
    metadata: { source: 'seed', stage: '6F.2A', newVersion: 2 },
  },
  {
    id: '00000000-0000-4000-8000-000000001219',
    organizationId: seedOrganizations[1].id,
    actorMembershipId: '00000000-0000-4000-8000-000000000204',
    entityType: 'CLINICAL_PROCEDURE',
    entityId: seedClinicalProcedures[4].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2A', kind: 'PROCEDURE', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001220',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'ANESTHESIA_RECORD',
    entityId: seedAnesthesiaRecords[0].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2B', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001221',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'ANESTHESIA_RECORD',
    entityId: seedAnesthesiaRecords[0].id,
    action: 'UPDATED',
    metadata: {
      source: 'seed',
      stage: '6F.2B',
      observationAction: 'ADDED',
      previousVersion: 1,
      newVersion: 2,
    },
  },
  {
    id: '00000000-0000-4000-8000-000000001222',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'ANESTHESIA_RECORD',
    entityId: seedAnesthesiaRecords[1].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2B', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001223',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'ANESTHESIA_RECORD',
    entityId: seedAnesthesiaRecords[1].id,
    action: 'FINALIZED',
    metadata: { source: 'seed', stage: '6F.2B', previousVersion: 1, newVersion: 2 },
  },
  {
    id: '00000000-0000-4000-8000-000000001224',
    organizationId: seedOrganizations[1].id,
    actorMembershipId: '00000000-0000-4000-8000-000000000204',
    entityType: 'ANESTHESIA_RECORD',
    entityId: seedAnesthesiaRecords[2].id,
    action: 'CREATED',
    metadata: { source: 'seed', stage: '6F.2B', newVersion: 1 },
  },
  {
    id: '00000000-0000-4000-8000-000000001301',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[2].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[0].id,
    action: 'HOSPITALIZATION_CREATED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 0, versionTo: 1, status: 'DRAFT' },
  },
  {
    id: '00000000-0000-4000-8000-000000001302',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[1].id,
    action: 'HOSPITALIZATION_CREATED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 0, versionTo: 1, status: 'DRAFT' },
  },
  {
    id: '00000000-0000-4000-8000-000000001303',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[1].id,
    action: 'HOSPITALIZATION_ACTIVATED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 1, versionTo: 2, status: 'ACTIVE' },
  },
  {
    id: '00000000-0000-4000-8000-000000001304',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[1].id,
    action: 'HOSPITALIZATION_ENTRY_ADDED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 2, versionTo: 3, status: 'ACTIVE' },
  },
  {
    id: '00000000-0000-4000-8000-000000001305',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[2].id,
    action: 'HOSPITALIZATION_CREATED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 0, versionTo: 1, status: 'DRAFT' },
  },
  {
    id: '00000000-0000-4000-8000-000000001306',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[2].id,
    action: 'HOSPITALIZATION_ACTIVATED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 1, versionTo: 2, status: 'ACTIVE' },
  },
  {
    id: '00000000-0000-4000-8000-000000001307',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[2].id,
    action: 'HOSPITALIZATION_ENTRY_ADDED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 2, versionTo: 3, status: 'ACTIVE' },
  },
  {
    id: '00000000-0000-4000-8000-000000001308',
    organizationId: seedOrganizations[0].id,
    actorMembershipId: seedUsers[0].membershipId,
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[2].id,
    action: 'HOSPITALIZATION_DISCHARGED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 3, versionTo: 4, status: 'DISCHARGED' },
  },
  {
    id: '00000000-0000-4000-8000-000000001309',
    organizationId: seedOrganizations[1].id,
    actorMembershipId: '00000000-0000-4000-8000-000000000204',
    entityType: 'HOSPITALIZATION',
    entityId: seedHospitalizations[3].id,
    action: 'HOSPITALIZATION_CREATED',
    metadata: { source: 'seed', stage: '6G', versionFrom: 0, versionTo: 1, status: 'DRAFT' },
  },
];

async function main() {
  // Hash the local-only demo credential with Argon2id; plaintext never reaches PostgreSQL.
  const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

  await prisma.$transaction(async (transaction) => {
    for (const organization of seedOrganizations) {
      await transaction.organization.upsert({
        where: { slug: organization.slug },
        update: {
          name: organization.name,
          status: 'ACTIVE',
          timezone: 'America/Bogota',
          locale: 'es-CO',
          currencyCode: 'COP',
        },
        create: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: 'ACTIVE',
          timezone: 'America/Bogota',
          locale: 'es-CO',
          currencyCode: 'COP',
        },
      });

      await transaction.clinicLocation.upsert({
        where: { id: organization.locationId },
        update: {
          organizationId: organization.id,
          name: organization.locationName,
          status: 'ACTIVE',
          address: 'Dirección demo local',
          city: organization.city,
        },
        create: {
          id: organization.locationId,
          organizationId: organization.id,
          name: organization.locationName,
          status: 'ACTIVE',
          address: 'Dirección demo local',
          city: organization.city,
        },
      });
    }

    for (const user of seedUsers) {
      await transaction.user.upsert({
        where: { email: user.email },
        update: {
          passwordHash,
          status: 'ACTIVE',
          platformRole: 'USER',
        },
        create: {
          id: user.id,
          email: user.email,
          passwordHash,
          status: 'ACTIVE',
          platformRole: 'USER',
        },
      });

      await transaction.membership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: user.organizationId,
          },
        },
        update: { role: user.role, clinicalRole: user.clinicalRole, status: 'ACTIVE' },
        create: {
          id: user.membershipId,
          userId: user.id,
          organizationId: user.organizationId,
          role: user.role,
          clinicalRole: user.clinicalRole,
          status: 'ACTIVE',
        },
      });
    }

    // The multi-organization identity proves a user can belong to both tenants.
    await transaction.membership.upsert({
      where: {
        userId_organizationId: {
          userId: seedUsers[2].id,
          organizationId: seedOrganizations[1].id,
        },
      },
      update: { role: 'VETERINARIAN', clinicalRole: 'PRACTITIONER', status: 'ACTIVE' },
      create: {
        id: '00000000-0000-4000-8000-000000000204',
        userId: seedUsers[2].id,
        organizationId: seedOrganizations[1].id,
        role: 'VETERINARIAN',
        clinicalRole: 'PRACTITIONER',
        status: 'ACTIVE',
      },
    });

    for (const owner of seedOwners) {
      const documentNumberNormalized = owner.documentNumber.toUpperCase();
      await transaction.owner.upsert({
        where: { id: owner.id },
        update: {
          organizationId: owner.organizationId,
          firstName: owner.firstName,
          lastName: owner.lastName,
          documentType: owner.documentType,
          documentNumber: owner.documentNumber,
          documentNumberNormalized,
          email: owner.email,
          phone: owner.phone,
          city: owner.city,
          status: 'ACTIVE',
          archivedAt: null,
        },
        create: {
          id: owner.id,
          organizationId: owner.organizationId,
          firstName: owner.firstName,
          lastName: owner.lastName,
          documentType: owner.documentType,
          documentNumber: owner.documentNumber,
          documentNumberNormalized,
          email: owner.email,
          phone: owner.phone,
          city: owner.city,
          status: 'ACTIVE',
        },
      });
    }

    for (const patient of seedPatients) {
      await transaction.patient.upsert({
        where: { id: patient.id },
        update: {
          organizationId: patient.organizationId,
          ownerId: patient.ownerId,
          name: patient.name,
          nameNormalized: patient.name.toLocaleLowerCase(),
          species: patient.species,
          breed: patient.breed,
          sex: patient.sex,
          currentWeightKg: patient.currentWeightKg,
          status: 'ACTIVE',
          archivedAt: null,
        },
        create: {
          id: patient.id,
          organizationId: patient.organizationId,
          ownerId: patient.ownerId,
          name: patient.name,
          nameNormalized: patient.name.toLocaleLowerCase(),
          species: patient.species,
          breed: patient.breed,
          sex: patient.sex,
          currentWeightKg: patient.currentWeightKg,
          status: 'ACTIVE',
        },
      });
    }

    for (const rule of seedAvailabilityRules) {
      await transaction.availabilityRule.upsert({
        where: { id: rule.id },
        update: { ...rule, isActive: true, notes: null },
        create: { ...rule, isActive: true, notes: null },
      });
    }

    for (const appointment of seedAppointments) {
      await transaction.appointment.upsert({
        where: { id: appointment.id },
        update: {
          ...appointment,
          startsAt: new Date(appointment.startsAt),
          endsAt: new Date(appointment.endsAt),
          cancelledAt: appointment.cancelledAt ? new Date(appointment.cancelledAt) : null,
        },
        create: {
          ...appointment,
          startsAt: new Date(appointment.startsAt),
          endsAt: new Date(appointment.endsAt),
          cancelledAt: appointment.cancelledAt ? new Date(appointment.cancelledAt) : null,
        },
      });
    }

    for (const profile of seedProfessionalProfiles) {
      await transaction.membershipProfessionalProfile.upsert({
        where: {
          membershipId_organizationId: {
            membershipId: profile.membershipId,
            organizationId: profile.organizationId,
          },
        },
        update: {
          organizationId: profile.organizationId,
          displayName: profile.displayName,
          licenseNumber: profile.licenseNumber,
        },
        create: { ...profile },
      });
    }

    for (const record of seedClinicalRecords) {
      await transaction.clinicalRecord.upsert({
        where: { id: record.id },
        update: { organizationId: record.organizationId, patientId: record.patientId },
        create: { ...record },
      });
    }

    for (const encounter of seedClinicalEncounters) {
      const { id: encounterId, ...encounterFields } = encounter;
      const data = {
        ...encounterFields,
        occurredAt: new Date(encounter.occurredAt),
        finalizedAt: encounter.finalizedAt ? new Date(encounter.finalizedAt) : null,
      };
      await transaction.clinicalEncounter.upsert({
        where: { id: encounter.id },
        update: data,
        create: { id: encounterId, ...data },
      });
    }

    // Seed procedure lifecycle timestamps as UTC instants and retain stable demo IDs.
    for (const procedure of seedClinicalProcedures) {
      const data = {
        ...procedure,
        performedAt: procedure.performedAt ? new Date(procedure.performedAt) : null,
        finalizedAt: procedure.finalizedAt ? new Date(procedure.finalizedAt) : null,
        voidedAt: procedure.voidedAt ? new Date(procedure.voidedAt) : null,
      };
      await transaction.clinicalProcedure.upsert({
        where: { id: procedure.id },
        update: data,
        create: data,
      });
    }

    // Surgery details stay subordinate to their parent procedure and have no separate lifecycle.
    for (const detail of seedClinicalSurgeryDetails) {
      const data = {
        ...detail,
        assistantDisplayNameSnapshot: detail.assistantDisplayNameSnapshot ?? null,
        assistantMembershipId: detail.assistantMembershipId ?? null,
        surgicalArea: detail.surgicalArea ?? null,
        surgicalSide: detail.surgicalSide ?? null,
        bleedingNotes: detail.bleedingNotes ?? null,
        closureNotes: detail.closureNotes ?? null,
      };
      await transaction.clinicalSurgeryDetail.upsert({
        where: { id: detail.id },
        update: data,
        create: data,
      });
    }

    for (const anesthesia of seedAnesthesiaRecords) {
      const {
        id: anesthesiaId,
        startedAt,
        endedAt,
        finalizedAt,
        voidedAt,
        ...anesthesiaFields
      } = anesthesia;
      const data = {
        ...anesthesiaFields,
        startedAt: startedAt ? new Date(startedAt) : null,
        endedAt: endedAt ? new Date(endedAt) : null,
        finalizedAt: finalizedAt ? new Date(finalizedAt) : null,
        voidedAt: voidedAt ? new Date(voidedAt) : null,
      };
      await transaction.anesthesiaRecord.upsert({
        where: { id: anesthesia.id },
        update: data,
        create: { id: anesthesiaId, ...data },
      });
    }

    for (const observation of seedAnesthesiaObservations) {
      const { id: observationId, observedAt, ...observationFields } = observation;
      const data = {
        ...observationFields,
        observedAt: new Date(observedAt),
      };
      await transaction.anesthesiaObservation.upsert({
        where: { id: observation.id },
        update: data,
        create: { id: observationId, ...data },
      });
    }

    for (const prescription of seedPrescriptions) {
      const { id: prescriptionId, finalizedAt, voidedAt, ...prescriptionFields } = prescription;
      const data = {
        ...prescriptionFields,
        finalizedAt: finalizedAt ? new Date(finalizedAt) : null,
        voidedAt: voidedAt ? new Date(voidedAt) : null,
      };
      await transaction.prescription.upsert({
        where: { id: prescription.id },
        update: data,
        create: { id: prescriptionId, ...data },
      });
    }

    for (const item of seedPrescriptionItems) {
      await transaction.prescriptionItem.upsert({
        where: { id: item.id },
        update: { ...item },
        create: { ...item },
      });
    }

    for (const vaccination of seedVaccinations) {
      const {
        id: vaccinationId,
        administeredOn,
        nextDueOn,
        expiryOn,
        finalizedAt,
        voidedAt,
        ...vaccinationFields
      } = vaccination;
      const data = {
        ...vaccinationFields,
        administeredOn: administeredOn ? new Date(`${administeredOn}T00:00:00.000Z`) : null,
        nextDueOn: nextDueOn ? new Date(`${nextDueOn}T00:00:00.000Z`) : null,
        expiryOn: expiryOn ? new Date(`${expiryOn}T00:00:00.000Z`) : null,
        finalizedAt: finalizedAt ? new Date(finalizedAt) : null,
        voidedAt: voidedAt ? new Date(voidedAt) : null,
      };
      await transaction.vaccination.upsert({
        where: { id: vaccination.id },
        update: data,
        create: { id: vaccinationId, ...data },
      });
    }

    for (const deworming of seedDewormings) {
      const {
        id: dewormingId,
        administeredOn,
        nextDueOn,
        finalizedAt,
        voidedAt,
        ...dewormingFields
      } = deworming;
      const data = {
        ...dewormingFields,
        administeredOn: administeredOn ? new Date(`${administeredOn}T00:00:00.000Z`) : null,
        nextDueOn: nextDueOn ? new Date(`${nextDueOn}T00:00:00.000Z`) : null,
        finalizedAt: finalizedAt ? new Date(finalizedAt) : null,
        voidedAt: voidedAt ? new Date(voidedAt) : null,
      };
      await transaction.deworming.upsert({
        where: { id: deworming.id },
        update: data,
        create: { id: dewormingId, ...data },
      });
    }

    for (const vital of seedVitalMeasurements) {
      const { id: vitalId, ...vitalFields } = vital;
      await transaction.vitalMeasurement.upsert({
        where: { id: vital.id },
        update: { ...vitalFields, measuredAt: new Date(vital.measuredAt) },
        create: { id: vitalId, ...vitalFields, measuredAt: new Date(vital.measuredAt) },
      });
    }

    for (const evolution of seedClinicalEvolutions) {
      const { id: evolutionId, ...evolutionFields } = evolution;
      await transaction.clinicalEvolution.upsert({
        where: { id: evolution.id },
        update: { ...evolutionFields, occurredAt: new Date(evolution.occurredAt) },
        create: {
          id: evolutionId,
          ...evolutionFields,
          occurredAt: new Date(evolution.occurredAt),
        },
      });
    }

    // Seed hospitalization status dates as UTC instants while preserving stable episode identifiers.
    for (const hospitalization of seedHospitalizations) {
      const dateFields = ['admittedAt', 'dischargedAt', 'activatedAt', 'voidedAt'];
      const data = { ...hospitalization };
      for (const field of dateFields) {
        const value = data[field];
        data[field] = value ? new Date(value) : null;
      }
      await transaction.hospitalization.upsert({
        where: { id: hospitalization.id },
        update: data,
        create: data,
      });
    }

    // Seed immutable Kardex entries; draft records intentionally have none until activation.
    for (const entry of seedHospitalizationEntries) {
      const data = { ...entry, recordedAt: new Date(entry.recordedAt) };
      await transaction.hospitalizationEntry.upsert({
        where: { id: entry.id },
        update: data,
        create: data,
      });
    }

    for (const audit of seedClinicalAuditEvents) {
      const { id: auditId, ...auditFields } = audit;
      await transaction.clinicalAuditEvent.upsert({
        where: { id: audit.id },
        update: { ...auditFields },
        create: { id: auditId, ...auditFields },
      });
    }
  });

  console.log(
    'Development seed applied: 2 organizations, 2 locations, 3 users, 4 memberships, 4 owners, 6 patients, 3 availability rules, 6 appointments, 2 profiles, 2 records, 4 encounters, 5 procedures, 2 surgery details, 3 anesthesia records, 3 anesthesia observations, 3 prescriptions, 3 items, 2 vaccinations, 3 dewormings, 2 vitals, 1 evolution, 4 hospitalizations, 2 Kardex entries, 33 audits.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
