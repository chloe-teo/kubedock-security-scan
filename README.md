<p align="center">
  <img src="marketplace/logo.png" alt="KubeDock Guard Logo" width="110" />
</p>

# KubeDock Security Scan - Azure DevOps Extension

Scans Kubernetes manifests, Dockerfiles, and Helm charts using [Checkov](https://www.checkov.io/) and publishes the results as an HTML report in the pipeline summary tab.

This extension shift security scanning of kubernetes manifest and dockerfile into Azure DevOps Pipeline and allow changes to be detected in the software development lifecycle and enable quick feedback for the development team.

By default it will check against all the policy provided by Checkov. As an kubernetes operator, you can provide custom policy checks (with Yaml or Python) and also set the list of vulnerability that you want to check for the application manifests, by choosing from [Checkov Kubernetes policy list](https://www.checkov.io/5.Policy%20Index/kubernetes.html), [Checkov Docker policy list](https://www.checkov.io/5.Policy%20Index/dockerfile.html). 

## Local environment testing

Build the code to be compiled as runnable javascript
```
cd src
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

Run ```node dist/index.js``` to see the console output.

Based on the console output, "Report saved" tells where the html is generated in your local and you can view it in browser.