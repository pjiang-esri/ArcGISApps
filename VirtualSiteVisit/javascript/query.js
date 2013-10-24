var SITE_NAV_HEIGHT = -1;
var SITE_TAB_HEIGHT = -1;
var currentSiteIndex = -1;
var startIndex = 0;
var endIndex = 0;
var sites = null;

//Get Sites from Site Feature Layer
function querySitesLayer(url, where, isAdmin) {
	var queryTask = new esri.tasks.QueryTask(url);
	var query = new esri.tasks.Query();
	query.outSpatialReference = new esri.SpatialReference({ wkid: 102100 });
	query.orderByFields = ["LASTUPDATE"];
	query.returnGeometry = true;
	query.where = where;
	query.outFields = ["*"];
	queryTask.execute(query, function (fset) { siteQueryHandler(fset, isAdmin); }, function (error) { onQueryTaskError(error, 'Sites'); });
}

//Handle Sites Query Results
function siteQueryHandler(fset, isAdmin) {
	esri.hide(dojo.byId("loadingPanel"));

	if (fset.features.length > 0) {
		sites = fset.features;
		renderTabs(0, isAdmin);
		changeSite(0, isAdmin);
	}
	else {
		dojo.empty("panelParcelLayer");
		dojo.place("<span class='siteMsg'>No sites were created.</span>", dojo.byId('panelParcelLayer'), "last");
	}
}

//Handle Query Error
function onQueryTaskError(error, layer) {
	alert("Query " + layer + " Error: " + dojo.toJson(error.message) + ". " + dojo.toJson(error.details));
	esri.hide(dojo.byId("loadingPanel"));
}

function viewAboveSites(isAdmin) {
	var navHeight = (SITE_NAV_HEIGHT > 0) ? SITE_NAV_HEIGHT : getSiteNavHeight();
	var tabHeight = (SITE_TAB_HEIGHT > 0) ? SITE_TAB_HEIGHT : getSiteTabHeight();
	var spaceHeight = dojo.byId('paneTabArea').offsetHeight - navHeight;
	startIndex = startIndex - Math.floor((spaceHeight - navHeight) / tabHeight);
	startIndex = (startIndex < 2) ? 0 : startIndex;
	renderTabs(startIndex, isAdmin);
	changeSite(currentSiteIndex, isAdmin);
}

function viewNextSites(isAdmin) {
	startIndex = endIndex;
	renderTabs(startIndex, isAdmin);
	changeSite(currentSiteIndex, isAdmin);
}

function renderTabs(startIndex, isAdmin) {
	if (sites == null || sites.length == 0) return;
	dojo.empty('paneTabArea');

	var tabArea = dojo.byId('paneTabArea');
	var navHeight = (SITE_NAV_HEIGHT > 0) ? SITE_NAV_HEIGHT : getSiteNavHeight();
	var tabHeight = (SITE_TAB_HEIGHT > 0) ? SITE_TAB_HEIGHT : getSiteTabHeight();
	var spaceHeight = tabArea.offsetHeight - ((startIndex > 0) ? navHeight + 1 : 0);
	var tabHtml = "";
	var count = 0;

	if (spaceHeight < tabHeight * (sites.length - startIndex)) {
		count = Math.floor((spaceHeight - navHeight) / tabHeight);
		endIndex = startIndex + count;
	}
	else {
		endIndex = sites.length;
	}

	if (startIndex > 0) {
		tabHtml = "<div class='tab_navUp' onclick='javascript: viewAboveSites(" + isAdmin + ");'><img src='images/nav_up.png' style='padding: 1px;' title='Above sites' /></div>";
		dojo.place(tabHtml, tabArea, "last");
	}

	for (var i = startIndex; i < endIndex; i++) {
		tabHtml = "<div id='tab" + i + "' class='tab' onclick='javascript: changeSite(" + i + "," + isAdmin + ")'><p id='tabText" + i + "' class='tabText' title='Site " + (i + 1) + "'>" + (i + 1) + "</p><img src='images/pointerthing.png'/></div>";
		dojo.place(tabHtml, tabArea, "last");
	}

	if (count > 0) {
		tabHtml = "<div class='tab_navDown' onclick='javascript: viewNextSites(" + isAdmin + ");'><img src='images/nav_down.png' style='padding: 1px;' title='More sites' /></div>";
		dojo.place(tabHtml, tabArea, "last");
	}
}

