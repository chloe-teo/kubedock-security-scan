import * as https from 'https';
import { postPrComments, getPrContext, PrCommentOptions } from '../pr-comment';

jest.mock('https');

const opts: PrCommentOptions = {
    collectionUri: 'https://dev.azure.com/myorg',
    project: 'myproject',
    repositoryId: 'myrepo',
    pullRequestId: '123',
    accessToken: 'mytoken',
};

const fakeCheck = {
    check_id: 'CKV_K8S_1',
    check_name: 'Do not admit root containers',
    resource: 'Deployment.default.my-app',
    file_path: '/manifests/deploy.yaml',
    repo_file_path: 'manifests/deploy.yaml',
    file_line_range: [10, 20] as [number, number],
};

function mockRequest(getResponseBody: string, statusCode = 200) {
    const mockRes = {
        statusCode,
        on: jest.fn((event: string, cb: Function) => {
            if (event === 'data') cb(getResponseBody);
            if (event === 'end') cb();
            return mockRes;
        }),
    };
    const mockReq = {
        on: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
    };
    (https.request as jest.Mock).mockImplementation((_opts: any, callback: Function) => {
        callback(mockRes);
        return mockReq;
    });
    return { mockReq, mockRes };
}

const emptyThreadsResponse = JSON.stringify({ value: [] });
const existingThreadResponse = JSON.stringify({
    value: [{
        id: 99,
        comments: [{ id: 1, content: '<!-- kubedock-scan -->\n## scan results' }],
    }],
});

// ── getPrContext ──────────────────────────────────────────────────────────────

describe('getPrContext', () => {
    const OLD_ENV = process.env;

    beforeEach(() => { process.env = { ...OLD_ENV }; });
    afterAll(() => { process.env = OLD_ENV; });

    it('returns null when SYSTEM_PULLREQUEST_PULLREQUESTID is not set', () => {
        delete process.env['SYSTEM_PULLREQUEST_PULLREQUESTID'];
        expect(getPrContext()).toBeNull();
    });

    it('returns context object when PR env vars are set', () => {
        process.env['SYSTEM_PULLREQUEST_PULLREQUESTID'] = '42';
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://dev.azure.com/org/';
        process.env['SYSTEM_TEAMPROJECT'] = 'proj';
        process.env['BUILD_REPOSITORY_ID'] = 'repo-id';
        process.env['SYSTEM_ACCESSTOKEN'] = 'token123';

        expect(getPrContext()).toEqual({
            collectionUri: 'https://dev.azure.com/org/',
            project: 'proj',
            repositoryId: 'repo-id',
            pullRequestId: '42',
            accessToken: 'token123',
        });
    });
});

// ── postPrComments no-op ──────────────────────────────────────────────────────

it('does nothing when failedChecks is empty', async () => {
    await postPrComments([], opts);
    expect(https.request).not.toHaveBeenCalled();
});

// ── dry-run ───────────────────────────────────────────────────────────────────

describe('dry-run', () => {
    it('logs payload without calling https.request', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        await postPrComments([fakeCheck], { ...opts, dryRun: true });
        expect(https.request).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('CKV_K8S_1'));
        spy.mockRestore();
    });

    it('includes the hidden marker in the logged comment', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        await postPrComments([fakeCheck], { ...opts, dryRun: true });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('<!-- kubedock-scan -->'));
        spy.mockRestore();
    });

    it('shows line range correctly', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        await postPrComments([fakeCheck], { ...opts, dryRun: true });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('10–20'));
        spy.mockRestore();
    });

    it('shows — for line range when file_line_range is absent', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        const check = { ...fakeCheck, file_line_range: undefined };
        await postPrComments([check as any], { ...opts, dryRun: true });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('| `—` |'));
        spy.mockRestore();
    });

    it('shows guideline link when present', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        const check = { ...fakeCheck, guideline: 'https://docs.example.com/policy' };
        await postPrComments([check], { ...opts, dryRun: true });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('[docs](https://docs.example.com/policy)'));
        spy.mockRestore();
    });

    it('shows — for guideline when absent', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        await postPrComments([fakeCheck], { ...opts, dryRun: true });
        const call = (spy.mock.calls[0][0] as string);
        expect(call).toContain('| — |');
        spy.mockRestore();
    });

    it('falls back to file_path when repo_file_path is empty', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        const check = { ...fakeCheck, repo_file_path: '' };
        await postPrComments([check], { ...opts, dryRun: true });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('/manifests/deploy.yaml'));
        spy.mockRestore();
    });
});

// ── POST new thread ───────────────────────────────────────────────────────────

describe('POST new thread', () => {
    beforeEach(() => jest.clearAllMocks());

    it('GETs threads then POSTs when no existing KubeDock thread found', async () => {
        const { mockReq } = mockRequest(emptyThreadsResponse);
        await postPrComments([fakeCheck], opts);

        const calls = (https.request as jest.Mock).mock.calls;
        expect(calls[0][0].method).toBe('GET');
        expect(calls[1][0].method).toBe('POST');
        expect(mockReq.write).toHaveBeenCalledTimes(1);
    });

    it('POST body contains the marker and check ID', async () => {
        const { mockReq } = mockRequest(emptyThreadsResponse);
        await postPrComments([fakeCheck], opts);

        const body = JSON.parse(mockReq.write.mock.calls[0][0]);
        expect(body.comments[0].content).toContain('<!-- kubedock-scan -->');
        expect(body.comments[0].content).toContain('CKV_K8S_1');
    });

    it('POST body has correct thread structure', async () => {
        const { mockReq } = mockRequest(emptyThreadsResponse);
        await postPrComments([fakeCheck], opts);

        const body = JSON.parse(mockReq.write.mock.calls[0][0]);
        expect(body.comments[0].parentCommentId).toBe(0);
        expect(body.comments[0].commentType).toBe(1);
        expect(body.status).toBe(1);
    });
});

// ── PATCH existing thread ─────────────────────────────────────────────────────

describe('PATCH existing thread', () => {
    beforeEach(() => jest.clearAllMocks());

    it('GETs threads then PATCHes when existing KubeDock thread found', async () => {
        mockRequest(existingThreadResponse);
        await postPrComments([fakeCheck], opts);

        const calls = (https.request as jest.Mock).mock.calls;
        expect(calls[0][0].method).toBe('GET');
        expect(calls[1][0].method).toBe('PATCH');
    });

    it('PATCH path includes the correct threadId and commentId', async () => {
        mockRequest(existingThreadResponse);
        await postPrComments([fakeCheck], opts);

        const patchCall = (https.request as jest.Mock).mock.calls[1];
        expect(patchCall[0].path).toContain('/threads/99/comments/1');
    });
});

// ── error handling ────────────────────────────────────────────────────────────

describe('error handling', () => {
    beforeEach(() => jest.clearAllMocks());

    it('swallows ADO errors and logs a warning instead of throwing', async () => {
        mockRequest('', 403);
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        await expect(postPrComments([fakeCheck], opts)).resolves.not.toThrow();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to post PR comment'));
        warn.mockRestore();
    });
});
