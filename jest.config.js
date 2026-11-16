// The shared libraries (@lib/*: postviewer, socialspec, follow) are bigwide-net/lib, checked out
// next to this repository (../lib). See README.md.
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', isolatedModules: true } }] },
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/../lib/$1',
    '^dompurify$': '<rootDir>/../lib/node_modules/dompurify',
  },
};
