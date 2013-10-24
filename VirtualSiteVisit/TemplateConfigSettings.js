// This file is created to hold the configuration settings for the application template 
// After you create a configurable application template in your subscription, click the
// Edit button and copy/paste the file to the "Configuration Parameters" field.
// Then ask your organization's admin share the template to your organization's 
// Web Application Template Group and make the group visible in Featured Groups

var configurationSettings = // Do not copy this line, but from the line after

{"configurationSettings":
	[{
		"category": "Content Options",
		"fields": [
		{
			"type": "string",
			"fieldName": "title",
			"label": "Application Title:",
			"tooltip": "The title of this template's website. Use the application item's tittle by default"
		},
		{
			"type": "paragraph",
			"value": "Application Title above will display in the top banner"
		},
		{
			"type": "string",
			"fieldName": "subtitle",
			"label": "Application Subtitle:",
			"tooltip": "The Subtitle of this template's website. Use the application item's summary by default"
		},
		{
			"type": "paragraph",
			"value": "Application Subtitle above will display in the top banner"
		},
		{
			"type": "string",
			"fieldName": "logoURL",
			"label": "Logo Image URL:",
			"tooltip": "URL of the logo image configured in the description of the application item"
		},
		{
			"type": "paragraph",
			"value": "Fill in above the source URL of the logo image to display in the top banner"
		},
		{
			"type": "string",
			"fieldName": "logoLinkURL",
			"label": "Logo Link URL:",
			"tooltip": "URL that the logo image links to. Configured as a link in the description of the application item"
		},
		{
			"type": "paragraph",
			"value": "Fill in above the URL of a website to which the logo image links"
		}]
	},
	{
		"category": "General Settings",
		"fields": [
		{
			"type": "string",
			"fieldName": "webmap",
			"label": "Webmap ID:",
			"tooltip": "ID of the webmap created on ArcGIS.com for this application"
		},
		{
			"type": "paragraph",
			"value": "Fill in above the ID of the webmap created for this application"
		},
		{
			"type": "string",
			"fieldName": "siteFS",
			"label": "Site FS ID:",
			"tooltip": "ID of the Site Feature Service Item created to store planning site info"
		},
		{
			"type": "paragraph",
			"value": "Fill in above the ID of the Feature Service Item created to store planning site info"
		},
		{
			"type": "string",
			"fieldName": "baseMapGallery",
			"label": "Basemap Gallery:",
			"tooltip": "Must be formatted in 'Group Title@Group Owner'. If empty, use the esri basemap gallery by deault"
		},
		{
			"type": "paragraph",
			"value": "Above text must be formatted in 'Group Title@Group Owner'. Use the esri basemap gallery by deault"
		},
		{
			"type": "string",
			"fieldName": "proxyURL",
			"label": "Proxy URL:",
			"tooltip": "Proxy URL - It is set as 'proxy/proxy.ashx' by default for IIS"
		},
		{
			"type": "paragraph",
			"value": "For a web server running Java, set to 'proxy/proxy.jsp'"
		},
		{
			"type": "number",
			"fieldName": "zoomLevel",
			"label": "Zoom Level:",
			"tooltip": "Zoom level into which the map will zoom when a point is selected",
			"constraints": { min: 10, max: 19 },
			"value": "14"
		},
		{
			"type": "paragraph",
			"value": "Above setting forces the map zoom to that level when a point is selected"
		}]
	}],

	"values": {
		"webmap": "2586aa7a7dad46c78ec4d13dd3ff8af8",
		"siteFS": "03e93eb1a77a400f98d7d7e3f73cd08a",
		"baseMapGallery": "",
		"zoomLevel": 14
	}
}