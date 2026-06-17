import tl = require('azure-pipelines-task-lib/task');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';

export function renderHelmTemplates(helmFolderPath: string, templatesPath: string, valuesPath: string): string {
    const tempChartDir = path.join(os.tmpdir(), `helm-chart-${Date.now()}`);
    fs.mkdirSync(tempChartDir, { recursive: true });

    try {
        if (!fs.existsSync(path.join(helmFolderPath, 'Chart.yaml'))) {
            throw new Error(`Chart.yaml not found at: ${helmFolderPath}`);
        }

        fs.cpSync(helmFolderPath, tempChartDir, { recursive: true });
        fs.cpSync(templatesPath, path.join(tempChartDir, 'templates'), { recursive: true });

        const outDir = tl.getVariable('Agent.TempDirectory') ?? os.tmpdir();
        const renderedManifestPath = path.join(outDir, `helm-rendered-${Date.now()}.yaml`);

        let cmd = `helm template release "${tempChartDir}"`;
        for (const f of valuesPath.split(',').map(s => s.trim()).filter(Boolean)) {
            console.log(`Using Helm values file: ${f}`);
            cmd += ` --values "${f}"`;
        }
        cmd += ` > "${renderedManifestPath}"`;

        console.log('Rendering Helm templates...');
        const shell = process.platform === 'win32' ? (process.env['ComSpec'] ?? 'cmd.exe') : '/bin/sh';
        try {
            execSync(cmd, {shell, maxBuffer: 20 * 1024 * 1024 });
        } catch (e: any) {
            if (!fs.existsSync(renderedManifestPath) || fs.statSync(renderedManifestPath).size === 0) {
                throw new Error(`helm template failed: ${e.message}`);
            }
        }

        return renderedManifestPath;
    } finally {
        fs.rmSync(tempChartDir, { recursive: true, force: true });
    }
}
