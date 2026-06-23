import * as path from 'path';
import { installCheckov, runCheckov } from '../checkov';
import { postPrComments } from '../pr-comment';

const k8sPath = path.resolve(__dirname, '../../../user-repo/k8s');

const opts = {
    collectionUri: 'https://dev.azure.com/myorg/',
    project: 'myproject',
    repositoryId: 'fake-repo-id',
    pullRequestId: '99',
    accessToken: 'fake-token',
    dryRun: true,
};

installCheckov();
const results = runCheckov(k8sPath, 'kubernetes');

if (!results || results.results.failed_checks.length === 0) {
    console.log('No failed checks found.');
} else {
    console.log(`Found ${results.results.failed_checks.length} failed check(s). Generating PR comment payloads...\n`);
    postPrComments(results.results.failed_checks, opts).then(() => {
        console.log('\n--- done ---');
    });
}