//When a tab button on the left panel is clicked
function changeSite(index, isAdmin) {
	if (index == -1) return;
	if (!sites[index]) return;

	if (dojo.byId("tab" + index)) {
		dojo.forEach(dojo.query(".tab"), function (node) {
			if (dojo.hasClass(node, "tab_selected")) {
				dojo.removeClass(node, "tab_selected");
				dojo.setStyle(dojo.query("> img", node)[0], "visibility", "hidden");
			}
		});

		dojo.addClass(dojo.byId("tab" + index), "tab_selected");
		dojo.setStyle(dojo.query("#tab" + index + " img")[0], "visibility", "visible");
	}

	if (currentSiteIndex == index) return;
	currentSiteIndex = index;

	var site = sites[index];
	var objectId = site.attributes["OBJECTID"] || site.attributes["FID"];
	var parcelInfo = renderParcelInfo(site, false);

	dojo.empty("panelParcelLayer");
	dojo.place(parcelInfo, dojo.byId("panelParcelLayer"), "first");
	queryAttachmentInfo(objectId, isAdmin);
	renderSiteOnMap(site);

	if (!isAdmin) {
		dojo.setAttr('printButton', 'disabled', true);
		esri.show(dojo.byId("loadingPanel"));
		clearVisibleLayer();
		clearAnalysisPanel();
		analyzeThemeLayers(0);
	}
	else {		
		esri.show(dojo.byId("panelSiteButton"));
	}
}

// Render Parcel Info
function renderParcelInfo(site, isNew) {
	if (!config.parcelLayer || !config.parcelLayer.outFields) {
		return "<ul><li style='color:#900;'>Warning: Output Fields for the Parcel Layer are not configured.</li></ul>";
	}

	var outFields = config.parcelLayer.outFields;
	var order = values = v1 = v2 = null;
	var field = alias = value = "";
	var parcelInfos = new Array();

	if (!isNew) {
		//Application ID for the site
		parcelInfos.push("<li><span class='infoHeader'>SCPB File #: </span>" + site.attributes['FILE_ID'] + "</li>");

		//Descrption of the site
		parcelInfos[0] += "<li><span class='infoHeader'>Description: </span>" + site.attributes['DESCRIPT'] + "</li>";
	}

	for (var i = 0; i < outFields.length; i++ ) {
		field = outFields[i].store;
		alias = outFields[i].alias;
		value = site.attributes[field];

		if (value) {
			if ((/^\d%.+/).test(alias)) {
				order = alias.charAt(0);
				if (order == '1') {
					v1 = value.split('|');
					for (var j = 0; j < v1.length; j++) {
						if (!parcelInfos[j]) parcelInfos.push('');
						parcelInfos[j] += "<li><span class='infoHeader'>" + alias.substring(2) + ": </span>" + v1[j] + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
					}
				}
				else {
					v2 = value.split('|');
					for (var j = 0; j < v2.length; j++) {
						if (!parcelInfos[j]) parcelInfos.push('');
						parcelInfos[j] += "<span class='infoHeader'>" + alias.substring(2) + ": </span>" + v2[j] + "</li>";
					}
				}
			}
			else {
				values = value.split('|');
				for (var j = 0; j < values.length; j++) {
					if (!parcelInfos[j]) parcelInfos.push('');
					parcelInfos[j] += "<li><span class='infoHeader'>" + alias + ": </span>" + values[j] + "</li>";
				}
			}
		}
	}

	for (var k = 0; k < parcelInfos.length; k++) {
		parcelInfos[k] = "<ul>" + parcelInfos[k] + "</ul>";
	}

	return parcelInfos.join('<br/>');
}

