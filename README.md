<p align="center">
  <img src="marketplace/logo.png" alt="KubeDock Guard Logo" width="110" />
</p>

# KubeDock Security Scans - Azure DevOps Extension

Want to shift left the security scanning of Kubernetes manifest and Dockerfile into the software development lifecycles? Or to catch any vulnerability due to misconfiguration and provide feedback after application pipeline run? Then this is the extension you can use for those purpose!

This azure pipeline task scans Kubernetes manifests, Dockerfiles, and Helm charts using [Checkov](https://www.checkov.io/) and publishes the results as an HTML report in the pipeline summary tab.

This extension shift security scanning of kubernetes manifest and dockerfile into Azure DevOps Pipeline and allow changes to be detected in the software development lifecycle and enable quick feedback for the development team.

By default it will check against all the policy provided by Checkov. As an kubernetes operator, you can provide custom policy checks (with Yaml or Python) and also set the list of vulnerability that you want to check for the application manifests, by choosing from [Checkov Kubernetes policy list](https://www.checkov.io/5.Policy%20Index/kubernetes.html), [Checkov Docker policy list](https://www.checkov.io/5.Policy%20Index/dockerfile.html). On how to setup this, please look into this below section "Custom Policy Setup"


## Inputs

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `repoPath` | string | **Yes** | `$(System.DefaultWorkingDirectory)` | Path to the checked-out repo to scan. Must exist or the task fails immediately. |
| `policyRepoPath` | string | No | _(empty)_ | Path to a pre-checked-out central policy repo. Should contain a `checkov-policy.yaml` and/or a `custom-checks/` folder. Leave empty to use Checkov's built-in checks. |
| `helmFolderPath` | string | No | _(empty)_ | Path to the Helm chart directory (must contain `Chart.yaml`). **Required when `helmTemplatesPath` is set.** |
| `helmTemplatesPath` | string | No | _(empty)_ | Path to Helm templates to render and scan. When set, the task uses `helm template` to render manifests before scanning. Requires `helmFolderPath`. |
| `helmValuesPaths` | string | No | _(empty)_ | Comma-separated list of Helm values files (e.g. `values.yaml,values.prod.yaml`). Only used when `helmTemplatesPath` is set. |
| `failOnIssues` | boolean | No | `false` | When `true`, the pipeline **fails** if Checkov finds any issues. When `false`, issues are reported as a warning (`SucceededWithIssues`) without breaking the build. |

---

## How It Works

1. Installs Checkov via `pip install checkov` on the agent.
2. Runs three scans against `repoPath`:
   - **Kubernetes** manifests (`--framework kubernetes`)
   - **Dockerfiles** (`--framework dockerfile`)
   - **Helm** charts — either via `helm template` render (if `helmTemplatesPath` is set) or directly (`--framework helm`)
3. If `policyRepoPath` is provided, passes `checkov-policy.yaml` as `--config-file` and `custom-checks/` as `--external-checks-dir`.
4. Generates an HTML report and attaches it to the pipeline summary as the **"KubeDock Security Scan"** tab.
5. Sets the task result based on `failOnIssues`.

---

## Usage Examples

**Minimal — scan the whole repo, warn on issues:**
```yaml
- task: KubeDockSecurityScan@0
  inputs:
    repoPath: '$(System.DefaultWorkingDirectory)'
```

**With custom policies and fail on issues:**
```yaml
- task: KubeDockSecurityScan@0
  inputs:
    repoPath: '$(System.DefaultWorkingDirectory)'
    policyRepoPath: '$(Pipeline.Workspace)/policy-repo'
    failOnIssues: true
```

**With Helm rendering using multiple values files:**
```yaml
- task: KubeDockSecurityScan@0
  inputs:
    repoPath: '$(System.DefaultWorkingDirectory)'
    helmFolderPath: '$(System.DefaultWorkingDirectory)/helm/myapp'
    helmTemplatesPath: '$(System.DefaultWorkingDirectory)/templates'
    helmValuesPaths: 'helm/myapp/values.yaml,helm/myapp/values.yaml,helm/myapp/values.yaml,helm/myapp/values.staging.yaml'
    failOnIssues: true
```

> **Note:** `helmTemplatesPath` cannot be used without `helmFolderPath` — the task will error if `helmTemplatesPath` is set but `helmFolderPath` is empty.

## Custom Policy Setup

1. Create a yaml file with name ``checkov-policy.yaml`` in a folder with following content to test out:

This following checks are from existing Checkov policy, select some for your team/company purpose.
```yaml
check:
  # Kubernetes
  - CKV_K8S_8    # Liveness probe configured
  - CKV_K8S_9    # Readiness probe configured
  - CKV_K8S_14   # Image tag not :latest
  - CKV_K8S_15   # Image pull policy not Always when using :latest
  - CKV_K8S_20   # Containers do not run as root
  - CKV_K8S_28   # Do not admit containers with NET_RAW capability
  - CKV_K8S_30   # Do not admit containers with added capability
  - CKV_K8S_36   # Ensure pod is not running with dangerous capabilities
  - CKV_K8S_37   # Minimize the admission of containers with added capability

  # Custom
  # Uncomment this if you have custom policy - CKV2_K8S_CUSTOM_1  # CPU request must not exceed 1 core

  # Dockerfile
  - CKV_DOCKER_1  # Ensure FROM statement uses a specific version tag
  - CKV_DOCKER_2  # Ensure that HEALTHCHECK instructions have been added
  - CKV_DOCKER_3  # Ensure that a USER for the container has been created
  - CKV_DOCKER_4  # Ensure that the Dockerfile does not contain ADD instruction


```
2. If this folder is put in a different repo, make sure this repo is pre-checkout in a folder path, then pass into argument ``policyRepoPath``.
3. If you have custom policy via YAML or python, place them into a folder named ``custom-checks`` along side the ``checkov-policy.yaml`` file.

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

## Feedback & Review
If this extension helps your team/company in the software development lifecycle, please support by giving a star to this repo.

Any issue or feature requests, please go to github to create an issue.