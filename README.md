# KubeDock Security Scan - Azure DevOps Extension

Scans Kubernetes manifests, Dockerfiles, and Helm charts using [Checkov](https://www.checkov.io/) and publishes the results as an HTML report in the pipeline summary tab.

This extension shift security scanning of kubernetes manifest and dockerfile into Azure DevOps Pipeline and allow changes to be detected in the software development lifecycle and enable quick feedback for the development team.

As an kubernetes operator, you can provide custom policy checks and also choose the vulnerability that you want to check for the application manifests. By default it will check against all the policy provided by Checkov.

## Local environment testing

Build the code to be compiled as runnable javascript
```
cd buildandreleasetask
npm run build
npm test
```

Set the environment variable to point to the test folders
```
$env:INPUT_failOnIssues='false' # default is false, set to true to fail the pipeline when there is fail results.
$env:INPUT_helmFolderPath="<your-helm-folder-path>"
$env:INPUT_helmTemplatesPath="<your-helm-templates-folder-path>"
$env:INPUT_helmValuesPaths="<your-helm-values-paths>"  # in comma delimited if you have more than one value file.
$env:INPUT_policyRepoPath = ""   # leave empty to use default Checkov checks
$env:INPUT_repoPath = "<your-repo-where-manifests-dockerfile-lives>"
```

Then run node dist/index.js to see the console output.
Based on the output, "Report saved" tells where the html is generated and can view in browser.