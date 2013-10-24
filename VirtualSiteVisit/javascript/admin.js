var AUTO_FILTER_LENGTH = 6; // Constant to Start Search Box Autocomplete
var sitesLoaded = storeLoading = mapClickLinked = false;
var docKeyDownHandler = docKeyUpHandler = mapClickHandler = null;
var siteFeatureLayer = newSite = null;
var idManager = searchStore = null;
var imgGoPNG = new Image();
var imgGoGIF = new Image();
var searchOptionIndex = -1;

//Initialize user interface after map is loaded
function initUI(map) {
	//Create Info Window Template
	createTipTemplate(true);

	//Connect Events
	dojo.connect(dijit.byId("leftContainer"), "_transition", tabContainerTransit);

	//Authenticate user to access Site Feature Service
	idManager = new CustomIdentityManager(config.siteFS, afterAuthenticated);

	searchStore = new dojo.store.Memory();
	imgGoPNG.src = "images/go.png";
	imgGoGIF.src = "images/go.gif";
}

//Map loading is complete, Run Only Once
function mapUpdateEnd() {
	if (mapLoaded == false) {
		esri.hide(dojo.byId("loadingPanel"));
		mapLoaded = true;
	}
}

//After the user is authenticated
function afterAuthenticated(itemInfo) {
	if (itemInfo.type == "Feature Service") {
		siteLayerUrl = itemInfo.url + "/0";
		siteFeatureLayer = new esri.layers.FeatureLayer(siteLayerUrl + "?token=" + idManager.loginUser.token, { mode: esri.layers.FeatureLayer.MODE_ONDEMAND, outFields: ["*"] });
		listenWindowKeyEvent(true);
	}
}

// Set or remove window key event listeners
function listenWindowKeyEvent(connect) {
	if (connect) {
		docKeyDownHandler = dojo.connect(document, "onkeydown", toggleMapClickEvent);
		docKeyUpHandler = dojo.connect(document, "onkeyup", toggleMapClickEvent);
	}
	else {
		dojo.disconnect(docKeyDownHandler);
		dojo.disconnect(docKeyUpHandler);
	}
}

function toggleMapClickEvent(event) {
	if (event.type == "click") {
		if (!mapClickLinked)
			connectMapClickHandler();
		else
			removeMapClickHandler();
	}
	else if (event.keyCode == 17 || event.keyCode == 18) {
		if (event.type == "keydown" && !mapClickLinked)
			connectMapClickHandler();
		else if (event.type == "keyup")
			removeMapClickHandler();
	}
}

function connectMapClickHandler() {
	dojo.disconnect(webMapClickEventHandler);
	mapClickHandler = dojo.connect(map, "onClick", selectParcel);
	dojo.addClass(dojo.byId("btnMapClickHandler"), "siteButton_active");
	dojo.byId("mapHandlerHelpMsg").innerHTML = "Press the button above again to disable multiple parcel selection mode";
	mapClickLinked = true;
}

function removeMapClickHandler() {
	dojo.disconnect(mapClickHandler);
	dojo.connect(map, "onClick", webMapClickEventListener);
	dojo.removeClass(dojo.byId("btnMapClickHandler"), "siteButton_active");
	dojo.byId("mapHandlerHelpMsg").innerHTML = "Press the button above then click on the map to select more parcels";
	mapClickLinked = false;
}

function searchBoxKeydown(event) {
	if (event.keyCode == 13) {
		findParcel();
	}
	else if (event.keyCode == 8) {
		var input = dojo.byId("parcelSearchText");
		var searchText = input.value.toUpperCase();
		searchText = searchText.substring(0, searchText.length - 1);
		input.focus();

		if (!storeLoading) {
			var found = filterSearchTextStore(searchText);
			if (!found) fillSearchTextStore(searchText);
		}
	}
	else if (event.keyCode == 38 || event.keyCode == 40) {
		var options = dojo.query("#parcelSearchFilter div");

		if (searchOptionIndex > -1 && searchOptionIndex < options.length) {
			var optionOld = options[searchOptionIndex];
			dojo.removeClass(optionOld, "selectedOption");
		}

		searchOptionIndex -= (event.keyCode == 38 && searchOptionIndex > 0) ? 1 : 0;
		searchOptionIndex += (event.keyCode == 40 && searchOptionIndex < options.length - 1) ? 1 : 0;

		if (searchOptionIndex > -1 && searchOptionIndex < options.length) {
			var input = dojo.byId("parcelSearchText");
			var filter = dojo.byId("parcelSearchFilter");
			var optionNew = options[searchOptionIndex];
			dojo.addClass(optionNew, "selectedOption");
			input.value = (event.shiftKey) ? optionNew.title : optionNew.innerHTML;
			var scrollTop = (searchOptionIndex + 1) * optionNew.offsetHeight - filter.offsetHeight + 4;
			filter.scrollTop = (scrollTop < 5) ? 0 : scrollTop;
			input.focus();
		}
	}
}

