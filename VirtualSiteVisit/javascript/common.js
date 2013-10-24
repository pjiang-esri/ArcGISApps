dojo.require("esri.map");
dojo.require("esri.dijit.Legend");
dojo.require("esri.dijit.Scalebar");
dojo.require("esri.dijit.BasemapGallery");
dojo.require("esri.layers.FeatureLayer");
dojo.require("esri.arcgis.utils");

dojo.require("dijit.dijit"); // optimize: load dijit layer
dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.TabContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("dijit.form.DropDownButton");
dojo.require("dijit.form.ComboBox");
dojo.require("dijit.form.Button");
dojo.require("dojo.store.Memory");
dojo.require("dojo.dom-style");
dojo.require("dojox.fx");

var map = visibleLayer = null;
var mapLoaded = isPlaying = false;
var webMapClickEventListener = null;
var webMapClickEventHandler = null;
var parcelSymbol = null;
var siteLayerUrl = "";

// Initialize application and starts to create map
function initApp() {
	// Set invisible while the page is loading
	//dojo.setStyle("mainWindow", "opacity", 0.0);

	var urlObject = esri.urlToObject(document.location.href);

	//Parameters passed in by URL has the highest priority
	if (urlObject.query) {
		for (var key in urlObject.query) {
			config[key] = urlObject.query[key];
		}
	}

	config['proxyURL'] = config.proxyURL || "proxy/proxy.ashx";
	config['baseMapGallery'] = config.baseMapGallery || '';
	config['zoomLevel'] = config.zoomLevel || 14;

	esri.show(dojo.byId("loadingPanel"));
	if (urlObject.query && urlObject.query.appid) {
		//read application config from ArcGIS.com
		readAppConfig(urlObject.query.appid);
	}
	else {
		dojo.byId("loadingMsg").innerHTML = "Loading maps from ArcGIS Online";
		esri.config.defaults.io.proxyUrl = config.proxyURL;
		esri.config.defaults.io.alwaysUseProxy = false;		

		createMap();
	}
}

//===========================================================
// Funtion - Read the application's configurations from a
// Configurable Application created on the ArcGIS.com portal
//	Used when 'config' is NOT defined in the config.js file
// To ensure this function works, a required parameter
//	appId - the ID of the Configurable Application
//	must be passed in by the url paramemeter
// or defined in the config.js file
//-----------------------------------------------------------
function readAppConfig(appid) {
	dojo.byId("loadingMsg").innerHTML = "Reading Application Config";
	
	// Get the item info from ArcGIS.com
	// If not, use its title and summary as the website's title and subtitle
	var appDeferred = esri.arcgis.utils.getItem(appid);
	appDeferred.addCallback(function (response) {
		var item = getConfigByItem(response.item);

		if (response.itemData) {
			for (var key in response.itemData.values) {
				config[key] = response.itemData.values[key] || item[key];
			}

			esri.config.defaults.io.proxyUrl = config.proxyURL;
			esri.config.defaults.io.alwaysUseProxy = false;

			//Init Map
			createMap();
		}
	});

	appDeferred.addErrback(function (error) {
		esri.hide(dojo.byId("loadingPanel"));
		alert("Read Config Error: " + dojo.toJson(error.message + error.details));
	});
}

