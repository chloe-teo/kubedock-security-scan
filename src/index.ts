import tl = require('azure-pipelines-task-lib/task');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CheckovResults } from './types';
import { installCheckov, runCheckov } from './checkov';
import { renderHelmTemplates } from './helm';
import { generateHTML } from './report';

export async function run() {
    try {
        const repoPath: string = tl.getInput('repoPath', true)!;
        const failOnIssues: boolean = tl.getBoolInput('failOnIssues', false) ?? true;
        const policyRepoPath: string = tl.getInput('policyRepoPath', false) ?? '';
        const helmFolderPath: string = tl.getInput('helmFolderPath', false) ?? '';
        const helmTemplatesPath: string = tl.getInput('helmTemplatesPath', false) ?? '';
        const helmValuesPaths: string = tl.getInput('helmValuesPaths', false) ?? '';
        const resolved = path.resolve(repoPath);

        if (!fs.existsSync(resolved)) {
            tl.setResult(tl.TaskResult.Failed, `Repository path not found: ${resolved}`);
            return;
        }

        let resolvedHelmFolderPath = '';
        if (helmFolderPath !== '') {
            resolvedHelmFolderPath = path.resolve(helmFolderPath);
            if (!fs.existsSync(resolvedHelmFolderPath)) {
                throw new Error(`Helm repo path not found: ${resolvedHelmFolderPath}`);
            }
        }

        let resolvedHelmTemplatesPath = '';
        if (helmTemplatesPath !== '') {
            resolvedHelmTemplatesPath = path.resolve(helmTemplatesPath);
            if (!fs.existsSync(resolvedHelmTemplatesPath)) {
                throw new Error(`Helm templates path not found: ${resolvedHelmTemplatesPath}`);
            }
        }

        try {
            const policyDir = policyRepoPath ? path.resolve(policyRepoPath) : undefined;
            if (policyDir && !fs.existsSync(policyDir)) {
                throw new Error(`Policy repo path not found: ${policyDir}`);
            }

            installCheckov();
            const configFile = policyDir ? path.join(policyDir, 'checkov-policy.yaml') : undefined;
            const checksDir = policyDir ? path.join(policyDir, 'custom-checks') : undefined;

            const k8sResults = runCheckov(resolved, 'kubernetes', configFile, checksDir);
            const dockerResults = runCheckov(resolved, 'dockerfile', configFile, checksDir);

            let helmResults: CheckovResults | null;

            if (resolvedHelmTemplatesPath !== '') {
                if (resolvedHelmFolderPath === '') {
                    throw new Error('helmFolderPath is required when helmTemplatesPath is provided');
                }
                const renderedManifestPath = renderHelmTemplates(resolvedHelmFolderPath, resolvedHelmTemplatesPath, helmValuesPaths);
                helmResults = runCheckov(resolved, 'kubernetes', configFile, checksDir, renderedManifestPath);
            } else {
                helmResults = runCheckov(resolved, 'helm', configFile, checksDir);
            }

            const html = generateHTML(k8sResults, helmResults, dockerResults, resolved);

            const tempDir = tl.getVariable('Agent.TempDirectory') ?? os.tmpdir();
            const reportPath = path.join(tempDir, 'kubedockscan-report.html');
            fs.writeFileSync(reportPath, html, 'utf8');
            console.log(`Report saved: ${reportPath}`);

            tl.command('task.addattachment', { type: 'Distributedtask.Core.Summary', name: 'KubeDock Security Scan' }, reportPath);

            const totalFailed = (helmResults?.summary.failed ?? 0) + (k8sResults?.summary.failed ?? 0) + (dockerResults?.summary.failed ?? 0);
            if (totalFailed > 0) {
                const message = `KubeDock Security Scan task found ${totalFailed} security issue(s). See the "KubeDock Scan" tab for details.`;
                tl.setResult(failOnIssues ? tl.TaskResult.Failed : tl.TaskResult.SucceededWithIssues, message);
            } else {
                tl.setResult(tl.TaskResult.Succeeded, 'All KubeDock Security Scan checks passed.');
            }
        } catch (e: any) {
            throw new Error(`Failed to run the checking, the error message is (${e.message})`);
        }
    } catch (e: any) {
        tl.setResult(tl.TaskResult.Failed, e.message);
    }
}

if (require.main === module) {
    run();
}
