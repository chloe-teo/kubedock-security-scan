jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readFileSync: jest.fn().mockReturnValue('/* mock styles */'),
}));

import { generateHTML } from '../report';
import { CheckovResults } from '../types';

const makeResults = (passed: number, failed: number): CheckovResults => ({
    results: {
        passed_checks: [],
        failed_checks: [],
        skipped_checks: []},
    summary: { passed, failed, skipped: 0 }
});

describe('generateHTML', () => {
    it('shows total failed count in the output', () => {
        const html = generateHTML(makeResults(3, 2), makeResults(1, 1), makeResults(0, 0), '/repo/path');
        expect(html).toContain('3 Failed');
        expect(html).toContain('/repo');
    })

    it('shows no files message when results are null', () => {
        const html = generateHTML(null, null, null, '/repo/path');
        expect(html).toContain('No files found to scan.');
    })

    it('escapes HTML special chars in repo path', () => {
        const html = generateHTML(null, null, null, '/repo/path/with/<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
})