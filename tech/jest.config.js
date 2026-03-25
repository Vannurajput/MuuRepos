/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/main/credentialStore.js',
    'src/main/connectors/helpers/connectionOptions.js'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['html', 'lcov', 'text-summary'],
  moduleNameMapper: {
    '^electron$': '<rootDir>/test/__mocks__/electron.js',
    '^keytar$': '<rootDir>/test/__mocks__/keytar.js',
    '^../logger$': '<rootDir>/test/__mocks__/logger.js',
    '^../../logger$': '<rootDir>/test/__mocks__/logger.js'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  coverageThreshold: {
    global: {
      statements: 3,
      branches: 2,
      functions: 2,
      lines: 3
    }
  }
};
