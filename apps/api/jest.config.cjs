module.exports = {
  // SWC keeps the TypeScript test transform fast and avoids the legacy ts-jest dependency tree.
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  // Transform TypeScript tests to CommonJS; the API package is CommonJS and Jest runs in Node.
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
          target: 'es2022',
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts'],
};
