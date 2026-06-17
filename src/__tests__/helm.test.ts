import * as path from 'path';
import * as os from 'os';

jest.mock('child_process', () => ({ execSync: jest.fn() }));
jest.mock('azure-pipelines-task-lib/task', () => ({ getVariable: jest.fn() }));
jest.mock('fs', () => ({
    mkdirSync: jest.fn(),
    existsSync: jest.fn(),
    cpSync: jest.fn(),
    statSync: jest.fn(),
    rmSync: jest.fn(),
}));

import { execSync } from 'child_process';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import { renderHelmTemplates } from '../helm';

const mockExecSync = execSync as jest.Mock;
const mockGetVariable = tl.getVariable as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;
const mockStatSync = fs.statSync as jest.Mock;

const HELM_REPO = '/helm/repo';
const TEMPLATES_PATH = '/my/templates';
const VALUES_PATH = '/my/values.yaml';

beforeEach(() => {
    jest.clearAllMocks();
    mockGetVariable.mockReturnValue(undefined);
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 1024 });
    mockExecSync.mockReturnValue('');
});

describe('renderHelmTemplates', () => {
    it('returns the rendered manifest path on success', () => {
        const result = renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, VALUES_PATH);
        expect(result).toContain('helm-rendered-');
        expect(result).toContain('.yaml');
    });

    it('uses Agent.TempDirectory when available', () => {
        mockGetVariable.mockReturnValue('/agent/temp');
        const result = renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, '');
        expect(result).toContain(path.normalize('/agent/temp'));
    });

    it('falls back to os.tmpdir when Agent.TempDirectory is not set', () => {
        mockGetVariable.mockReturnValue(undefined);
        const result = renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, '');
        expect(result).toContain(os.tmpdir());
    });

    it('throws when Chart.yaml is missing', () => {
        mockExistsSync.mockImplementation((p: string) => !p.endsWith('Chart.yaml'));
        expect(() => renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, VALUES_PATH))
            .toThrow('Chart.yaml not found');
    });

    it('includes --values flag for each comma-separated values file', () => {
        renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, '/v1.yaml,/v2.yaml');
        const cmd = mockExecSync.mock.calls[0][0] as string;
        expect(cmd).toContain('--values "/v1.yaml"');
        expect(cmd).toContain('--values "/v2.yaml"');
    });

    it('ignores blank entries in the values path', () => {
        renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, '/v1.yaml, , /v2.yaml');
        const cmd = mockExecSync.mock.calls[0][0] as string;
        expect((cmd.match(/--values/g) ?? []).length).toBe(2);
    });

    it('throws when helm template fails and output file is missing', () => {
        mockExecSync.mockImplementation(() => { throw new Error('helm not found'); });
        mockExistsSync.mockImplementation((p: string) => !p.includes('helm-rendered-'));
        expect(() => renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, VALUES_PATH))
            .toThrow('helm template failed');
    });

    it('succeeds when helm exits non-zero but the output file has content', () => {
        mockExecSync.mockImplementation(() => { throw new Error('non-zero exit'); });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ size: 512 });
        const result = renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, VALUES_PATH);
        expect(result).toContain('.yaml');
    });

    it('always cleans up the temp chart directory', () => {
        renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, VALUES_PATH);
        expect(fs.rmSync).toHaveBeenCalledWith(expect.stringContaining('helm-chart-'), { recursive: true, force: true });
    });

    it('cleans up temp directory even when an error is thrown', () => {
        mockExistsSync.mockImplementation((p: string) => !p.endsWith('Chart.yaml'));
        expect(() => renderHelmTemplates(HELM_REPO, TEMPLATES_PATH, VALUES_PATH)).toThrow();
        expect(fs.rmSync).toHaveBeenCalledWith(expect.stringContaining('helm-chart-'), { recursive: true, force: true });
    });
});
