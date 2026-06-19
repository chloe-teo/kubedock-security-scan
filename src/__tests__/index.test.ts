jest.mock('azure-pipelines-task-lib/task', () => ({
    getInput: jest.fn(),
    getBoolInput: jest.fn(),
    getVariable: jest.fn(),
    setResult: jest.fn(),
    command: jest.fn(),
    TaskResult: { Succeeded: 0, SucceededWithIssues: 1, Failed: 2 }
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

jest.mock('../checkov', () => ({
    installCheckov: jest.fn(),
    runCheckov: jest.fn(),
}));

jest.mock('../helm', () => ({
    renderHelmTemplates: jest.fn(),
}));

jest.mock('../report', () => ({
    generateHTML: jest.fn(),
}));

import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import { runCheckov } from '../checkov';
import { renderHelmTemplates } from '../helm';
import { generateHTML } from '../report';
import { run } from '../index';

const mockGetInput = tl.getInput as jest.Mock;
const mockGetBoolInput = tl.getBoolInput as jest.Mock;
const mockSetResult = tl.setResult as jest.Mock;
const mockGetVariable = tl.getVariable as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;
const mockRunCheckov = runCheckov as jest.Mock;
const mockRenderHelmTemplates = renderHelmTemplates as jest.Mock;
const mockGenerateHTML = generateHTML as jest.Mock;

const noResults = {
    results: { passed_checks: [], failed_checks: [], skipped_checks: [] },
    summary: { passed: 0, failed: 0, skipped: 0 }
};

beforeEach(() => {
    jest.clearAllMocks();
    mockGetInput.mockImplementation((name: string) => {
        if (name === 'repoPath') return '/repo';
        return '';
    });
    mockGetVariable.mockReturnValue(undefined);
    mockGetBoolInput.mockReturnValue(true);
    mockExistsSync.mockReturnValue(true);
    mockRunCheckov.mockReturnValue(noResults);
    mockGenerateHTML.mockReturnValue('<html></html>');
});

describe('run', () => {
    it('sets result to failed when repoPath does not exist', async () => {
        mockExistsSync.mockReturnValue(false);
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining('Repository path not found'));
    });

    it('sets result to failed when helmFolderPath does not exist', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'repoPath') return '/repo';
            if (name === 'helmFolderPath') return '/helm/repo';
            return '';
        });
        mockExistsSync
            .mockReturnValueOnce(true)   // repoPath
            .mockReturnValueOnce(false); // helmFolderPath
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining('Helm repo path not found'));
    });

    it('sets result to failed when helmTemplatesPath does not exist', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'repoPath') return '/repo';
            if (name === 'helmTemplatesPath') return '/templates';
            return '';
        });
        mockExistsSync
            .mockReturnValueOnce(true)   // repoPath
            .mockReturnValueOnce(false); // helmTemplatesPath
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining('Helm templates path not found'));
    });

    it('sets result to failed when policyRepoPath does not exist', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'repoPath') return '/repo';
            if (name === 'policyRepoPath') return '/policy';
            return '';
        });
        mockExistsSync
            .mockReturnValueOnce(true)   // repoPath
            .mockReturnValueOnce(false); // policyDir
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining('Policy repo path not found'));
    });

    it('sets result to failed when helmTemplatesPath provided without helmFolderPath', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'repoPath') return '/repo';
            if (name === 'helmTemplatesPath') return '/templates';
            return '';
        });
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining('helmFolderPath is required'));
    });

    it('runs checkov with helm framework when no helmTemplatesPath provided', async () => {
        await run();
        expect(mockRunCheckov).toHaveBeenCalledWith(expect.any(String), 'helm', undefined, undefined);
    });

    it('calls renderHelmTemplates and scans rendered manifest when helmTemplatesPath provided', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'repoPath') return '/repo';
            if (name === 'helmFolderPath') return '/helm/repo';
            if (name === 'helmTemplatesPath') return '/templates';
            return '';
        });
        mockRenderHelmTemplates.mockReturnValue('/tmp/rendered.yaml');
        await run();
        expect(mockRenderHelmTemplates).toHaveBeenCalled();
        expect(mockRunCheckov).toHaveBeenCalledWith(expect.any(String), 'kubernetes', undefined, undefined, '/tmp/rendered.yaml');
    });

    it('sets result to succeeded when no failures found', async () => {
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Succeeded, 'All KubeDock Security Scan checks passed.');
    });

    it('fails the pipeline when failOnIssues is true and issues are found', async () => {
        const withFailures = { ...noResults, summary: { passed: 0, failed: 3, skipped: 0 } };
        mockRunCheckov.mockReturnValue(withFailures);
        mockGetBoolInput.mockReturnValue(true);
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining('9 security issue'));
    });

    it('warns instead of failing when failOnIssues is false and issues are found', async () => {
        const withFailures = { ...noResults, summary: { passed: 0, failed: 3, skipped: 0 } };
        mockRunCheckov.mockReturnValue(withFailures);
        mockGetBoolInput.mockReturnValue(false);
        await run();
        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.SucceededWithIssues, expect.stringContaining('9 security issue'));
    });

    it('writes the HTML report to a file', async () => {
        await run();
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('kubedockscan-report.html'),
            '<html></html>',
            'utf8'
        );
    });
});
