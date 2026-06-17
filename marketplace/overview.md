# KubeDock Security Scan

Scans Kubernetes manifests, Dockerfiles, and Helm charts using [Checkov](https://www.checkov.io/) and publishes the results as an HTML report in the pipeline summary tab.

This extension shift security scanning of kubernetes manifest and dockerfile into Azure DevOps Pipeline and allow changes to be detected in the software development lifecycle and enable quick feedback for the development team.

By default it will check against all the policy provided by Checkov. As an kubernetes operator, you can provide custom policy checks (with Yaml or Python) and also set the list of vulnerability that you want to check for the application manifests, by choosing from [Checkov Kubernetes policy list](https://www.checkov.io/5.Policy%20Index/kubernetes.html), [Checkov Docker policy list](https://www.checkov.io/5.Policy%20Index/dockerfile.html). 

---

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
4. Generates an HTML report and attaches it to the pipeline summary as the **"Checkov Security Scan"** tab.
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

## Feedback & Review
If this extension helps your team/company in the software development lifecycle, please support by providing your feedback in the above Rating & Review tab.

Any issue or feature requests, please go to github to create an issue.