//Create map and load layers
function createMap() {
	dojo.byId("loadingMsg").innerHTML = "Loading maps from ArcGIS Online";

	var mapDeferred = esri.arcgis.utils.createMap(config.webmap, "mapDiv", {
		mapOptions: {
			slider: true,
			nav: false,
			logo: false
		},

		ignorePopups: false
	});

	mapDeferred.addCallback(function (response) {

		map = response.map;
		dojo.connect(map, "onUpdateEnd", mapUpdateEnd);
		webMapClickEventHandler = response.clickEventHandler;
		webMapClickEventListener = response.clickEventListener;

		var item = getConfigByItem(response.itemInfo.item);
		document.title = config.title || item.title || "Virtual Site Visit";
		dojo.byId("title").innerHTML = config.title || item.title || "Virtual Site Visit";
		dojo.byId("subtitle").innerHTML = config.subtitle || item.subtitle || "Integrated, colaborative view of land development application sites";
		dojo.byId("logoLink").href = config.logoLinkURL || item.logoLinkURL || "http://www.arcgis.com";
		dojo.byId("logoImage").title = config.logoLinkURL || item.logoLinkURL || "http://www.arcgis.com";
		dojo.byId("logoImage").src = config.logoURL || item.logoURL || "images/logo.png";

		var itemData = response.itemInfo.itemData;
		var operLayers = itemData.operationalLayers;
		if (map.loaded) {
			readWebMapConfig(operLayers);
		}
		else {
			dojo.connect(map, "onLoad", function () {
				readWebMapConfig(operLayers);
			});
		}

		//Resize the map when the browser resizes
		dojo.connect(dijit.byId('mapPane'), 'resize', function () {
			map.resize();
			reloadTabs();
		});
	});

	mapDeferred.addErrback(function (error) {
		alert("Unable to create map: " + " " + dojo.toJson(error.message));
	});

	dijit.byId("mainWindow").layout();
}

function getConfigByItem(itemInfo) {
	var item = new Object();

	item['title'] = itemInfo.title;
	item['subtitle'] = itemInfo.snippet;

	if (itemInfo.description) {
		var imgMatch = itemInfo.description.match(/.*<img.+src='(\S+)'\s.*\/>/i);
		var lnkMatch = itemInfo.description.match(/.*<a.+href='(http\S+)'\s.*\/a>/i);

		if (imgMatch && imgMatch.length > 1) item['logoURL'] = imgMatch[1];
		if (lnkMatch && lnkMatch.length > 1) item['logoLinkURL'] = lnkMatch[1];
	}

	return item;
}

