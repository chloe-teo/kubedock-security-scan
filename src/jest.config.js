module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: [
        '*.ts',
        '!*.test.ts',
        '!dist/**'
    ]
}