function searchBoxKeypress(event) {
	if (event.charCode > 31 && event.charCode < 127) {
		var searchText = dojo.byId("parcelSearchText").value + String.fromCharCode(event.charCode);
		if (!storeLoading) {
			var found = filterSearchTextStore(searchText.toUpperCase());
			if (!found) fillSearchTextStore(searchText.toUpperCase());
		}
	}
}

function searchBoxFocus(input) {
	var isFilterShow = dojo.getStyle("parcelSearchFilter", "display") != "none";
	if (input && !isFilterShow) input.value = "";
}

function changeSearchText(index) {
	var options = dojo.query("#parcelSearchFilter div");

	if (searchOptionIndex > -1 && searchOptionIndex < options.length) {
		var optionOld = options[searchOptionIndex];
		dojo.removeClass(optionOld, "selectedOption");
	}

	if (index > -1 && index < options.length) {
		searchOptionIndex = index;
		var optionNew = options[index];
		var input = dojo.byId("parcelSearchText");
		dojo.addClass(optionNew, "selectedOption");
		input.value = optionNew.innerHTML;
		input.focus();
	}
}

//=========================================
// Start - Functions for Search Text Store
//-----------------------------------------
function fillSearchTextStore(searchText) {
	if (!config.parcelLayer || !config.parcelLayer.searchFields) return;

	if ((/^\d+\s[A-Z]+/).test(searchText) || searchText.length > AUTO_FILTER_LENGTH) {
		var wheres = [];
		var fields = config.parcelLayer.searchFields;

		dojo.forEach(fields, function (field) {
			wheres.push(field + " LIKE '" + searchText + "%'");
		});

		var queryTask = new esri.tasks.QueryTask(config.parcelLayer.url);
		var query = new esri.tasks.Query();

		query.returnGeometry = false;
		query.where = wheres.join(' OR ');
		query.outFields = fields;
		queryTask.execute(query,
			function (results) {
				if (results.features.length > 0) {
					var key = title = value = "";
					var attr = results.features[0].attributes;
					for (var i = 0; i < fields.length; i++) {
						value = attr[fields[i]];
						if (value.indexOf(searchText) == 0) { key = fields[i]; }
						else { title = fields[i]; }
					};

					var k = 0;
					var searchSelect = dojo.byId("parcelSearchFilter");
					dojo.empty("parcelSearchFilter");
					dojo.forEach(results.features, function (f) {
						searchStore.data.push({ "id": k, "value": f.attributes[key], "title": f.attributes[title] });
						dojo.place("<div class='option' title='" + f.attributes[title] + "' onclick='javascript: changeSearchText(" + k + ");'>" + f.attributes[key] + "</div>", searchSelect, "last");
						k++;
					});

					searchOptionIndex = -1;
					esri.show(searchSelect);
				}

				dojo.byId("imgSearchButton").src = imgGoPNG.src;
				storeLoading = false;
			},
			function (error) {
				storeLoading = false;
				dojo.byId("imgSearchButton").src = imgGoPNG.src;
				onQueryTaskError(error, 'Parcel');
			});

		dojo.byId("imgSearchButton").src = imgGoGIF.src;
		storeLoading = true;
	}
}

function filterSearchTextStore(searchText) {
	var k = 0;

	if (searchStore.data.length > 0) {
		var results = searchStore.query(function (item) {
			return item.value.indexOf(searchText) == 0;
		});

		searchOptionIndex = -1;
		dojo.empty("parcelSearchFilter");
		var searchSelect = dojo.byId("parcelSearchFilter");

		if (results.length > 0) {
			esri.show(searchSelect);
			results.forEach(function (item) {
				dojo.place("<div class='option' title='" + item.title + "' onclick='javascript: changeSearchText(" + k + ");'>" + item.value + "</div>", searchSelect, "last");
				k++;
			});
		}
		else {
			esri.hide(searchSelect);
		}
	}

	return k > 0;
}

