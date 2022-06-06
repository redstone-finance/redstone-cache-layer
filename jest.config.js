module.exports = {
  preset: 'ts-jest',
	testEnvironment: 'node',
  verbose: true,
  testTimeout: 20000,
  testEnvironment: "node",
  modulePathIgnorePatterns: ['./dist'],
  setupFiles: ['./jest.setup.ts']
};
