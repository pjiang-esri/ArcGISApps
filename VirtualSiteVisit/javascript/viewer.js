//Initialize user interface after map is loaded
function initUI(map) {
	//Create Info Window Template
	createTipTemplate(false);

	//Init theme layer buttons
	var k = 0;
//	dojo.place("<hr/>", dojo.byId('panelThemeLayers'), "first");
	dojo.forEach(config.themeLayers, function (themeLayer) {
		var titleBar = "<div class='layerHeader' onclick='javascript: toggleLayer(event, " + k + ");'>"
		titleBar += "<span class='layerTitle'>" + themeLayer.alias + "</span>";
		titleBar += "<img id='checkBoxTheme" + k + "' src='images/check_off.png' style='float:right; margin:2px;' title='Toggle layer visibility' onclick='javascript: toggleLayer(event, " + k + ");'/>";
		titleBar += "<img id='imgFlagTheme" + k + "' src='images/flag_gray.png' style='float:right; margin:2px;' alt='' title=''/></div>";
		dojo.place(titleBar, dojo.byId('panelThemeLayers'), "last");

		var layerInfo = "<div id='textThemeInfo" + k + "'></div>";
		dojo.place(layerInfo, dojo.byId('panelThemeLayers'), "last");
		k++;
	});

	//Start to load and analyize sites
	getSiteLayerUrl();
}

//Map Update End, Run Only Once
function mapUpdateEnd() {
	if (mapLoaded == false) {
		dojo.byId("loadingMsg").innerHTML = "Loading saved sites";
		mapLoaded = true;
	}
}

//Clear report panels of ground condition layers
function clearAnalysisPanel() {
	var layerNodes = dojo.query(".layerHeader_active", dojo.byId("panelThemeLayers"));

	if (layerNodes.length > 0) {
		layerNodes[0].className = "layerHeader";
	}

	for (var j = 0; j < config.themeLayers.length; j++) {
		dojo.empty('textThemeInfo' + j);
	}
}

//Get Site Feature Layer Url by item id
function getSiteLayerUrl() {
	var request = esri.request({
		url: esri.arcgis.utils.arcgisUrl + "/" + config.siteFS,
		content: { "f": "json" },
		callbackParamName: "callback",
		handleAs: "json",
		load: function (response) {
			if (response.type == "Feature Service" && response.url) {
				siteLayerUrl = response.url + "/0";
				querySitesLayer(siteLayerUrl, "1=1", false);
			}
			else {
				alert("The specified site feature service item is invalid");
			}
		},
		error: function (error) {
			alert("Get Site Feature Service Item Info Error: " + error.message + ". " + dojo.toJson(error.details));
		}
	});
}

//Re-render Site Tabs when the window is resized
function reloadTabs() {
	renderTabs(0, false);
	changeSite(currentSiteIndex, false);
}

//Toggle a theme layer on the map
function toggleLayer(event, index) {
	var isChecked = false;
	var layerCheck = null;

//	var target = event.target || event.srcElement;
//	var layerButton = (target.tagName == 'DIV') ? target : (target.parentNode || target.parentElement);
//	isActive = layerButton.className == "layerHeader_active";
//	if (visibleLayer) visibleLayer.hide();

//	if (isActive) {
//		layerButton.className = "layerHeader";
//		visibleLayer = null;
//	}
//	else {
//		var layerHeaders = dojo.query(".layerHeader_active", dojo.byId("panelThemeLayers"));
//		if (layerHeaders.length > 0) layerHeaders[0].className = "layerHeader";
//		layerButton.className = "layerHeader_active";

//		var layer = config.themeLayers[index].layerObject;
//		if (layer) { visibleLayer = layer; layer.show(); }
//	}

	if (event.stopPropagation) { // W3C/addEventListener()
		event.stopPropagation();
	} else { // Older IE.
		event.cancelBubble = true;
	}

	var layerCheck = dojo.query("img#checkBoxTheme" + index, dojo.byId("panelThemeLayers"));
	
	if (layerCheck.length > 0) {
		if (layerCheck[0].src.indexOf("on.png") > -1) {
			layerCheck[0].src = "images/check_off.png";
			if (visibleLayer) visibleLayer.hide();
		}
		else {
			clearVisibleLayer();
			var layer = config.themeLayers[index].layerObject;
			if (layer) { visibleLayer = layer; layer.show(); }
			layerCheck[0].src = "images/check_on.png";
		}
	}
}

function clearVisibleLayer() {
	if (visibleLayer) visibleLayer.hide();

	dojo.query("img", dojo.byId("panelThemeLayers")).forEach(function (img) {
		if (img.id.indexOf("checkBox") > -1 && img.src.indexOf("on.png") > -1) {
			img.src = "images/check_off.png";
		}
	});
}

//=================================
// Start Ground Condition Analyses
//---------------------------------
function analyzeThemeLayers(nn) {
	if (nn < config.themeLayers.length) {
		var lyrConfig = config.themeLayers[nn];
		dojo.byId("loadingMsg").innerHTML = "Analyzing layer " + lyrConfig.alias;

		if (lyrConfig.url && lyrConfig.infoLayers.length > 0) {
			dojo.empty('textThemeInfo' + nn);
			dojo.byId("imgFlagTheme" + nn).src = "images/loader.gif";
			analyzeFeatureLayer(lyrConfig, nn, 0);
		}
		else {
			nn++;
			analyzeThemeLayers(nn);
		}
	}
	else {
		dojo.removeAttr('printButton', 'disabled');
		esri.hide(dojo.byId("loadingPanel"));
	}
}

