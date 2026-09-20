module.exports = {
  // Nest 12 ships ESM packages; Jest runs the CommonJS API tests in Node's ESM VM.
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  extensionsToTreatAsEsm: ['.ts'],
  // Transform TypeScript tests to native ESM so Nest 12's ESM packages load correctly.
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts'],
};