//==================================
// Start - Search Parcel Functions
//----------------------------------
function selectParcel(event) {
	if (siteFeatureLayer && siteFeatureLayer.loaded) {
		var queryTask = new esri.tasks.QueryTask(config.parcelLayer.url);
		var query = new esri.tasks.Query();

		dojo.byId("loadingMsg").innerHTML = "Merging selected parcels";
		esri.show(dojo.byId("loadingPanel"));

		query.returnGeometry = true;
		query.outSpatialReference = map.spatialReference;
		query.spatialRelationship = esri.tasks.Query.SPATIAL_REL_INTERSECTS;
		query.geometry = event.mapPoint;
		query.outFields = config.parcelLayer.outFields.keys('name');
		queryTask.execute(query, mergeParcelGemetry, function (error) { onQueryTaskError(error, 'Parcel'); });
	}
	else if (idManager) {
		idManager.loginDialog.show();
	}
	else {
		idManager = new CustomIdentityManager(config.siteFS, afterAuthenticated);
	}
}

// FIND PARCEL
function findParcel() {
	if (!config.parcelLayer || !config.parcelLayer.searchFields) {
		alert("Error: Search Fields for the Parcel layer are not configured.");
		return;
	}

	var value = dojo.byId("parcelSearchText").value.toUpperCase();
	if (value == "") return;

	searchStore.data = [];
	dojo.empty("parcelSearchFilter");
	esri.hide(dojo.byId("parcelSearchFilter"));
	if (mapClickLinked) removeMapClickHandler();

	if (siteFeatureLayer && siteFeatureLayer.loaded) {
		clearSiteInfoPanel();

		dojo.byId("loadingMsg").innerHTML = "Searching for the parcel";
		esri.show(dojo.byId("loadingPanel"));

		var wheres = [];
		dojo.forEach(config.parcelLayer.searchFields, function (field) {
			wheres.push(field + "='" + value + "'");
		});

		var queryTask = new esri.tasks.QueryTask(config.parcelLayer.url);
		var query = new esri.tasks.Query();
		query.returnGeometry = true;
		query.outSpatialReference = map.spatialReference;
		query.spatialRelationship = esri.tasks.Query.SPATIAL_REL_INTERSECTS;
		query.where = wheres.join(' OR ');
		query.outFields = config.parcelLayer.outFields.keys('name');
		queryTask.execute(query, parcelQueryHandler, function (error) { onQueryTaskError(error, 'Parcel'); });
	}
	else if (idManager) {
		idManager.loginDialog.show();
	}
	else {
		idManager = new CustomIdentityManager(config.siteFS, afterAuthenticated);
	}
}

function mergeParcelGemetry(featureSet) {
	if (featureSet.features.length > 0) {

		var f = featureSet.features[0];
		var outFields = config.parcelLayer.outFields;
		var graphic = (map.graphics.graphics.length > 0) ? map.graphics.graphics[0] : null;

		if (graphic && graphic.geometry.rings) {
			var rings = f.geometry.rings;
			for (var i = 0; i < rings.length; i++) {
				graphic.geometry.addRing(rings[i]);
			}

			var v1 = v2 = "";
			var attributes = {};
			for (var i = 0; i < outFields.length; i++) {
				v1 = graphic.attributes[outFields[i].store];
				v2 = f.attributes[outFields[i].name];

				if (v1 || v2) {
					attributes[outFields[i].store] = ((v1) ? v1 : "") + "|" + ((v2) ? v2 : "");
				}
			}

			graphic.attributes = attributes;
			postParcelInfo(graphic);
			map.graphics.refresh();
		}
		else {
			map.graphics.clear();
			newSite = new esri.Graphic(f.geometry, null, new Object());
			for (var i = 0; i < outFields.length; i++) {
				newSite.attributes[outFields[i].store] = f.attributes[outFields[i].name];
			}

			newSite.symbol = parcelSymbol;
			map.graphics.add(newSite);
			postParcelInfo(newSite);
		}
	}

	esri.hide(dojo.byId("loadingPanel"));
}

