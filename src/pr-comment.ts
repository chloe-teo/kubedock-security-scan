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

const MARKER = '<!-- kubedock-scan -->';

function buildConsolidatedComment(failedChecks: CheckovCheck[]): string {
    const rows = failedChecks.map(check => {
        const file = check.repo_file_path || check.file_path;
        const lines = check.file_line_range ? `${check.file_line_range[0]}–${check.file_line_range[1]}` : '—';
        const missingField = check.check_result?.evaluated_keys?.[0] ?? '—';
        const guideline = check.guideline ? `[docs](${check.guideline})` : '—';
        return `| \`${check.check_id}\` | ${check.check_name} | \`${check.resource}\` | \`${file}\` | ${lines} | \`${missingField}\` | ${guideline} |`;
    });

    return [
        MARKER,
        `## :x: KubeDock Security Scan — ${failedChecks.length} violation(s) found`,
        ``,
        `| Check | Description | Resource | File | Lines | Missing Field | Guideline |`,
        `|---|---|---|---|---|---|---|`,
        ...rows,
    ].join('\n');
}

function adoRequest(method: string, path: string, token: string, hostname: string, body?: string): Promise<string> {
    const payload = body ?? '';
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${token}`,
                'Content-Length': Buffer.byteLength(payload),
            },
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`ADO API returned ${res.statusCode}`));
                } else {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function findExistingThread(opts: PrCommentOptions, base: URL, token: string): Promise<{ threadId: number; commentId: number } | null> {
    const path = `/${opts.project}/_apis/git/repositories/${opts.repositoryId}/pullRequests/${opts.pullRequestId}/threads?api-version=7.1`;
    const raw = await adoRequest('GET', base.pathname.replace(/\/$/, '') + path, token, base.hostname);
    const data = JSON.parse(raw);
    for (const thread of data.value ?? []) {
        const first = thread.comments?.[0];
        if (first?.content?.includes(MARKER)) {
            return { threadId: thread.id, commentId: first.id };
        }
    }
    return null;
}

async function upsertThread(content: string, opts: PrCommentOptions): Promise<void> {
    if (opts.dryRun) {
        console.log(`[dry-run] PR comment:\n${content}`);
        return;
    }

    const base = new URL(opts.collectionUri);
    const token = Buffer.from(`:${opts.accessToken}`).toString('base64');
    const basePath = base.pathname.replace(/\/$/, '');

    const existing = await findExistingThread(opts, base, token);

    if (existing) {
        const patchPath = `${basePath}/${opts.project}/_apis/git/repositories/${opts.repositoryId}/pullRequests/${opts.pullRequestId}/threads/${existing.threadId}/comments/${existing.commentId}?api-version=7.1`;
        await adoRequest('PATCH', patchPath, token, base.hostname, JSON.stringify({ content }));
    } else {
        const postPath = `${basePath}/${opts.project}/_apis/git/repositories/${opts.repositoryId}/pullRequests/${opts.pullRequestId}/threads?api-version=7.1`;
        await adoRequest('POST', postPath, token, base.hostname, JSON.stringify({
            comments: [{ parentCommentId: 0, content, commentType: 1 }],
            status: 1,
        }));
    }
}

export async function postPrComments(failedChecks: CheckovCheck[], opts: PrCommentOptions): Promise<void> {
    if (failedChecks.length === 0) return;
    const content = buildConsolidatedComment(failedChecks);
    try {
        await upsertThread(content, opts);
    } catch (e: any) {
        console.warn(`Failed to post PR comment: ${e.message}`);
    }
}