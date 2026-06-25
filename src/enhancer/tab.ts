/// <reference path="../node_modules/vss-web-extension-sdk/typings/index.d.ts" />

VSS.ready(function() {
    var sharedConfig: any = VSS.getConfiguration();
    var vsoContext: WebContext = VSS.getWebContext();

    if (sharedConfig && sharedConfig.onBuildChanged) {
        sharedConfig.onBuildChanged(function(build: any) {
            var container = document.querySelector(".result") as HTMLElement;

            VSS.getAccessToken().then(async function(token) {
                try {
                    var orgUrl = vsoContext.host.uri.replace(/\/$/, "") + "/";
                    var projectId = vsoContext.project.id;
                    var planId = build.orchestrationPlan.planId;
                    var apiUrl = orgUrl + projectId + "/_apis/distributedtask/hubs/build/plans/" + planId + "/attachments/kubedock.scanresult?api-version=7.1";

                    var listRes = await fetch(apiUrl, { headers: { "Authorization": "Bearer " + token.token } });
                    var result: any = await listRes.json();

                    if (!result.value || result.value.length === 0) {
                        container.innerHTML = "<p>No scan results found for this build.</p>";
                        return;
                    }

                    var contentRes = await fetch(result.value[0]._links.self.href, { headers: { "Authorization": "Bearer " + token.token } });
                    container.innerHTML = await contentRes.text();
                } catch {
                    container.innerHTML = "<p>Failed to load scan results.</p>";
                }
            });
        });
    }

    VSS.notifyLoadSucceeded();
});
