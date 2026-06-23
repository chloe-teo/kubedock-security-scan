import * as https from 'https';
import {CheckovCheck} from './types';

export interface PrCommentOptions {
    collectionUri: string;
    project: string;
    repositoryId: string;
    pullRequestId: string;
    accessToken: string;
    dryRun?: boolean;
}

export function getPrContext(): PrCommentOptions | null {
    const pullRequestId = process.env['SYSTEM_PULLREQUEST_PULLREQUESTID'];
    if(!pullRequestId)  return null;

    return {
        collectionUri: process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] ?? '',
        project:       process.env['SYSTEM_TEAMPROJECT'] ?? '',
        repositoryId:  process.env['BUILD_REPOSITORY_ID'] ?? '',
        pullRequestId,
        accessToken:   process.env['SYSTEM_ACCESSTOKEN'] ?? '',
    };
}

function buildConsolidatedComment(failedChecks: CheckovCheck[]): string {
    const rows = failedChecks.map(check => {
        const file = check.repo_file_path || check.file_path;
        const lines = check.file_line_range ? `${check.file_line_range[0]}–${check.file_line_range[1]}` : '—';
        const missingField = check.check_result?.evaluated_keys?.[0] ?? '—';
        const guideline = check.guideline ? `[docs](${check.guideline})` : '—';
        return `| \`${check.check_id}\` | ${check.check_name} | \`${check.resource}\` | \`${file}\` | ${lines} | \`${missingField}\` | ${guideline} |`;
    });

    return [
        `## :x: KubeDock Security Scan — ${failedChecks.length} violation(s) found`,
        ``,
        `| Check | Description | Resource | File | Lines | Missing Field | Guideline |`,
        `|---|---|---|---|---|---|---|`,
        ...rows,
    ].join('\n');
}

function postThread(content: string, opts: PrCommentOptions): Promise<void> {
    const payload = JSON.stringify({
        comments: [{ parentCommentId: 0, content, commentType: 1 }],
        status: 1,
    });

    if (opts.dryRun) {
        console.log(`[dry-run] PR comment:\n${content}`);
        return Promise.resolve();
    }

    const base = new URL(opts.collectionUri);
    const path = `/${opts.project}/_apis/git/repositories/${opts.repositoryId}/pullRequests/${opts.pullRequestId}/threads?api-version=7.1`;
    const token = Buffer.from(`:${opts.accessToken}`).toString('base64');

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: base.hostname,
            path: base.pathname.replace(/\/$/, '') + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${token}`,
                'Content-Length': Buffer.byteLength(payload),
            },
        }, res => {
            res.resume();
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`ADO API returned ${res.statusCode}`));
                } else {
                    resolve();
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

export async function postPrComments(failedChecks: CheckovCheck[], opts: PrCommentOptions): Promise<void> {
    if (failedChecks.length === 0) return;
    const content = buildConsolidatedComment(failedChecks);
    try {
        await postThread(content, opts);
    } catch (e: any) {
        console.warn(`Failed to post PR comment: ${e.message}`);
    }
}