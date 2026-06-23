/// <reference path="../node_modules/vss-web-extension-sdk/typings/index.d.ts" />
import Controls = require("VSS/Controls");
import VSS_Service = require("VSS/Service");
import TFS_Build_Contracts = require("TFS/Build/Contracts");
import TFS_Build_Extension_Contracts = require("TFS/Build/ExtensionContracts");
import DT_Client = require("TFS/DistributedTask/TaskRestClient");

export class ResultTab extends Controls.BaseControl {	
	constructor() {
		super();
	}
		
	public initialize(): void {
		super.initialize();
		var sharedConfig: TFS_Build_Extension_Contracts.IBuildResultsViewExtensionConfig = VSS.getConfiguration();
		var vsoContext = VSS.getWebContext();
		if (sharedConfig) {
			sharedConfig.onBuildChanged((build: TFS_Build_Contracts.Build) => {
				this._initResults(build, vsoContext);
			});
		}
	}

	private _initResults(build: TFS_Build_Contracts.Build, vsoContext: WebContext) {
		var taskClient = DT_Client.getClient();
		taskClient.getPlanAttachments(vsoContext.project.id, "build", build.orchestrationPlan.planId, "kubedock.scanresult").then((attachments) => {
			if (attachments.length === 0) {
				$(".result").html("<p>No scan results found for this build.</p>");
				return;
			}
			var attachment = attachments[0];
			var url = attachment._links.self.href;
			$.get(url).done((html: string) => {
				$(".result").html(html);
			}).fail(() => {
				$(".result").html("<p>Failed to load scan results.</p>");
			});
		});
	}
}

ResultTab.enhance(ResultTab, $(".result"), {});

// Notify the parent frame that the host has been loaded
VSS.notifyLoadSucceeded();

	