// PARCEL QUERY RESULTS HANDLER
function parcelQueryHandler(featureSet) {

	esri.hide(dojo.byId("loadingPanel"));

	if (featureSet.features.length > 0) {
		var graphic = featureSet.features[0];

		//Copy parcel attributes and geometry to Site
		newSite = new esri.Graphic(graphic.geometry, null, new Object());
		var outFields = config.parcelLayer.outFields;
		for (var i = 0; i < outFields.length; i++) {
			newSite.attributes[outFields[i].store] = graphic.attributes[outFields[i].name];
		}

		newSite.symbol = parcelSymbol;
		map.graphics.add(newSite);
		zoomToFeatures([newSite]);
		postParcelInfo(newSite);
	}
	else {
		alert("Sorry! No parcel is found");
	}
}

function clearSiteInfoPanel() {
	esri.show(dojo.byId("msgNoParcelInfo"));
	esri.hide(dojo.byId("panelSaveButton"));
	dojo.empty("panelParcelInfo");
	map.graphics.clear();
}

// RENDER PARCELS
function postParcelInfo(graphic) {
	if (graphic) {
		var parcelInfo = renderParcelInfo(graphic, true);
		dojo.byId("panelParcelInfo").innerHTML = parcelInfo;
		esri.show(dojo.byId("panelSaveButton"));
		esri.hide(dojo.byId("msgNoParcelInfo"));
	}
}

//===================================
// Start - Site Management Functions 
//-----------------------------------
function saveSite(save) {
	if (save) {
		if (siteFeatureLayer && siteFeatureLayer.loaded && siteFeatureLayer.isEditable()) {
			var siteFileID = dojo.byId("txtFileID").value;
			var description = dojo.byId("txtSiteDesc").value;
			if (siteFileID != "") {
				var now = new Date();
				dojo.byId("loadingMsg").innerHTML = "Saving site information";
				esri.show(dojo.byId("loadingPanel"));
				esri.hide(dojo.byId("saveReminder"));
				esri.hide(dojo.byId("panelSaveSite"));
				dojo.byId("txtSiteDesc").value = "";
				dojo.byId("txtFileID").value = "";

				newSite.attributes["FILE_ID"] = siteFileID;
				newSite.attributes["DESCRIPT"] = description;
				newSite.attributes["LASTUPDATE"] = now.toJSON().substring(0, 10);
				//newSite.attributes["STATUS"] = "Active";

				var features = [newSite];
				siteFeatureLayer.applyEdits(features, null, null, onEditsComplete, onEditsError);
			}
			else {
				dojo.byId("saveReminder").style.display = "inline";
				dojo.byId("txtFileID").focus();
			}
		}
		else {
			alert("Error: Site Feature Service intialization failed or not editable");
		}
	}
	else {
		esri.hide(dojo.byId("panelSaveSite"));
	}
}

function uploadAttachment(run) {
	esri.hide(dojo.byId("panelUploadAttachment"));

	if (run && currentSiteIndex > -1) {
		var site = sites[currentSiteIndex];
		if (site && siteFeatureLayer.hasAttachments) {
			esri.show(dojo.byId("loadingPanel"));
			dojo.byId("loadingMsg").innerHTML = "Uploading attachments";
			var objectId = site.attributes["OBJECTID"] || site.attributes["FID"];
			siteFeatureLayer.addAttachment(objectId, this.uploadForm, onAddAttchmentComplete,
			function (error) {
				esri.hide(dojo.byId("loadingPanel"));
				if (error) alert("Update Attachment Error: " + dojo.toJson(error.message) + " " + dojo.toJson(error.details));
			});
		}
		else {
			alert("Error: attachments are not enabled on the sites feature layer.");
		}
	}
}

function deleteAttachment(objectId, attachmentId) {
	if (objectId && attachmentId) {
		esri.show(dojo.byId("loadingPanel"));
		dojo.byId("loadingMsg").innerHTML = "Deleting attachment";

		siteFeatureLayer.deleteAttachments(objectId, [attachmentId],
		function (result) {
			esri.hide(dojo.byId("loadingPanel"));

			if (result && result.length > 0 && result[0].success) {
				queryAttachmentInfo(objectId, true);
				alert("The attachment is successfully deleted");
			}
		},
		function (error) {
			esri.hide(dojo.byId("loadingPanel"));
			if (error) alert("Delete Attachment Error: " + dojo.toJson(error.message) + " " + dojo.toJson(error.details));
		});
	}
}

