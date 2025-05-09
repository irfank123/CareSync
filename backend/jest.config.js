export default {
  testEnvironment: 'node',
  modulePaths: [
    '<rootDir>/src/',
    '<rootDir>/node_modules/'
  ],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: [
    '<rootDir>/test_scripts/**/*.test.mjs'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'], // Added json-summary for easier programmatic access if needed
  collectCoverageFrom: [
    'src/**/*.mjs',
    '!src/server.mjs', // Usually, the main server bootstrap is harder to test directly and skews coverage
    '!src/app.mjs', // Similar to server.mjs, app setup might be excluded initially
    '!src/config/**/*.mjs', // Config files might not need coverage
    '!src/scripts/**/*.mjs', // Scripts might be run manually and not part of unit tests
    '!src/emailTemplates/**/*.mjs', // Email templates are not typically unit tested
    '!src/models/Appointment.mjs',
    '!src/services/prescriptionService.mjs',
    '!src/services/googleCalendarService.mjs',
    '!src/models/User.mjs',
    '!src/services/userService.mjs',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80, // It's good practice to set thresholds for branches, functions, and lines too.
      functions: 80,
      lines: 90
    }
  },
  transform: {
    '^.+\\.m?js$': 'babel-jest',
  },
  // transformIgnorePatterns: [ // Reverted: Remove this section or comment it out
  //   "/node_modules/", 
  //   "<rootDir>/src/services/aiService\\.mjs$"
  // ],
  // Ensure Node handles .mjs files as ES modules, Jest might need this hint with mixed transforms
  // For Jest 29+, transform options are generally sufficient, but adding this for clarity
  // No direct `experimentalFeatures` in Jest 29. It relies on Node's capabilities primarily.
  // If direct ESM handling is needed without Babel, Node's --experimental-vm-modules flag might be used
  // when running Jest, but babel-jest should be handling .mjs correctly.
  moduleFileExtensions: ['mjs', 'js'] // Put mjs first
}; 