// Tests use safe local placeholders and never read production credentials.
process.env.NODE_ENV = 'test';
process.env.API_PORT = '3000';
process.env.DATABASE_URL =
  'postgresql://veterinary:veterinary_dev_only@localhost:5432/veterinary_saas';
process.env.APP_ORIGIN = 'http://localhost:5173';