function queryAttachmentInfo(objectId, isAdmin) {
	esri.show(dojo.byId("loadingPanel"));
	dojo.byId("loadingMsg").innerHTML = "Loading attachments info";

	var request = esri.request({
		url: siteLayerUrl + "/" + objectId + "/attachments?f=json",
		callbackParamName: "callback",
		handleAs: "json",
		load: function (result) {
			onQueryAttachmentComplete(result, isAdmin)
		},
		error: function (error) {
			if (isAdmin) esri.hide(dojo.byId("loadingPanel"));
			alert("Query Attachment Error: " + dojo.toJson(error.message + " " + error.details));
		}
	}, { useProxy: true });
}

//Handle Query Attachment Error
function onQueryAttachmentComplete(result, isAdmin) {
	//If running from the viewer page, wait for anaylyzeThemeLayer is done
	if (isAdmin) esri.hide(dojo.byId("loadingPanel"));

	if (result.attachmentInfos.length > 0) {
		var listAttachments = dojo.byId('listAttachments');
		var attachInfo = "";

		if (!listAttachments) {
			attachInfo += "<div id='panelAttachments'><span class='infoHeader'>Attachments:</span>";
			attachInfo += "<ul id='listAttachments' class='attachInfo'>";
		}

		for (var i = 0; i < result.attachmentInfos.length; i++) {
			var info = result.attachmentInfos[i];
			var name = info.name.substring(info.name.lastIndexOf('\\') + 1);
			var url = siteLayerUrl + "/" + info.parentID + "/attachments/" + info.id;
			attachInfo += (isAdmin) ? "<li><img src='images/delete.png' alt='Delete the attachment' title='Delete the attachment' onclick='javascript: deleteAttachment(" + info.parentID + "," + info.id + ");' style='margin-bottom:-4px;' />&nbsp;" : "<li>";
			attachInfo += "<a href='" + url + "' target='_blank'>" + name + "</a></li>";
		}

		if (!listAttachments) {
			attachInfo += "</ul></div>";
			dojo.place(attachInfo, dojo.byId("panelParcelLayer"), "last");
		}
		else {
			listAttachments.innerHTML = attachInfo;
		}
	}
	else if (dojo.byId('listAttachments')) {
		dojo.empty('listAttachments');
	}
}

//Query tab height defined by .tab class
function getSiteTabHeight() {
	for (var i = 0; i < document.styleSheets.length; i++) {
		try { // Firefox has trouble to access cross-dowmain styleSheets
			var rules = document.styleSheets[i].cssRules || document.styleSheets[i].rules;
			if (rules != null) {
				for (var j = 0; j < rules.length; j++) {
					if (rules[j].selectorText == ".tab") {
						SITE_TAB_HEIGHT = parseInt(rules[j].style.height) + parseInt(rules[j].style.borderBottomWidth);
						break;
					}
				}
			}
		}
		catch (err) {}

		if (SITE_TAB_HEIGHT > -1) break;
	}

	return SITE_TAB_HEIGHT;
}

//Query tab navigator's height defined by .tab_navUp class
function getSiteNavHeight() {
	for (var i = 0; i < document.styleSheets.length; i++) {
		try {
			var rules = document.styleSheets[i].cssRules || document.styleSheets[i].rules;
			if (rules != null) {
				for (var j = 0; j < rules.length; j++) {
					if (rules[j].selectorText == ".tab_navUp") {
						SITE_NAV_HEIGHT = parseInt(rules[j].style.height);
						break;
					}
				}
			}
		}
		catch (err) {}

		if (SITE_NAV_HEIGHT > -1) break;
	}

	return SITE_NAV_HEIGHT;
}