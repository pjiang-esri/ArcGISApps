//This file define a config for all parameters
//All parameters can be set through the application's Url
//or configured by an application built based on the template on ArcGIS.com
//or set by reading the web application item's settings
//or set by reading the webmap item's settings
var config =
{
	//Enter a title, if not specified, the webmap's title is used.
	title: "Virtual Site Visit",

	//Enter a subtitle, if not specified the webmap's summary is used
	subtitle: "Integrated, colaborative view of land development application sites",

	//Url of the banner logo image
	logoURL: "images/sussexLogo.png",
	
	//Url of the website's home page that the logo image links to. If empty, use http://www.arcgis.com by default
	logoLinkURL: "http://www.sussex.nj.us",

	//Proxy url - It is set as "proxy/proxy.ashx" by default for IIS
	//For a Web Server running Java, set to "proxy/proxy.jsp"
	proxyURL: "proxy/proxy.ashx",

	//ID of the webmap created on ArcGIS.com for the application
	webmap: "2586aa7a7dad46c78ec4d13dd3ff8af8", // "47c4942be9874611ae489a5197345375",

	//ID of the Feature Service Item created to store planning Sites
	siteFS: "03e93eb1a77a400f98d7d7e3f73cd08a",

	//Formatted as "Group Title@Group Owner". If empty, use esri base map gallery by default
	baseMapGallery: "",

	//Zoom level into which the map will zoom when a site is selected
	zoomLevel: 14
}
