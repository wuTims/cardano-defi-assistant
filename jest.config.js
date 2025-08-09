const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/', // Exclude Playwright E2E tests
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/*', // Exclude Next.js app pages
    '!src/components/**/*', // Exclude React components (covered by E2E tests)
    '!src/context/**/*', // Exclude React contexts (covered by E2E tests)
    '!src/lib/utils.ts', // Exclude Next.js utils
    '!src/**/__tests__/**', // Exclude test files
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  testTimeout: 10000
}

module.exports = createJestConfig(customJestConfig)