// The shared libraries (@lib/*) are the t monorepo's lib/ (postviewer, socialspec, follow), next to
// this repository: ../../t/lib. See README.md.
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', isolatedModules: true } }] },
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/../../t/lib/$1',
    '^dompurify$': '<rootDir>/../../t/lib/postviewer/node_modules/dompurify',
  },
};
