import * as path from 'path';
import * as fs from 'fs';
import { CheckovCheck, CheckovResults } from './types';
import { mergeResults } from './checkov';

const reportStyles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

function escapeHtml(s: string | undefined | null): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function checkRow(check: CheckovCheck, status: 'passed' | 'failed'): string {
    const relFile = check.repo_file_path || check.file_path;
    const badge = status === 'passed'
        ? '<span class="badge-pass">PASS</span>'
        : '<span class="badge-fail">FAIL</span>';
    const guidelineCell = (status === 'failed' && check.guideline)
        ? `<a href="${escapeHtml(check.guideline)}" target="_blank" rel="noopener">docs</a>`
        : '—';
    return `
      <tr>
      <td>${badge}</td>
      <td class="mono">${escapeHtml(check.check_id)}</td>
      <td>${escapeHtml(check.resource)}</td>
      <td class="mono small">${escapeHtml(relFile)}</td>
      <td>${escapeHtml(check.check_name)}</td>
      <td>${guidelineCell}</td>
    </tr>`;
}

function sectionHtml(title: string, results: CheckovResults | null): string {
    if (!results) {
        return `<section><h2>${title}</h2><p class="muted">No files found to scan.</p></section>`;
    }
    const { passed_checks, failed_checks } = results.results;
    const { passed, failed } = results.summary;
    const rows = [
        ...failed_checks.map(c => checkRow(c, 'failed')),
        ...passed_checks.map(c => checkRow(c, 'passed')),
    ].join('\n');
    return `
      <section>
      <h2>${title}</h2>
      <div class="pills">
        <span class="pill-fail">${failed} Failed</span>
        <span class="pill-pass">${passed} Passed</span>
      </div>
      <table>
        <thead><tr>
          <th>Status</th><th>Check ID</th><th>Resource</th><th>File</th><th>Description</th><th>Guideline</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

export function generateHTML(k8s: CheckovResults | null, helmResults: CheckovResults | null, docker: CheckovResults | null, repoPath: string): string {
    const totalFailed = (helmResults?.summary.failed ?? 0) + (k8s?.summary.failed ?? 0) + (docker?.summary.failed ?? 0);
    const totalPassed = (helmResults?.summary.passed ?? 0) + (k8s?.summary.passed ?? 0) + (docker?.summary.passed ?? 0);
    const scanTime = new Date().toUTCString();
    const kubeInputs = [k8s, helmResults].filter((r): r is CheckovResults => r !== null);
    const combinedK8s = kubeInputs.length > 0 ? mergeResults(kubeInputs) : null;
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8">
      <title>KubeDock Security Scan</title>
      <style>${reportStyles}</style>
      </head>
      <body>
      <h1>KubeDock Security Scan Report</h1>
      <p class="meta">Scanned: ${escapeHtml(scanTime)} &nbsp;|&nbsp; Path: ${escapeHtml(repoPath)}</p>

        <div class="totals">
          <div class="card fail"><div class="n">${totalFailed}</div><div class="l">Total Failed</div></div>
          <div class="card pass"><div class="n">${totalPassed}</div><div class="l">Total Passed</div></div>
        </div>

        ${sectionHtml('Kubernetes Manifests', combinedK8s)}
        ${sectionHtml('Dockerfiles', docker)}

      </body>
      </html>`;
}