function onEditsComplete(addResults, updateResults, deleteResults) {
	esri.hide(dojo.byId("loadingPanel"));

	if (addResults.length > 0) {
		if (addResults[0].success) {
			alert("This site has been sucessfully saved");
			sitesLoaded = false; // force to reload
		}
		else {
			onEditsError(addResults[0].error);
		}
	}

	if (updateResults.length > 0) {
		if (updateResults[0].success) {
			alert("The status of this site has changed");
			queryActiveSites();
		}
		else {
			onEditsError(updateResults[0].error);
		}
	}

	if (deleteResults.length > 0) {
		if (deleteResults[0].success) {
			alert("The site has been removed");
			queryActiveSites();
		}
		else {
			onEditsError(deleteResults[0].error);
		}
	}
}

function onAddAttchmentComplete(result) {
	esri.hide(dojo.byId("loadingPanel"));

	if (result.success) {
		alert("The attachment for this site is successfully uploaded");

		var attachInfo = "";
		var url = siteLayerUrl + "/" + result.objectId + "/attachments/" + result.attachmentId;
		var listAttachments = dojo.byId('listAttachments');
		var linkNewAttach = "<li><img src='images/delete.png' style='margin-bottom:-4px;' alt='Delete the attachment' title='Delete the attachment' onclick='javascript: deleteAttachment(" + result.objectId + "," + result.attachmentId + ");' />&nbsp;<a href='" + url + "' target='_blank'>New Attachment</a></li>";
		if (listAttachments) {
			dojo.place(linkNewAttach, listAttachments, "last");
		}
		else {
			var attachInfo = "<div id='panelAttachments'><span class='infoHeader'>Attachments:</span>";
			attachInfo += "<ul id='listAttachments' class='attachInfo'>";
			attachInfo += linkNewAttach;
			attachInfo += "</ul></div>";
			dojo.place(attachInfo, dojo.byId("panelParcelLayer"), "last");
		}
	}
}

function onEditsError(error) {
	esri.hide(dojo.byId("loadingPanel"));

	if (error) {
		alert("Change Site Error: " + dojo.toJson(error.message) + " " + dojo.toJson(error.details));
	}
}

//===============================================
// Start - Functions of Managing Existing Sites
//-----------------------------------------------
// Show all existing sites in the Change Site Tab
function tabContainerTransit(newPane, oldPane) {
	if (newPane.id == "tabReviewSites") {
		listenWindowKeyEvent(false);

		if (!sitesLoaded) {
			queryActiveSites();
		}
		else if (sites && currentSiteIndex > -1) {
			renderSiteOnMap(sites[currentSiteIndex]);
		}
	}
	else if (newPane.id == "tabAddNewSite") {
		listenWindowKeyEvent(true);
		clearSiteInfoPanel();
	}
}

//Query Active Planning Sites
function queryActiveSites(itemInfo) {
	if (itemInfo) {
		afterAuthenticated(itemInfo);
	}

	if (siteLayerUrl) {
		sitesLoaded = true;
		esri.show(dojo.byId("loadingPanel"));
		dojo.byId("loadingMsg").innerHTML = "Loading saved sites";
		querySitesLayer(siteLayerUrl, "1=1", true);
	}
	else if (idManager) {
		idManager.callback = queryActiveSites;
		idManager.loginDialog.show();
	}
	else {
		idManager = new CustomIdentityManager(config.siteFS, queryActiveSites);
	}
}

//Deprecated
//function changeSiteStatus(status) {
//	dojo.byId("loadingMsg").innerHTML = "Changing the site's status";
//	esri.show(dojo.byId("loadingPanel"));

//	var now = new Date();
//	var theSite = sites[currentSiteIndex];
//	theSite.attributes["STATUS"] = status;
//	theSite.attributes["LASTUPDATE"] = now.toJSON().substring(0, 10);
//	siteFeatureLayer.applyEdits(null, [theSite], null, onEditsComplete, onEditsError);
//}

//Remove a stored site from Site FS
function deleteCurrentSite() {
	dojo.byId("loadingMsg").innerHTML = "Deleting the site";
	esri.show(dojo.byId("loadingPanel"));

	var theSite = sites[currentSiteIndex];
	siteFeatureLayer.applyEdits(null, null, [theSite], onEditsComplete, onEditsError);
}

