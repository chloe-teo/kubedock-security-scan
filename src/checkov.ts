import { execSync, spawnSync } from 'child_process';
import { CheckovResults } from './types';

function emptyResults(): CheckovResults {
    return {
        results: { passed_checks: [], failed_checks: [], skipped_checks: [] },
        summary: { passed: 0, failed: 0, skipped: 0 }
    };
}

export function mergeResults(list: CheckovResults[]): CheckovResults {
    return list.reduce((acc, cur) => ({
        results: {
            passed_checks: [...acc.results.passed_checks, ...(cur.results?.passed_checks ?? [])],
            failed_checks: [...acc.results.failed_checks, ...(cur.results?.failed_checks ?? [])],
            skipped_checks: [...acc.results.skipped_checks, ...(cur.results?.skipped_checks ?? [])],
        },
        summary: {
            passed: acc.summary.passed + (cur.summary?.passed ?? 0),
            failed: acc.summary.failed + (cur.summary?.failed ?? 0),
            skipped: acc.summary.skipped + (cur.summary?.skipped ?? 0),
        }
    }), emptyResults());
}

function extractJson(raw: string): any {
    const start = raw.search(/[{[]/);
    if (start === -1) return null;
    try {
        return JSON.parse(raw.slice(start));
    } catch {
        return null;
    }
}

export function installCheckov(): void {
    console.log('Installing Checkov...');
    const result = spawnSync('pip', ['install', 'checkov'], { stdio: 'inherit', shell: true });
    if (result.status !== 0) {
        throw new Error('Failed to install Checkov. Ensure Python and pip are available in PATH.');
    }
}

export function runCheckov(repoPath: string, framework: string, configFile?: string, externalChecksDir?: string, manifestFile?: string): CheckovResults | null {
    console.log(`Scanning ${framework} files in: ${manifestFile ?? repoPath}`);

    const target = manifestFile ?? repoPath;
    const quoted = `"${target.replace(/"/g, '\\"')}"`;
    const flag = manifestFile ? '-f' : '-d';
    let cmd = `checkov ${flag} ${quoted} --framework ${framework} --output json --soft-fail`;
    if (configFile) cmd += ` --config-file "${configFile}"`;
    if (externalChecksDir) cmd += ` --external-checks-dir "${externalChecksDir}"`;

    const shell = process.platform === 'win32' ? (process.env['ComSpec'] ?? 'cmd.exe') : '/bin/sh';

    let raw = '';
    try {
        raw = execSync(cmd, { encoding: 'utf8', shell, maxBuffer: 20 * 1024 * 1024 });
    } catch (e: any) {
        // Checkov exits non-zero on parse errors even with --soft-fail; stdout still has JSON.
        raw = e.stdout ?? '';
    }

    raw = raw.trim();
    if (!raw) {
        console.log(`No output from Checkov for framework: ${framework}`);
        return null;
    }

    const parsed = extractJson(raw);
    if (!parsed || !parsed.results || !parsed.summary) {
        console.error(`No valid scan results from Checkov for framework: ${framework}`);
        return null;
    }

    return Array.isArray(parsed) ? mergeResults(parsed) : (parsed as CheckovResults);
}
