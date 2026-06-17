import {mergeResults} from '../checkov';
import { CheckovResults } from '../types';
import { execSync } from 'child_process';
import { runCheckov } from '../checkov';

const makeCheck = (id: string) => ({
    check_id : id,
    check_name : '',
    resource: '',
    file_path: '',
    repo_file_path: '',
});

jest.mock('child_process', () => ({
    execSync: jest.fn(),
    spawnSync: jest.fn()
}));

const mockExecSync = execSync as jest.Mock;

describe('mergeResults', () => {
    it('merge empty list into zero counts', () => {
        const result = mergeResults([]);
        expect(result.summary).toEqual({passed: 0, failed: 0, skipped: 0});
    });

    it('sums passed/failed/skipped across results', () => {
        const result1 : CheckovResults = {
            results: {
                passed_checks:[makeCheck('CKV_1')],
                failed_checks:[makeCheck('CKV_2')],
                skipped_checks:[]
            },
            summary: {passed: 1, failed: 1, skipped: 0}
        }

        const result2 : CheckovResults = {
            results: {
                passed_checks:[],
                failed_checks:[makeCheck('CKV_4')],
                skipped_checks:[]
            },
            summary: {passed: 0, failed: 1, skipped: 0}
        }
        const result = mergeResults([result1, result2]);
        expect(result.summary).toEqual({passed: 1, failed: 2, skipped: 0});
        expect(result.results.passed_checks.length).toEqual(1);
        expect(result.results.failed_checks.length).toEqual(2);
    })
});


describe('runCheckov', () =>{
    it('returns null when checkov produces no output', () =>{
        mockExecSync.mockReturnValue('');
        const result = runCheckov('/some/path', 'kubernetes');
        expect(result).toBeNull();
    });

    it('parses valid JSON output' , () =>{
        const fakeOutput = JSON.stringify({
            results: { passed_checks: [{
                check_id: 'CKV_1',
                file_path: '/some/path',
            }], failed_checks: [], skipped_checks: [] },
            summary: { passed: 1, failed: 0, skipped: 0 }
        });
        mockExecSync.mockReturnValue(fakeOutput);
        const result = runCheckov('/some/path', 'kubernetes');
        expect(result).toEqual({
            results: {
                passed_checks: [{
                    check_id: 'CKV_1',
                    file_path: '/some/path',
                }],
                failed_checks: [],
                skipped_checks: []
            },
            summary: { passed: 1, failed: 0, skipped: 0 }
        });
    });

    it('returns null when output is not valid JSON', () =>{
        mockExecSync.mockReturnValue('some non-json output');
        const result = runCheckov('/some/path', 'kubernetes');
        expect(result).toBeNull();
    });
})