//Re-render Site Tabs when the window is resized
function reloadTabs() {
	if (sitesLoaded) {
		renderTabs(0, true);
		changeSite(currentSiteIndex, true);
	}
}
//====================================================
// Customized Identity Manager and Login Dialog Class
// Authenticate a user to access Site Featuer Service
//----------------------------------------------------
function CustomIdentityManager(itemId, callback) {
	var idm = this; // this Identity Manager

	this.callItem = itemId;
	this.callback = callback;
	this.loginUser = { username: "", password: "", token: "" };
	this.expiration = 480; // 8 hours
	this.tokenServiceUrl = "https://www.arcgis.com/sharing/generateToken"; // default

	this.getItemInfo = function (itemId) {
		if (idm.loginUser.token) {
			var request = esri.request({
				url: esri.arcgis.utils.arcgisUrl.replace("http:", "https:") + "/" + itemId,
				content: { "f": "json", "token": idm.loginUser.token },
				callbackParamName: "callback",
				handleAs: "json",
				load: function (response) {
					if (response) {
						if (response.type == "Feature Service" && response.url) {
							var item = {
								id: response.id,
								url: response.url,
								type: response.type,
								owner: response.owner,
								title: response.title
							};

							idm.getItemGroups(item);
						}
						else {
							alert("The specified site feature service item is invalid.");
						}
					}
					else {
						var error = { code: -100, message: "failed to get the info of item " + itemId, details: [] };
						if (idm.loginDialog) idm.loginDialog.error_(error);
					}
				},
				error: function (error) {
					var error = { code: 403, message: error.message, details: error.details };
					if (idm.loginDialog) idm.loginDialog.error_(error);
				}
			});
		}
		else {
			var error = { code: 400, message: "Failed to create a token", details: [] };
			if (idm.loginDialog) idm.loginDialog.error_(error);
		}
	}

//	this.loginPortal = function (item) {
//		var portalId = item.url.substring(item.url.indexOf("arcgis.com/") + "arcgis.com/".length, item.url.indexOf("/arcgis/rest"));

//		var request = esri.request({
//			url: "http://www.arcgis.com/sharing/rest/portals/" + portalId,
//			content: { "f": "json" },
//			callbackParamName: "callback",
//			handleAs: "json",
//			load: function (portal) {
//				if (portal) {
//					var portalUrl = portal.urlKey + "." + portal.customBaseUrl;
//					idm.tokenServiceUrl = "https://" + portalUrl + "/sharing/rest/generateToken";

//					var tokenDfd = idm.generateToken(idm.loginUser);
//					tokenDfd.addCallback(function (response) {
//						if (response.token) {
//							idm.loginUser.token = response.token;
//							idm.getItemGroups(item);
//						}
//					});
//				}
//			},
//			error: function (error) {
//				//var error = { code: -100, message: error.message, detaials: error.details };
//				if (idm.loginDialog) idm.loginDialog.error_(error);
//			}
//		});
//	}

	//If the login user is not a member of the item group
	//the user is denied to access the item's resource
	this.getItemGroups = function (item) {

		var request = esri.request({
			url: esri.arcgis.utils.arcgisUrl.replace("http:", "https:") + "/" + item.id + "/groups",
			content: { "f": "json", token: idm.loginUser.token },
			callbackParamName: "callback",
			handleAs: "json",
			load: function (response) {
				if (response.admin.length == 0 && response.member.length == 0) {
					var error = { code: 403, message: "you do not have the permission to access item " + item.id, details: [] };
					if (idm.loginDialog) idm.loginDialog.error_(error);
				}
				else {
					idm.loginDialog.hide();
					idm.callback(item);
				}
			},
			error: function (error) {
				if (idm.loginDialog) idm.loginDialog.error_(error);
			}
		});
	}

	this.refreshToken = function (callback, params) {
		idm.generateToken(this.loginUser, callback, params);
	}

	//Generate Token
	this.generateToken = function (user, callback, params) {

		var tokenDfd = esri.request({
			url: idm.tokenServiceUrl,
			content: { "f": "json", "username": user.username, "password": user.password, "referer": document.URL, "expiration": idm.expiration },
			callbackParamName: "callback",
			handleAs: "json"
		}, { usePost: true });

		tokenDfd.addCallback(function (response) {
			if (response.token) {
				idm.loginUser.username = user.username;
				idm.loginUser.password = user.password;
				idm.loginUser.token = response.token;
			}

			if (callback) callback.apply(idm, params);
		});

		tokenDfd.addErrback(function (error) {
			if (idm.loginDialog) idm.loginDialog.error_(error);
		});

		return tokenDfd;
	}

	//Create a login Dialog
	this.createLoginDialog = function (callback, params) {
		var dialogContent = "<div class='dijitDialogPaneContentArea'>" + "<div class='signinDialogMsg'>Please sign in to access items on ArcGIS Online</div>" + "<div style='margin: 0px; padding: 0px; height: 8px;'></div>" + "<div class='esriErrorMsg'>Sorry, that account is not authorized</div>" + "<div class='signingInLoader'><img src='images/loader.gif' alt='' title='' /></div>" + "<div style='margin: 0px; padding: 0px; height: 8px;'></div>" + "<table style='width: 100%;' cellpadding='0'>" + "<tr><td><label>&nbsp;User Name:</label><br/><input data-dojo-type='dijit.form.ValidationTextBox' data-dojo-props='type:\"text\", \"class\":\"esriIdUser\", required:true, trim:true, style:\"width: 100%;\"' /></td></tr>" + "<tr><td style='padding-top:6px;'><label>&nbsp;Password:</label><br/><input data-dojo-type='dijit.form.ValidationTextBox' data-dojo-props='type:\"password\", \"class\":\"esriIdPwd\", required:true, style:\"width: 100%;\"' /></td></tr>" + "</table>" + "</div>" + "<div class='dijitDialogPaneActionBar' style='margin-top:6px; text-align:right;'>" + "<button data-dojo-type='dijit.form.Button' data-dojo-props='type:\"button\", \"class\":\"esriIdSubmit\"'>Ok</button>" + "<button data-dojo-type='dijit.form.Button' data-dojo-props='type:\"button\", \"class\":\"esriIdCancel\"'>Cancel</button>" + "</div>";

		var myDialog = new dijit.Dialog({
			title: "Sign In",
			closable: false,
			content: dialogContent,
			"class": "esriSignInDialog",
			style: "width: 18em;",

			keypressed_: function (evt) {
				if (evt.charOrCode === dojo.keys.ENTER) {
					this.execute_();
				}
			},

			execute_: function () {
				var dialog = this;
				var usr = this.txtUsr_.get("value");
				var pwd = this.txtPwd_.get("value");

				if (!usr || !pwd) {
					return;
				}

				esri.show(this.loader_);
				this.btnSubmit_.set("disabled", true);
				idm.generateToken({ username: usr, password: pwd }, callback, params);
			},

			cancel_: function () {
				this.btnSubmit_.set("disabled", false);
				esri.hide(this.errMsg_);
				esri.hide(this.loader_);
				window.close();
			},

			reset_: function () {
				esri.hide(this.loader_);
				this.txtUsr_.set("value", "");
				this.txtPwd_.set("value", "");
				this.btnSubmit_.set("disabled", false);
			},

			error_: function (error) {
				switch (error.code) {
					case 403: this.errMsg_.innerHTML = "Sorry, " + error.message; break;
					case 400: this.errMsg_.innerHTML = "Sorry, failed to authenticate the user. Invalid username or password"; break;
					default: this.errMsg_.innerHTML = "Sorry, " + error.message + ". " + error.details.join(". ");
				}

				this.reset_();
				esri.show(this.errMsg_);
			}
		});

		esri.hide(myDialog.closeButtonNode);
		myDialog.txtUsr_ = dijit.byNode(dojo.query(".esriIdUser", myDialog.domNode)[0]);
		myDialog.txtPwd_ = dijit.byNode(dojo.query(".esriIdPwd", myDialog.domNode)[0]);
		myDialog.errMsg_ = dojo.query(".esriErrorMsg", myDialog.domNode)[0];
		myDialog.loader_ = dojo.query(".signingInLoader", myDialog.domNode)[0];
		myDialog.btnSubmit_ = dijit.byNode(dojo.query(".esriIdSubmit", myDialog.domNode)[0]);
		myDialog.btnCancel_ = dijit.byNode(dojo.query(".esriIdCancel", myDialog.domNode)[0]);
		myDialog.connect(myDialog.txtUsr_, "onKeyPress", myDialog.keypressed_);
		myDialog.connect(myDialog.txtPwd_, "onKeyPress", myDialog.keypressed_);
		myDialog.connect(myDialog.btnSubmit_, "onClick", myDialog.execute_);
		myDialog.connect(myDialog.btnCancel_, "onClick", myDialog.cancel_);

		return myDialog;
	}

	this.loginDialog = this.createLoginDialog(idm.getItemInfo, [idm.callItem]);
	this.loginDialog.show();
}

