import * as https from 'https';
import {postPrComments, PrCommentOptions} from '../pr-comment';

jest.mock('https');

const opts = {
    collectionUri: 'https://dev.azure.com/myorg',
    project: 'myproject',
    repositoryId: 'myrepo',
    pullRequestId: '123',
    accessToken: 'mytoken'
}

const fakeCheck = {
    check_id : 'CKV_K8S_1',
    check_name: 'Do not admit root containers',
    resource: 'Deployment.default.my-app',
    file_path: '/manifests/deploy.yaml',
    repo_file_path: 'manifests/deploy.yaml',
    file_line_range: [10, 20] as [number, number],
}

it('dry-run logs payload without calling https.request', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    await postPrComments([fakeCheck], { ...opts, dryRun: true });
    expect(https.request).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('CKV_K8S_1'));
    spy.mockRestore();
});