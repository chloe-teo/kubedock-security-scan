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

function buildCommentBody(check: CheckovCheck): string {
    const file = check.repo_file_path || check.file_path;
    const evaluatedKeys = check.check_result?.evaluated_keys ?? [];
    const rows = [
        `| Check | \`${check.check_id}\` |`,
        `| Description | ${check.check_name} |`,
        `| Resource | \`${check.resource}\` |`,
        `| File | \`${file}\` |`,
    ];
    if (evaluatedKeys.length > 0) {
        rows.push(`| Missing field | \`${evaluatedKeys[0]}\` |`);
    }
    if (check.guideline) {
        rows.push(`| Guideline | ${check.guideline} |`);
    }
    return [
        `**KubeDock Security Scan** — policy violation`,
        ``,
        `| Field | Value |`,
        `|---|---|`,
        ...rows,
    ].join('\n');
}

function postThread(check: CheckovCheck, options: PrCommentOptions): Promise<void>{
    const file = check.repo_file_path || check.file_path;
    const startLine = check.file_line_range?.[0] ?? 1;
    const endLine = check.file_line_range?.[1] ?? startLine;

    const payload = JSON.stringify({
        comments : [{parentCommentId: 0, content: buildCommentBody(check), commentType: 1}],
        status: 1,
        threadContext: {
            filePath: file.startsWith("/") ? file : `/${file}`,
            rightFileStart: {line: startLine, offset: 1},
            rightFileEnd: {line: endLine, offset: 1}
        }
    });
    if (options.dryRun) {
        console.log(`[dry-run] PR thread for ${check.check_id}:\n${payload}`);
        return Promise.resolve();
    }
    const base = new URL(options.collectionUri);
    const path = `/${options.project}/_apis/git/repositories/${options.repositoryId}/pullRequests/${options.pullRequestId}/threads?api-version=7.1`;
    const token = Buffer.from(`:${options.accessToken}`).toString('base64');

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
                    reject(new Error(`ADO API returned ${res.statusCode} for check ${check.check_id}`));
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
    for (const check of failedChecks) {
        try {
            await postThread(check, opts);
        } catch (e: any) {
            console.warn(`Failed to post PR comment for ${check.check_id}: ${e.message}`);
        }
    }
}