//Read theme layers' configurations set in Webmap
function readWebMapConfig(layers) {
	var failedLayers = [];
	config.themeLayers = [];

	dojo.forEach(layers, function (layer) {
		if (!layer.layerObject) { // Not loaded successfully
			failedLayers.push(layer.title.replace(/, /g, '##'));
		}
		else if ((/^Parcel.*/i).test(layer.title)) {
			config.parcelLayer = new Object();
			if (layer.layers) {
				for (var i = 0; i < layer.layers.length; i++) {
					var layerInfo = layer.layerObject.layerInfos[layer.layers[i].id];
					var parcelConfig = getParcelLayerConfig(layer.layers[i].popupInfo);

					if (parcelConfig != null) {
						config.parcelLayer['searchFields'] = parcelConfig.searchFields;
						config.parcelLayer['outFields'] = parcelConfig.outFields;
					}
					if (layer.layers.length == 1 || parcelConfig.searchFields || (/.*parcel.*/i).test(layerInfo.name)) {
						config.parcelLayer["url"] = layer.url + "/" + layer.layers[i].id;
						break;
					}
				}
			}
			else { //Feature Layer
				config.parcelLayer["url"] = layer.url;
				var parcelConfig = getParcelLayerConfig(layer.popupInfo);
				if (parcelConfig != null) {
					config.parcelLayer['searchFields'] = parcelConfig.searchFields;
					config.parcelLayer['outFields'] = parcelConfig.outFields;
				}
			}
		}
		else {
			var isValidLayer = false;
			var featureLayer = null;
			var themeConfig = new Object();
			var layerInfo = null;

			themeConfig.infoLayers = new Array();
			themeConfig.layerObject = layer.layerObject;
			layer.layerObject.setOpacity(0.75);

			if (layer.layers) {
				for (var i = 0; i < layer.layers.length; i++) {
					featureLayer = layer.layers[i];
					var infoConfig = getThemeLayerConfig(featureLayer.popupInfo);

					if (infoConfig != null) {
						if (!isValidLayer) {
							isValidLayer = true;
							themeConfig['url'] = layer.url;
							themeConfig['name'] = layer.title;
							themeConfig['type'] = "mapService";
							themeConfig['alias'] = layer.title.replace(/_/g, " ");
							themeConfig['layerObject'] = layer.layerObject;
						}

						layerInfo = layer.layerObject.layerInfos[featureLayer.id];
						if (layerInfo) {
							infoConfig['layerId'] = featureLayer.id;
							infoConfig['layerTitle'] = layerInfo.name;
							themeConfig.infoLayers.push(infoConfig);
						}
						else {
							alert("Waringing: If you republish a map service that is a layer in the webmap, please remove/re-add the layer from/into the webmap");
							return;
						}
					}
				}
			}
			else { //Feature Layer
				var infoConfig = getThemeLayerConfig(layer.popupInfo);

				if (infoConfig != null) {
					isValidLayer = true;
					themeConfig['url'] = layer.url;
					themeConfig['name'] = layer.title;
					themeConfig['type'] = "featureLayer";
					themeConfig['alias'] = layer.title.replace(/_/g, " ");
					themeConfig['layerObject'] = layer.layerObject;
					infoConfig['layerTitle'] = layer.layerObject.name;
					themeConfig.infoLayers.push(infoConfig);
				}
			}

			if (isValidLayer) {
				layer.layerObject.setVisibility(false);
				config.themeLayers.push(themeConfig);
			}
		}
	});

	if (config.parcelLayer) {
		if (!config.parcelLayer.outFields || config.parcelLayer.outFields.length == 0) {
			alert("Warning: Output Fields for the Parcel Layer in the webmap are not configured.");
		}

		if (!config.parcelLayer.searchFields || config.parcelLayer.searchFields.length == 0) {
			alert("Warning: Search Fields for the Parcel Layer in the webmap are not configured.");
		}
	}
	else {
		alert("Error: a Parcel layer with a correct pop-up configuration was not found."); 
	}

	if (failedLayers.length > 0) {
		alert("Warning: Failed to load layer " + failedLayers.join(", ").replace(/^(.+)(, )/, '$1 and ').replace(/##/g, ", "));
	}

	initCommonUI();
	initUI(map);
}

//==============================================================
// Config in the parcel layer's attribute fields
// any field with a '.VSV' extension in its alias
// will to be output into the site feature layer
// For example, the alias of field OWNERNAME is 
// "Owner Name.VSV", so field OWNERNAME's info 
// will be copied into the site feature layer
// -------------------------------------------------------------
function getParcelLayerConfig(popupInfo) {

	if (!popupInfo) return null;

	var infoConfig = new Object();

	if (popupInfo.description) {
		var match = popupInfo.description.match(/.*searchFields\s*=\s*(.*)/i);

		if (match && match.length > 1) {
			var tails = match[1].split(/\n|<\/div>|<\/p>|<\/span>|<\/font>|<\/i>|<\/b>|<\/u>|<br \/>/);
			infoConfig["searchFields"] = tails[0].replace(/\s/g, '').split(',');
		}

		popupInfo.description = null;
	}

	var fieldInfos = popupInfo.fieldInfos;
	if (fieldInfos.length > 0) {
		var k = 0;
		var fieldLabel = "";
		var fieldConfig = null;
		var outFields = [];
		for (var i = 0; i < fieldInfos.length; i++) {
			fieldLabel = fieldInfos[i].label;
			if (fieldInfos[i].visible) { // Old version: (/.+\.vsv$/i).test(fieldLabel)
				fieldConfig = new Object();
				//fieldLabel = fieldLabel.substring(0, fieldLabel.length - 4);
				fieldConfig["name"] = fieldInfos[i].fieldName;
				fieldConfig["alias"] = fieldLabel;
				fieldConfig["store"] = "PARCEL" + k.toString();
				fieldInfos[i].label = ((/^\d%.+/).test(fieldLabel)) ? fieldLabel.substring(2) : fieldLabel; // remove .vsv and "1%" if exists
				outFields.push(fieldConfig);
				k++;
			}
		}

		infoConfig['outFields'] = outFields;
	}

	return infoConfig;
}

//=================================================================
// Config in attribute fields and custom attribute display
// Like the parcel layer, any field with a '.VSV' extension 
// in its alias will be reported in the ground condition report
// The following two values must be stored in the webmap by 
// configurating "a custom attribute display" (must be selected)
// alarmValues=<a SQL difinition string of alarm values>
// alarm=<true or false>
// ----------------------------------------------------------------
function getThemeLayerConfig(popupInfo) {

	if (!popupInfo) return null;

	var infoConfig = new Object();
	infoConfig["alarm"] = false;

	if (popupInfo.description) {
		var alarmMatch = popupInfo.description.match(/.*alarm\s*=\s*(true|false).*/i);
		if (alarmMatch && alarmMatch.length > 1) {
			infoConfig["alarm"] = alarmMatch[1].toBoolean();
		}

		var valueMatch = popupInfo.description.match(/.*alarmValues\s*=\s*(.*).*/i);
		if (valueMatch && valueMatch.length > 1) {
			var tails = valueMatch[1].split(/\n|<\/div>|<\/p>|<\/span>|<\/font>|<\/i>|<\/b>|<\/u>|<br \/>/);
			infoConfig["alarmValues"] = tails[0];
		}

		popupInfo.description = null;
	}

	if (popupInfo.fieldInfos.length > 0) {
		var outFields = [];
		var fieldInfo = null;
		//var fieldLabel = "";
		var fieldConfig = null;
		for (var i = 0; i < popupInfo.fieldInfos.length; i++) {
			fieldInfo = popupInfo.fieldInfos[i];
			//fieldLabel = fieldInfo.label;
			if (fieldInfo.visible) { // Old version: (/.+\.vsv$/i).test(fieldLabel)
				fieldConfig = new Object();
				//fieldLabel = fieldLabel.substring(0, fieldLabel.length - 4);
				fieldConfig["name"] = fieldInfo.fieldName;
				fieldConfig["alias"] = fieldInfo.label;
				//fieldInfo.label = fieldLabel // remove ".VSV"
				outFields.push(fieldConfig);
			}
		}

		infoConfig['reportFields'] = outFields;
	}

	return infoConfig;
}

//Initialize common UI for amdin.html and viewer.html
function initCommonUI() {
	addBaseMapGallery();

	//Add chrome theme for popup
	dojo.addClass(map.infoWindow.domNode, "chrome");
	//add the scalebar 
	var scalebar = new esri.dijit.Scalebar({
		map: map,
		scalebarUnit: "english" //metric or english
	});

	//Set window visible after the map is created
	var anim = animateNode(dojo.byId("mainWindow"), 5000, 0, 1, 'sineOut');
	dojo.fx.combine([anim]).play();
}

function addBaseMapGallery() {

	//if a basemap group was specified, listen for the callback and modify the query
	var baseMapGroup = null;
	if (config.baseMapGallery && config.baseMapGallery.indexOf('@') > 0) {
		var groupInfo = config.baseMapGallery.split('@');
		baseMapGroup = { "title": groupInfo[0], "owner": groupInfo[1] };
	}

	//if a bing maps key is provided - display bing maps too.
	var baseMapGallery = new esri.dijit.BasemapGallery({
		showArcGISBasemaps: true,
		basemapsGroup: baseMapGroup,
		bingMapsKey: config.bingmapskey,
		map: map
	}, dojo.create('div'));

	var paneBaseMaps = new dijit.layout.ContentPane({ id: 'baseMapGallery' });
	dojo.place("<div style='margin:8px;'><div><span class='infoHeader'>Select a basemap</span><img src='images/close.png' alt='Close' title='Close' style='float: right'/></div><hr /></div>", paneBaseMaps.domNode, "first");
	dojo.place(baseMapGallery.domNode, paneBaseMaps.domNode, "last");

	var baseMapButton = new dijit.form.DropDownButton({
		label: "Basemap",
		id: "buttonBaseMap",
		baseClass: "baseMapButton",
		iconClass: "esriBasemapIcon",
		title: "Select a basemap",
		dropDown: paneBaseMaps,
		showLabel: false
	});

	dojo.place(baseMapButton.domNode, dojo.byId('esriMap'), 'first');
	var closeImage = dojo.query("div > div > img", paneBaseMaps.domNode)[0];

	dojo.connect(closeImage, "onclick", function () {
		dijit.byId('buttonBaseMap').closeDropDown();
	});

	dojo.connect(baseMapGallery, "onSelectionChange", function () {
		dijit.byId('buttonBaseMap').closeDropDown();
	});

	baseMapGallery.startup();
}

//Hide Ground Condition Layers
function hideLayers() {
	dojo.forEach(config.themeLayers, function (lyrConfig) {
		if (lyrConfig.layerObject) {
			lyrConfig.layerObject.hide();
		}
	});
}

// Create Tip Template for a Site
function createTipTemplate(isAdmin) {
	if (!config.parcelLayer || !config.parcelLayer.outFields) return;

	var order = field = alias = value = "";
	var outFields = config.parcelLayer.outFields;
	var content = "<table cellpadding='2' cellspacing='0' style='width:100%'>";

	//content += "<tr><td class='head'>" + "Site File #:" + ": </td><td>${FILE_ID}</td></tr>";
	//content += "<tr><td class='head'>Description</td><td>${DESCRIPT}</td></tr>";
	
	for (var i = 0; i < outFields.length; i++) {
		field = outFields[i].store;
		alias = outFields[i].alias;

		if ((/^\d%.+/).test(alias)) {
			content += "<tr><td class='head'>" + alias.substring(2) + ": </td><td>${" + field + "}</td></tr>";
		}
		else {
			content += "<tr><td class='head'>" + alias + ": </td><td>${" + field + "}</td></tr>";
		}
	}

	if (!isAdmin) {
		var k = 0;
		dojo.forEach(config.themeLayers, function (themeLayer) {
			content += "<tr><td class='head' colspan='2'>" + themeLayer.alias + "<img src='${LAYER" + k + "FLAG}' style='float:right' alt=''/></td></tr>";
			k++;
		});
	}

	var template = new esri.InfoTemplate();
	template.setContent(content + "</table>");
	map.graphics.setInfoTemplate(template);

	// Create Polygon Symbol
	var lineSym = new esri.symbol.SimpleLineSymbol("solid", new dojo.Color([255, 0, 0, 1]), 3);
	parcelSymbol = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_SOLID, lineSym, new dojo.Color([255, 0, 0, 0.2]));
}

// Create a site graphic on the map
function renderSiteOnMap(graphic) {
	map.graphics.clear();
	if (graphic) {
		graphic.symbol = parcelSymbol;
		map.graphics.add(graphic);
		zoomToFeatures([graphic]);
	}
}

// ZOOM TO FEATURES
function zoomToFeatures(features) {
	var ext = esri.graphicsExtent(features);
	if (ext) {
		//if (!map.extent.contains(ext.expand(2.5)))
		map.setExtent(ext.expand(2.5));
	} else {
		var f2 = features[0];
		//if (!map.extent.contains(f2.geometry))
		map.centerAndZoom(f2.geometry, config.zoomLevel);
	}
}

// Animate Node
function animateNode(node, timeSpan, startValue, endValue, animationType) {
	var animation = dojo.animateProperty({
		node: node,
		duration: timeSpan,
		easing: dojo.fx.easing[animationType],
		properties: {
			opacity: {
				end: endValue,
				start: startValue
			}
		}
	});

	return animation;
}

//=============================
// Object prototype functions
//-----------------------------
//Format a Date Object
Date.prototype.format = function (pattern) {
	return dojo.date.locale.format(this, {
		selector: 'date',
		datePattern: pattern
	});
}

//Convert string to Boolean 
String.prototype.toBoolean = function () {
	return (/^\s*true\s*$/i).test(this);
}

String.prototype.fromSQL = function () {
	var s = "";
	if (this) {
		s = this.replace(/&gt;/g, ">").replace(/&lt;/g, "<");
		s = s.replace(/\sOR\s/gi, ' || ').replace(/\sAND\s/gi, ' && ');
		s = s.replace(/\s+CONTAINS\s+(.+)/gi, '.indexOf($1) > -1');
		s = s.replace(/([^=])=(?!=)/g, "$1 == ");
	}

	return s;
}

Array.prototype.keys = function (key) {
	var keys = new Array();
	if (key && this.length > 0) {
		for (var i = 0; i < this.length; i++) {
			keys.push(this[i][key]);
		}
	}

	return keys;
};

//return a collection of the keys of an Object
Object.keys = Object.keys || (function () {
	return function (o) {
		if (typeof o != "object" && typeof o != "function" || o === null)
			throw new TypeError("Object.keys called on a non-object");

		var result = [];
		for (var name in o) {
			if (Object.prototype.hasOwnProperty.call(o, name))
				result.push(name);
		}

		return result;
	};
})();