// Analayze Theme Layers
function analyzeFeatureLayer(lyrConfig, nn, jj) {
	var fLayer = lyrConfig.infoLayers[jj];
	var sqlFields = (fLayer.alarmValues) ? fLayer.alarmValues.match(/\{\S*\}/g) : null;
	var outFields = (fLayer.reportFields) ? fLayer.reportFields.keys('name') : [];

	if (sqlFields != null) {
		for (var i = 0; i < sqlFields.length; i++) {
			sqlFields[i] = sqlFields[i].replace(/[\{\}]/g, "");
			if (dojo.indexOf(outFields, sqlFields[i]) == -1) {
				outFields.push(sqlFields[i]);
			}
		}
	}

	var site = sites[currentSiteIndex];
	var queryTask = new esri.tasks.QueryTask((lyrConfig.type == 'featureLayer') ? lyrConfig.url : (lyrConfig.url + "/" + fLayer.layerId));
	var query = new esri.tasks.Query();
	query.returnGeometry = false;
	query.spatialRelationship = esri.tasks.Query.SPATIAL_REL_INTERSECTS;
	query.geometry = site.geometry;
	query.outFields = outFields;
	queryTask.execute(query, function (result) { themeAnalysisHandler(result, lyrConfig, nn, jj) }, function (error) { themeAnalysisHandler(error, lyrConfig, nn, jj); });
}

// THEME LAYER RESULTS HANDLER
function themeAnalysisHandler(result, lyrConfig, indexl, indexf) {

	var fLayer = lyrConfig.infoLayers[indexf];

	if (result.features) { // Succeed
		postAnalysisInfo(result.features, lyrConfig, indexl, indexf);
	}
	else if (result.message) { // Error
		postErrorMsg(result.message, lyrConfig, indexl, indexf)
	}

	indexf++;
	if (indexf < lyrConfig.infoLayers.length) { // Analyze next feature layer
		analyzeFeatureLayer(lyrConfig, indexl, indexf);
	}
	else { // Analyze next map layer
		indexl++;
		analyzeThemeLayers(indexl);
	}
}

// Populate Analysis Info
function postAnalysisInfo(features, lyrConfig, indexl, indexf) {

	var isRedFlag = false;
	var valueStack = [];
	var fLayer = lyrConfig.infoLayers[indexf];

	if (features.length > 0) {
		if (fLayer.alarm) {
			if (fLayer.alarmValues) {
				var sqlRedFlag = fLayer.alarmValues.fromSQL();
				sqlRedFlag = sqlRedFlag.replace(/\{(\S*)\}/g, "f.attributes." + "$1");

				for (var j = 0; j < features.length; j++) {
					var f = features[j];
					isRedFlag = eval(sqlRedFlag) || isRedFlag;
				}
			}
			else {
				isRedFlag = true;
			}
		}

		if (fLayer.reportFields) {
			var value = "";
			var field = null;
			for (var j = 0; j < features.length; j++) {
				for (var k = 0; k < fLayer.reportFields.length; k++) {
					field = fLayer.reportFields[k];
					value = features[j].attributes[field.name];

					if (field.name.toUpperCase().indexOf('LABEL') == -1) {
						value = field.alias + ': ' + value;
					}

					if (dojo.indexOf(valueStack, value) < 0) valueStack.push(value);
				}
			}
		}
	}

	var imgFlag = dojo.byId("imgFlagTheme" + indexl);
	imgFlag.src = (!isRedFlag && imgFlag.src.indexOf('red.png') == -1) ? "images/flag_pass.png" : "images/flag_red.png";

	var site = sites[currentSiteIndex];
	site.attributes["LAYER" + indexl + "FLAG"] = imgFlag.src;

	var className = (isRedFlag) ? "flagSubLayerTitle" : "subLayerTitle";
	var subLayerTitle = "<div class='" + className + "'>" + fLayer.layerTitle + "</div>";
	dojo.place(subLayerTitle, dojo.byId('textThemeInfo' + indexl), "last");

	var infoValues = valueStack.join("<br/>");
	var infoClass = (isRedFlag) ? "flagSubLayerInfo" : "subLayerInfo";
	dojo.place("<div class='" + infoClass + "'>" + infoValues + "</div>", dojo.byId('textThemeInfo' + indexl), "last");
}

//If get an error, post error message
function postErrorMsg(errorMsg, lyrConfig, indexl, indexf) {
	var fLayer = lyrConfig.infoLayers[indexf];

	var imgFlag = dojo.byId("imgFlagTheme" + indexl);
	if (imgFlag.src.indexOf('red.png') == -1) {
		imgFlag.src = "images/flag_gray.png";
	}

	var site = sites[currentSiteIndex];
	site.attributes["LAYER" + indexl + "FLAG"] = imgFlag.src;

	dojo.place("<div class='errorSubLayerTitle'>" + fLayer.layerTitle + "</div>", dojo.byId('textThemeInfo' + indexl), "last");
	dojo.place("<div class='errorSubLayerInfo'>Error: " + errorMsg + "</div>", dojo.byId('textThemeInfo' + indexl), "last");
}
//--------------------------------
// End Ground Condition Analysis
//================================

//Open the printable page
function printReport() {
	var printWin = window.open('print.html', 'SiteReport', 'width=712,resizable=0,menubar=0,toolbar=0,titlebar=1,status=0', true);
	return false;
}