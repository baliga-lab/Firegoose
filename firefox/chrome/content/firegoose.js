/*
 * Copyright (C) 2007 by Institute for Systems Biology,
 * Seattle, Washington, USA.  All rights reserved.
 *
 * This source code is distributed under the GNU Lesser
 * General Public License, the text of which is available at:
 *   http://www.gnu.org/copyleft/lesser.html
 */

/**
 * Support for the Firegoose Gaggle toolbar.
 *
 * initialize java objects, respond to GUI events
 *
 * Naming Conventions: CamelCase is used for all names.
 * The following prefixes are used.
 * ======================================================
 * fg     - XUL widgets
 * fgcmd  - XUL command elements
 * FG_    - global javascript variable and functions
 * _      - private members, touch at your own risk
 *
 * Local variables and function parameters get no prefix.
 *
 */

 // requires gaggleData.js

var FG_timerIntervalId = null;
var FG_websiteHandlers = {};
var FG_default = {species : "unknown", mode : "default"};
var FG_isConnected = false;

var FG_Workflow_InProgress = false;
var FG_Current_WorkflowActions = new Array();
var FG_Current_Tab;
var FG_Current_GaggleData = null;
var FG_Current_WebHandlerReportUrl = null; // A url of a web handler (e.g. EMBL String) to generate the report data
var FG_Goose = null;

// these keep track of the last value this window has seen
// from the goose java class. We poll the goose asking if
// we have new updates (either received a broadcast or got
// an updated list of geese). If we get the same value as
// last time, nothing's changed, so do nothing. If not, we
// have to update the UI to reflect the new state.
// @see the function FG_pollGoose().
var FG_previousNewDataSignalValue = 0;
var FG_previousTargetUpdateSignalValue = 0;
var FG_java;

/**
 * I want to pass this object to java and have it called from
 * there, but so far no luck. I tried using JSObject, but apparently
 * that only works in applets? This was tried many versions ago, and
 * may work now.
 */
var FG_firegooseJS = {
	doHide: function() { window.blur(); },
	doShow: function() { window.focus(); },
	name: "FG_firegooseJS"
}

function appletloaded()
{
    if (FG_Goose == undefined)
    {
        // Re-establish connection to Java
        //alert("applet loaded!");
        try
        {
            FG_trace('appletloaded establishing connection to Java plugin...');
            var appletRef = document.getElementById('DummyApplet');
            FG_trace("Got appletRef for firegoose " + appletRef);
            //alert(appletRef);
            //window.java = appletRef.Packages.java;
            FG_trace("window.java");
            //FG_java = window.java;
            FG_trace('set java variable into global namespace to re-establish compatibility...');
            FG_trace('initializing Java Firegoose loader...');

            FG_Goose = appletRef.getGoose();
            FG_trace("Goose " + FG_Goose);
            javaFiregooseLoader.init();

            // Try to connect to Gaggle after init
            FG_connectToGaggle(true);
            FG_trace('Java Firegoose loaded');
        }
        catch(e)
        {
            dump("\nFailed to load firegoose: " + e.message);
        }
    }
}


// This code generates an applet and inject it into a web page.
// It worked, however, pointing the applet's archive attribute
// to the local file where the applet is stored together with
// the firegoose plugin won't work due to security restrictions.
// I keep the code anyway for a reference.
function FG_generateAppletCode(doc, win)
{
    if (doc != null && win != null && FG_java == undefined)
    {
        dump("\nGetting FiregooseApplet...\n");
        var guid = "firegoose@systemsbiology.org";
        var folderName = "chrome";
        var fileName = "/GaggleFiregooseApplet.jar";
        dump("\nGetting appletFile...\n");
        try
        {
            var chromeRegistry =
                    Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                        .getService(Components.interfaces.nsIChromeRegistry);

            var uri =
                Components.classes["@mozilla.org/network/standard-url;1"]
                    .createInstance(Components.interfaces.nsIURI);

            // convert chrome URLs to paths using what's in the chrome.manifest file
            uri.spec = "chrome://firegoose/content/";

            var path = chromeRegistry.convertChromeURL(uri);
            if (typeof(path) == "object") {
                path = path.spec;
            }
            path = path.substring(0, path.indexOf("/chrome/") + 1);
            dump("\nFiregoose Path: " + path);
            path += folderName;
            path += fileName;
            var fileUri = path;
            dump("\nApplet file uri: " + fileUri + "\n");

            var app = document.createElement('applet');
            app.id= 'DummyApplet';
            app.setAttribute("archive", fileUri);
            app.setAttribute("code", 'GaggleFiregooseApplet.class');
            app.width = '0';
            app.height = '0';
            doc.getElementsByTagName('body')[0].appendChild(app);
        }
        catch (e)
        {
            FG_trace("Failed to get GaggleFiregooseApplet: " + e);
        }

    }
}


/**
 * Scans the page for gaggle data when a new page is loaded, a
 * new browser tab is selected, or a gaggleDataEvent is received.
 */
var FG_pageListener = {

    root_document: null,

	scanPage: function(doc, clearPageData) {
		FG_trace("BEGIN scanPage---------------------------------------------------------");
        
        // if clearPageData isn't passed, default it to true
        clearPageData = typeof(clearPageData) == 'undefined' ? true : clearPageData;
        FG_trace("Clear page data = " + clearPageData);
        
        // If we're loading a page containing frames, we'll get several page load events
        // causing scanPage to be called several times. In this case, we don't want to clear
        // the page data 'cause a page contructed of frames appears as one page to the user.
        if (clearPageData) FG_gaggleDataHolder.clearPageData();

		// We get a warning from inside the following loop. I haven't tracked it down,
		// but things seem to work OK anyway...
		//
		// Warning: reference to undefined property this[arguments[0]]
		// Source File: XPCSafeJSObjectWrapper.cpp
		// Line: 450

		// look for pages we know how to scrape
		for (var w in FG_websiteHandlers) {
			var website = FG_websiteHandlers[w];
			try {
			    if (website.recognize(doc) && website.getPageData) {
					var pageData = website.getPageData(doc);
					// if pageData is a list of gaggleData objects
					if (pageData && pageData.length && pageData.length > 0) {
						FG_gaggleDataHolder.putAll(pageData);
						// experiment break;
					}
					// if pageData is just one gaggleData object
					else if (pageData) {
						FG_gaggleDataHolder.put(pageData);
                        if(pageData.autoBroadcastTarget && pageData.autoBroadcastTarget != ""){
                            FG_dispatchBroadcastToWebsite(pageData, pageData.autoBroadcastTarget);
                            pageData.autoBroadcastTarget = "";
                        }
						// experiment break;
					}
				}
			}
			catch (e) {
				FG_trace("Exception scanning page: " + e);
			}
		}

		FG_populateBroadcastChooser();
		FG_trace("END scanPage");
	},

	onTabSelect: function(aEvent) {
		this.scanPage(window.content.document);
		// Update workflow UI
        var tabvalue = aEvent.target.value;
        //dump("\nTab " + tabvalue + " selected\n");
		var gaggleWorkflowData = FG_findWorkflowData(tabvalue);
		if (gaggleWorkflowData != null)
		{
		    var action = gaggleWorkflowData.getWorkflowAction();
		    FG_setWorkflowUI(action);
		    FG_Current_Tab = aEvent.target;
		}
		else
		    FG_setWorkflowUI(null);
	},

	// javascript in the page can generate gaggleDataEvents
	dataEventListener: function(aEvent) {
		dump("got a gaggle data event\n");
	/*
		dump("got a gaggleDataEvent\n");
		var doc = aEvent.target;
		var data = doc.defaultView.wrappedJSObject.gaggleDataForFiregoose;
		dump("data = " + data + "\n");
		for (var i in data) {
			dump(i + " => " + data[i] + "\n");
		}
	*/
		this.scanPage(aEvent.target);
	},

	onPageLoad: function(aEvent) {
	    //dump("\n\n===> !!Page loaded...\n");
	    //var doc = aEvent.originalTarget; // doc is document that triggered the event
        //var win = doc.defaultView; // win is the window for the doc
        //alert("page is loaded \n" +doc.location.href);
        //dump("\n" + doc);
	    //FG_generateAppletCode(doc, win);

		if (aEvent.originalTarget.nodeName == "#document") {
			dump("on page load event\n");
			var doc = aEvent.originalTarget;
            var clearPageData = true;
            
            // FG_trace("page load event:");
            // FG_trace(aEvent.target.location.href);
            // FG_trace(aEvent.originalTarget.location.href);

            // For frames, we want all the frames to be scanned and any resulting
            // gaggle data to appear in the drop-down. Here's we're detecting
            // the root document and setting clearPageData to false if
            // we're loading frames with a common root document. We the root
            // document shows up, which should be last, I think??, we clear
            // the root_document.
            // https://developer.mozilla.org/en/XUL_School/Intercepting_Page_Loads

            if (doc.defaultView.frameElement) {
                var parent = doc.defaultView.frameElement.ownerDocument;
                while (parent.defaultView.frameElement) {
                    parent = parent.defaultView.frameElement.ownerDocument;
                }
                if (this.root_document == parent) {
                    clearPageData = false;
                }
                else {
                    this.root_document = parent;
                }
            }
            else {
                if (this.root_document == doc) {
                    clearPageData = false;
                }
                this.root_document = null;
            }
            

			// Apparently google charts causes a page load event when rendering a chart.
			// the only thing in the body of the resulting doc is <div id="chartArea"></div>.
			// This is a problem because scanning this document yields a "-- no data --" in
			// the broadcast chooser, which was a bug for Dan's Maggie Data Viewer. It's
			// kinda hard to tell these load events from real ones, but here's an attempt:

			// ignore page load events from google charts
			if (doc.getElementById("chartArea") && doc.getElementsByTagName("div").length==1) {
				if (FG_util.trim(doc.body.innerHTML)=="<div id=\"chartArea\"></div>")
					return;
			}


            //FG_trace("before initial scanPage");
            
            
            try {
    			this.scanPage(doc, clearPageData);

    			// If this is the workflow page, and we are collecting data, then we inject the data
    			// to the page
    			if (FG_sendDataToWorkflow)
    			{
    			    InjectWorkflowData();
    			    FG_sendDataToWorkflow = false;
    			}
            } catch (error) {
                FG_trace("scanPage in onPageLoad() failed");
                FG_trace(error);
            }
            
            
            //FG_trace("before initial scanPage");

			// add a data event listener so the page can generate
			// gaggleDataEvents to indicate that data has been loaded
			// into the page in some ajaxy way.
			
			//FG_trace("before add gaggleDataEvent listener");
			
			doc.addEventListener("gaggleDataEvent",
				function(aEvent) { FG_pageListener.dataEventListener(aEvent); }, false, true);
						        
		    //FG_trace("after add gaggleDataEvent listener");

			
			// addEventListener registers a single event listener on a single target
			// target.addEventListener(type, listener, useCapture [, aWantsUntrusted] ); 
			//   type        A string representing the event type to listen for.
			//   listener    The object that receives a notification when an event of the
			//		               specified type occurs. This must be an object implementing
			//		               the EventListener interface, or simply a JavaScript function.
			//   useCapture  If true, useCapture indicates that the user wishes to
			//		               initiate capture. After initiating capture, all events of the
			//		               specified type will be dispatched to the registered listener
			//		               before being dispatched to any EventTargets beneath it in the
			//		               DOM tree. Events which are bubbling upward through the tree
			//		               will not trigger a listener designated to use capture. See
			//		               DOM Level 3 Events for a detailed explanation.
			//   aWantsUntrusted
			//		               Non-standard
			//		               If true, the event can be triggered by untrusted content.
			//		               See Interaction between privileged and non-privileged pages.

			// doc.addEventListener("gaggleDataEvent", myListener, false, true);

			// in the page, do this:
			// var ev = document.createEvent("Events");
			// // initEvent(eventType, canBubble, cancelable)
			// ev.initEvent("gaggleDataEvent", true, false); 
			// document.dispatchEvent(ev);

			
			
			// another option would be to register a callback in the page
			// something like this and have the page call it directly.
//			if (window.content.wrappedJSObject) {
//				window.content.wrappedJSObject.FG_gaggleCallBack = this;
//			}
		}
	}
}

// Lazy loading java goose object:
// Firefox takes forever to start up, largely due the century it takes for the JVM to start up.
// We need the JVM to broadcast, of course, but also to create Gaggle data structures which are
// used as intermediaries even between one web page and another (for networks and matrices, for
// example). Lazy loading the java goose object would be nice, at least in the case where the
// toolbar is closed. To do that, we need:
//  1. to know whether the toolbar is visible when FF starts
//  2. an event when it becomes visible later
//  3. start the pollGoose timer at that time (or move away from polling)
//  4. make sure we don't access javaFiregooseLoader before it's initialized


/**
 * initialize event listeners and try to connect to the gaggle
 */
function FG_initialize() {

	try {
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].
				getService(Components.interfaces.nsIPrefBranch);

		try {
			var defaultMode = prefs.getCharPref("extension.firegoose.defaults.mode");
			var defaultSpecies = prefs.getCharPref("extension.firegoose.defaults.species");
			
			dump("defaultSpecies = " + defaultSpecies + "\n");

			if (defaultMode)
				FG_default.mode = defaultMode;
			if (defaultSpecies)
				FG_default.species = defaultSpecies;
		}
		catch (e) {
			// if those prefs don't exist, an exception is thrown.
			FG_trace("No setting for default species?\n" + e);
		}

        //add custom websites created previously
        loadPreviouslyCreatedCustomWebsiteHandlers();

        //Application.activeWindow.events.addListener("TabOpen", TabOpenHandler);


		try {
         // get the preferences setting for autoStartBoss
         var autoStartBoss = prefs.getBoolPref("extension.firegoose.autoStartBoss");

			// set the autoStartBoss option in the Goose
			var goose = javaFiregooseLoader.getGoose();
			goose.setAutoStartBoss(autoStartBoss);
		}
		catch (e) {
			FG_trace("No setting for autoStartBoss?\n" + e);
		}

	}
	catch (e) {
		FG_trace("Error initializing preferences service:\n" + e);
	}

	try
	{
		var javaVersion = java.lang.System.getProperty("java.version");
		dump("java version = " + javaVersion  + "\n");
	}
	catch (e)
	{
		dump(e + "\n");
	}

	// disconnect from Gaggle on shutdown
	var quitObserver =
	{
	    observe: function(subject, topic, data)
	    {
	        dump(topic + "\n");
	        if (topic == "quit-application-granted") {
	            this.unregister();
	            try {
			    	      var goose = javaFiregooseLoader.getGoose();
			    	      goose.disconnectFromGaggle();
	            }
	            catch (e) {
	            	  dump("attempt to disconnect from Gaggle failed:\n");
	            	  dump(e);
	            }
	        }
	    },

	    register: function()
	    {
	        var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	        observerService.addObserver(this, "quit-application-granted", false);
	    },

	    unregister: function()
	    {
	        var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	        observerService.removeObserver(this,"quit-application-granted");
	    }
	}


	window.addEventListener("load", function() { FG_registerPageListeners(); }, false);
	window.addEventListener("load", function() { FG_connectToGaggle(true); }, false);
	window.addEventListener("load", function() { FG_registerTargetChangeListener(); }, false);
	window.addEventListener("load", function() { FG_initUI(); }, false);
	window.addEventListener("load", function() { quitObserver.register(); }, false);


//	var goose = javaFiregooseLoader.createJavaFiregooseObject();
//	goose.setDebugToFile(true);
}

/**
 * register listeners that cause the page to be scanned whenever a
 * new page is loaded and when the user switches to a new browser tab.
 * Note that this misses some cases, for instance use of the back button.
 */
function FG_registerPageListeners() {
	// add listener for page load events
	var appcontent = document.getElementById("appcontent");
	if (appcontent)
		appcontent.addEventListener("load", function(aEvent) { FG_pageListener.onPageLoad(aEvent); }, true);
	else
		FG_trace("Warning: unable to register page load listener");

	// add listener for tab select events
	var tabs = document.getElementById("content").tabContainer;
	if (tabs)
	{
		tabs.addEventListener("select", function(aEvent) { FG_pageListener.onTabSelect(aEvent); }, true);
    }
	else
		FG_trace("Warning: unable to register tab select listener");

	FG_trace("registered Page Listeners...");
}


/**
 * add a website handler which knows how to recognize
 * pages and scrape their contents. Whenever a page is
 * loaded or selected the website handlers are invoked
 * to see if there are contents to be scraped.
 */
function FG_addWebsiteHandler(name, websiteHandler) {
	dump("Firegoose registering handler: " + name + "\n");
	FG_websiteHandlers[name] = websiteHandler;
}


function FG_gaggleWebsite() {
	var url = "http://gaggle.systemsbiology.net/";
	var newTab = getBrowser().addTab(url);
	getBrowser().selectedTab = newTab;
}

function FG_accessGaggleTools() {
	var url = "http://gaggle.systemsbiology.net/2007-04/blankslate.php";
	var newTab = getBrowser().addTab(url);
	getBrowser().selectedTab = newTab;
}


/**
 * add a listener to the target chooser that pops up the enableWebsites
 * menu when the user selects "More...".
 */
function FG_registerTargetChangeListener() {

	var onChangeTarget = function() {
		var webSiteChooser = document.getElementById("fg_targetChooser");
		var websiteName = webSiteChooser.getAttribute("label");
		if (websiteName == "More...")
			FG_enableWebsites();
        if (websiteName == "Add Custom...")
			FG_createNewWebsiteHandler();

		FG_adjustUi();
	}

	var targetChooser = document.getElementById("fg_targetChooser");
	targetChooser.addEventListener("ValueChange", onChangeTarget, false);

	FG_trace("registered target change listener");
}

/**
 * adjusts UI for user preferences and initial connection status.
 * This has to be done in a callback so that the UI components
 * will be created first, before we start mucking about with
 * their properties.
 */
function FG_initUI() {
      dump("\ninit UI...");
	  FG_isConnected = FG_isConnectedToGaggle();

	  try {
		    var prefs = Components.classes["@mozilla.org/preferences-service;1"].
				    getService(Components.interfaces.nsIPrefBranch);

		    // get the preferences setting for autoStartBoss
		    var autoStartBoss = prefs.getBoolPref("extension.firegoose.autoStartBoss");

		    // check the menu item for autoStartBoss
		    if (autoStartBoss) {
			      var autoStartBossMenuItem = document.getElementById("fg_autoStartBoss");
			      autoStartBossMenuItem.setAttribute("checked", "true");
		    }
	  } catch (e) {
		    FG_trace("Error reading setting for autoStartBoss:\n" + e);
	  }
	  FG_adjustUi();
	  FG_populateTargetChooser();

	  // I used to start and stop the polling when we connected
	  // and disconnected with the boss, but that caused problems
	  // with multiple windows. If one window initiated a
	  // connection, the other(s) wouldn't realized they were
	  // connected. So, now we just start the timer and leave
	  // it running whether connected or not.
	  FG_startTimedEvent();
	  FG_trace("finished initUI");
}

function FG_startTimedEvent() {
    dump("Starting polling...");
	FG_timerIntervalId = setTimeout('FG_pollGoose()', 2000); //setInterval('FG_pollGoose()', 5000);
}

function FG_clearTimedEvent() {
	if (FG_timerIntervalId) {
		clearInterval(FG_timerIntervalId);
	}
}

/**
 * log a message to the javascript console
 * TODO: move to util
 */
function FG_trace(msg) {
	dump(msg + "\n");
    Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(msg);
}

function FG_hello() {
	alert("hello");
	FG_trace("hello");
}


function FG_test() {
	FG_trace("test");

	var params = {inn:{message:"Downloading network from STRING; please wait..."}, out:null};
	var w = window.openDialog('chrome://firegoose/content/progress.xul','Progress','chrome,centerscreen,alwaysRaised,resizable', params);

	FG_testTimerCounter = 0;
	FG_testTimer = setInterval(function() {
		w.document.incProgress(10);
		FG_testTimerCounter++;
		if (FG_testTimerCounter > 10) {
			clearInterval(FG_testTimer);
			w.close();
		}
	}, 1000);
}

function FG_objectToString(obj) {
	if (obj==null)
        return "null";
    var s = typeof(obj) + "(";
    for (var key in obj) {
        try {
            s = s + key + "=" + obj[key] + ",";
        } catch(e) {
            s = s + key + "=[ERROR],";
        }
    }
    if (s.length > 1)
		s = s.substring(0, s.length-1);
    return s + ")";
}


/**
 * pop up an alert with info about the JVM
 * being used in this browser. Useful for
 * diagnosing wrong JVM version problems.
 */
function FG_jvmInfo() {
    try {
        var sys = java.lang.System;
        if (sys) {
            var info = sys.getProperty("java.home") + "\n"
                    + sys.getProperty("java.vendor") + ", "
                    + sys.getProperty("java.version") + "\n"
                    + sys.getProperty("java.class.path");
            FG_trace(info);
            alert(info);
        }
        else {
            FG_trace("No Java VM found!");
            alert("No Java VM found!");
        }
    }
    catch(e) {
        FG_trace("No Java VM found: " + e);
        alert("No Java VM found: " + e);
    }
}


/**
 * get a string from firegoose.properties (under locale)
 */
function FG_getString(key) {
    try {
        return document.getElementById("strings_firegoose").getString(key);
    }
    catch(e) {
        return "";
    }
}


/**
 * open about box
 */
function FG_openAboutWindow() {
    var x = window.screenX + 200;
    var y = window.screenY + 100;
    var strWindowOptions = "chrome,screenX=" + x + ",screenY=" + y
    window.open("chrome://firegoose/content/about.xul", null, strWindowOptions, null);
}


/**
 * open a browser window with a help page
 */
function FG_help() {
    // open the kegg URL in a new tab
    var newTab = getBrowser().addTab("http://gaggle.systemsbiology.org/docs/geese/firegoose/");
    getBrowser().selectedTab = newTab;
}

function FG_openTab(uri)
{
    var newTab = getBrowser().addTab(uri);
    getBrowser().selectedTab = newTab;
}


/**
 * Open species dialog. There are two species the user can set: the one in
 * current page data, and the one in any incoming data from the gaggle.
 */
function FG_openSpeciesDialog() {

    var params = new Object();
    var goose = javaFiregooseLoader.getGoose();

    // try to get species from a few different sources.
    params.species = FG_default.species;
    if (params.species == null || params.species == "unknown") {
        params.species = goose.getSpecies();
    }
    if (params.species == null || params.species == "unknown") {
        params.species = FG_getPageSpecies();
    }
    if (FG_default.mode) {
        params.mode = FG_default.mode;
    }

    window.openDialog("chrome://firegoose/content/species.xul", "speciesDialog",
            "modal,centerscreen,chrome,resizable=no", params);

    // if dialog accepted, handle return values
    if (params.outMode) {
        if (params.outMode == "default" || params.outMode == "force") {
            FG_default.mode = params.outMode;
            FG_default.species = params.outSpecies;
            FG_default.temp = false;
        }
        else if (params.outMode == "reset") {
            FG_default = {species : "unknown", mode : "default"};
        }
        else if (params.outMode == "temp") {
                FG_default.temp = true;
                FG_default.tempSpecies = params.outSpecies;
            }

        // save default preferences if requested
        if (params.outMode != "temp" && params.outRemember) {
            var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefBranch);
            prefs.setCharPref("extension.firegoose.defaults.mode", FG_default.mode);
            prefs.setCharPref("extension.firegoose.defaults.species", FG_default.species);
        }
    }
}


/**
 * returns the current species with defaulting
 */
function FG_getPageSpecies() {
    FG_applyDefaultSpecies(FG_gaggleDataHolder.getSpecies());
}



/**
 * takes a species and applies defaulting to it, if
 * necessary according to the correct defaulting policy.
 */
function FG_applyDefaultSpecies(species, firstName) {
    // keep in mind that species may be a Java String or
    // a javascript string.
    //dump(":::species = " + species + "\n");
    if (FG_default.temp) {
        //dump("temp species = " + FG_default.tempSpecies + "\n");
        FG_default.temp = false;
        return FG_default.tempSpecies;
    }
    if (FG_default.mode == "force") {
        //dump("force species = " + FG_default.species + "\n");
        return FG_default.species;
    }
    if (species && species != "" && species != "unknown") {
        //dump("species = " + species + "\n");
        return species;
    }

    // hack to use IDs to figure out species for a few selected bugs
    if (firstName) {
		var tag = firstName.substring(0,3).toLowerCase();
		if (tag=="vng") return "Halobacterium sp. NRC-1";
		if (tag=="mmp") return "Methanococcus maripaludis S2";
		if (tag=="sso") return "Sulfolobus solfataricus";
		tag = firstName.substring(0,2).toLowerCase();
		if (tag=="pf") return "Pyrococcus furiosus";
		if (tag=="oe") return "Halobacterium salinarum R1";
    }

    if (FG_default.mode == "default") {
        //dump("default species = " + FG_default.species + "\n");
        return FG_default.species;
    }

    return "unknown";
}


// hack: over-ride species defaulting behavior of FG_GaggleData
FG_GaggleData.prototype._applyDefaultSpecies = FG_applyDefaultSpecies;


/**
 * broadcast gaggle data to the selected target.
 */
function FG_broadcast() {
    var targetChooser = document.getElementById("fg_targetChooser");
    if (targetChooser.selectedIndex == -1) {
        FG_trace("Can't broadcast: No target selected");
        return;
    }
    var broadcastChooser = document.getElementById("fg_broadcastChooser");
    if (broadcastChooser.selectedIndex == -1) {
        FG_trace("Can't broadcast: No broadcast data selected");
        return;
    }

    var target = targetChooser.selectedItem.getAttribute("label");
    var targetType = targetChooser.selectedItem.getAttribute("type");
    var broadcastData = FG_gaggleDataHolder.get(broadcastChooser.selectedItem.getAttribute("value"));

    if (!broadcastData) {
        FG_trace("Can't broadcast: No broadcast data found");
        return;
    }

    dump("broadcasting: " + broadcastData.getDescription() + " to " + target + "\n\n");
	FG_trace("broadcasting: "  + broadcastData.getDescription() + " to " + target + "\n\n");

    // There are a couple of funny aspects to how a broadcast takes place. The first is that
    // we may want to be lazy about acquiring data from a page. Why bother acquiring data until
    // the time that it's about to be broadcast? So, to do that, some of the handlers override
    // the getData function on FG_GaggleData. One step further is the case of making a web
    // service call, which is asynchronous, which is covered by the following lines of code.
    // I'm not having both of these mechanisms is a good idea, since the asynchronous case
    // could certainly be used for lazy-scraping, but it's there for the time being...

    // the data might be fetched by an asynchronous call (to a web service for instance).
    // If that's the case, we signal it by the isAsynch property and then perform the
    // asynchronous call passing a call-back to do the actual broadcast whenever the
    // call completes. If there's no asynchrony involved, we just go ahead and broadcast.
    if (broadcastData.isAsynch) {
        dump("fetching data asynchronously...\n");
        broadcastData.asynchronouslyFetchData(
                function() {
                    FG_dispatchBroadcast(broadcastData, target, targetType);
                });
    }
    else {
        FG_dispatchBroadcast(broadcastData, target, targetType);
    }

}


/**
 * Perform the appropriate kind of broadcast based on the type
 * of target (goose or website)
 */
function FG_dispatchBroadcast(broadcastData, target, targetType) {
    // if target is a website, look up its handler and broadcast
    if (targetType == "Website") {
        FG_dispatchBroadcastToWebsite(broadcastData, target);
    }

    // if target is a goose
    else if (targetType == "GaggleGoose") {
        FG_dispatchBroadcastToGoose(broadcastData, target);
    }
}

// TODO the handler.handleXXX methods and the goose.broadcastXXX methods
// need some rethinking and simplifying. They're something of a mess.


// Associate data to the tab created by a web handler
// The data will be serialized during state saving
function FG_attachTabData(newtab, target, broadcastData)
{
    if (newtab != null && broadcastData != null)
    {
        dump("\n\n\n\nSetting tab value: " + target);
        //if (tabvalue == null)
        tabvalue = "";
        //dump("\nhandler: " + tabvalue["handler"]);
        tabvalue += (target);
        tabvalue += (";;" + FG_gaggleDataHolder.getBroadcastDataLength());
        newtab.value = tabvalue;
        dump("\nAttached tab data: " + newtab.value);
    }
}


/**
 * Broadcast one of the gaggle data types to a website.
 */
function FG_dispatchBroadcastToWebsite(broadcastData, target) {
    var handler = FG_websiteHandlers[target];
    var datatype = broadcastData.getType();
    dump("\nWeb handler: " + handler);
    dump("\ndata type " + datatype);
    dump("\ntarget: " + target);
    dump("\nData: " + broadcastData.getData());

    // Store the data to the queue for saving state purpose
    FG_gaggleDataHolder.putBroadcastData(broadcastData);

    var goose = javaFiregooseLoader.getGoose();
    var url = null;
    var browser = gBrowser.selectedBrowser;
    url = browser.currentURI.spec;
    dump("\nCurrent URL: " + url);
    var newtab = null;

    try {
    if (datatype.toLowerCase() == "namelist") {
        dump("\nHandle namelist\n");
        if (handler.handleNameList) {
            dump("Can handle namelist");
            //if (goose != null)
            //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Namelist\"}");
            newtab = handler.handleNameList(broadcastData.getSpecies(), broadcastData.getData());
            FG_attachTabData(newtab, target, broadcastData);
        }
    }
    else if (datatype.toLowerCase() == "map") {
        if (handler.handleMap) {
            //if (goose != null)
            //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Map\"}");
            newtab = handler.handleMap(
                    broadcastData.getSpecies(),
                    broadcastData.getName(),
                    FG_objectToJavaHashMap(data));
            FG_attachTabData(newtab, target, broadcastData);
        }
    }
    else if (datatype.toLowerCase() == "network") {
            if (handler.handleNetwork) {
                //if (goose != null)
                //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Network\"}");
                newtab = handler.handleNetwork(broadcastData.getSpecies(), broadcastData.getData());
                FG_attachTabData(newtab, target, broadcastData);
            }
            // if target doesn't take a network, use node names as a name list
            else if (handler.handleNameList) {
                var names = broadcastData.getDataAsNameList();
                if (names)
                {
                    //if (goose != null)
                    //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Namelist\"}");
                    newtab = handler.handleNameList(broadcastData.getSpecies(), names);
                    FG_attachTabData(newtab, target, broadcastData);
                }
            }
    }
    else if (datatype.toLowerCase() == "datamatrix") {
            if (handler.handleMatrix) {
                //if (goose != null)
                //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Matrix\"}");
                newtab = handler.handleMatrix(broadcastData);
                FG_attachTabData(newtab, target, broadcastData);
            }
            // if target doesn't take a matrix, use row names as a name list
            else if (handler.handleNameList) {
                var names = broadcastData.getDataAsNameList();
                if (names)
                {
                    //if (goose != null)
                    //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Namelist\"}");
                    newtab = handler.handleNameList(broadcastData.getSpecies(), names);
                    FG_attachTabData(newtab, target, broadcastData);
                }
            }
    }
    else if (datatype.toLowerCase() == "cluster") {
            dump("\nHandle cluster\n");
            if (handler.handleCluster) {
                dump("STARTING Handle cluster\n");
                //if (goose != null)
                //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Cluster\"}");
                newtab = handler.handleCluster(
                        broadcastData.getSpecies(),
                        broadcastData.getName(),
                        broadcastData.rowNames,
                        broadcastData.columnNames);
                FG_attachTabData(newtab, target, broadcastData);
            }
            // if target doesn't take a cluster, use row names as a name list
            else if (handler.handleNameList) {
                var names = broadcastData.getDataAsNameList();
                if (names)
                {
                    //if (goose != null)
                    //    goose.recordWorkflow(null, url, target, "{\"datatype\":\"Namelist\"}");
                    newtab = handler.handleNameList(broadcastData.getSpecies(), names);
                    FG_attachTabData(newtab, target, broadcastData);
                }
            }
            dump("Cluster handled.");
    }
    }
    catch (e) {
        dump("\n\nFailed to handle data: " + e);
    }
    return newtab;
}


/**
 * Broadcast one of the gaggle data types over RMI to a goose.
 */
function FG_dispatchBroadcastToGoose(broadcastData, target) {
    var goose = javaFiregooseLoader.getGoose();

    var browser = gBrowser.selectedBrowser;
    url = browser.currentURI.spec;
    dump("\nCurrent URL: " + url + "\n");

    // one thing to be careful about here is the species defaulting
    // behavior defined in this file that overrides the default
    // behavior of the GaggleData object. The java objects should
    // get the species that comes from the over-ridden method with
    // proper defaulting.
    try
    {
        if (broadcastData.getType() == "NameList") {
            dump("\nbroadcasting some identifiers to " + target + " " + broadcastData.getData() + "\n");
            var javaArray = javaFiregooseLoader.jsStringArrayToDelimitedString(broadcastData.getData(), ";");
            dump("\n\n\nData: " + javaArray);
              //.toJavaStringArray(broadcastData.getData());
            goose.broadcastNameList(target, broadcastData.getName(), broadcastData.getSpecies(), javaArray, ";");
            //goose.recordWorkflow(target, url, null, "{\"datatype\":\"Namelist\"}");
        }
        else if (broadcastData.getType() == "Map") {
            goose.broadcastMap(
                    target,
                    broadcastData.getSpecies(),
                    broadcastData.getName(),
                    FG_objectToJavaHashMap(broadcastData.getData()));
            //goose.recordWorkflow(target, url, null, "{\"datatype\":\"Map\"}");
        }
        else if (broadcastData.getType() == "Network") {
                // network is a java object
                var network = broadcastData.getData();
                // TODO is this necessary? apply defaulting to species
                network.setSpecies(broadcastData.getSpecies());
                goose.broadcastNetwork(target, network);
                //goose.recordWorkflow(target, url, null, "{\"datatype\":\"Network\"}");
            }
            else if (broadcastData.getType() == "DataMatrix") {
                    // matrix is a java object
                    var matrix = broadcastData.getData();
                    // TODO is this necessary? apply defaulting to species
                    matrix.setSpecies(broadcastData.getSpecies());
                    goose.broadcastDataMatrix(target, matrix);
                    //goose.recordWorkflow(target, url, null, "{\"datatype\":\"Matrix\"}");
                }
                else if (broadcastData.getType() == "Cluster") {
                        goose.broadcastCluster(
                                target,
                                broadcastData.getSpecies(),
                                broadcastData.getName(),
                                broadcastData.getData().rowNames,
                                broadcastData.getData().columnNames);
                        //goose.recordWorkflow(target, url, null, "{\"datatype\":\"Cluster\"}");
                    }
                    else {
                        FG_trace("Error in FG_dispatchBroadcastToGoose(broadcastData, target): Unknown data type: \"" + broadcastData.getType() + "\"");
                    }
    }
    catch (e) {
        dump("\n\n!!!!!Failed to broadcast: " + e);
    }

}


/**
 * convert a javascript object with String keys and String properties
 * to a java HashMap.
 */
function FG_objectToJavaHashMap(map) {
    var hashMap = new java.util.HashMap();
    for (var key in map) {
        //dump(key + " -> " + map[key] + "\n");
        hashMap.put(key, map[key]);
    }
    return hashMap;
}

function FG_objectToJavaTuple(object) {

}


function FG_isConnectedToGaggle() {
    var goose = FG_Goose; //javaFiregooseLoader.getGoose();
    return goose ? goose.isConnected() : false;
}


/**
 * Connect to the gaggle if we're not connected already
 * otherwise update the goose chooser list
 */
function FG_connectOrUpdate() {
    if (!FG_isConnectedToGaggle()) {
        FG_connectToGaggle();
    } else {
        FG_populateTargetChooser();
    }
}

/**
 * connect to gaggle if we're not connected
 * already
 */
function FG_connectToGaggle(initializingFiregoose) {
    try {
        dump("\n=========>>>Connecting to Gaggle....\n");
        if (FG_isConnectedToGaggle()) {
            // don't reconnect if already connected
            FG_trace("connectToGaggle: already connected to Gaggle");
        } else {
            var goose = javaFiregooseLoader.getGoose();
            FG_trace("connectToGaggle: connecting to Gaggle");
            if (goose) {
                // try to connect
                // The behavior I want here differs from the autostart behavior
                // defined in RmiGaggleConnector. If a boss is running
                // when Firegoose starts, connect to it. If the preference
                // extension.firegoose.autoStartBoss is set, autostart a
                // boss when Firegoose starts, otherwise don't. When the
                // user clicks "Connect to Gaggle" always use the autostart
                // behavior.
                if (initializingFiregoose && !FG_getAutoStartBoss()) {
                    dump("\nCalling connectToGaggleIfAvaiable\n");
                    goose.connectToGaggleIfAvailable();
                } else {
                    dump("\nCalling connectToGaggle\n");
                    goose.connectToGaggle();
                }

                // this should throw an exception if connection failed, but
                // apparently it gets eaten somewhere.
                // did connecting fail? If we're auto-starting the boss
                // should start shortly, but probably won't be started yet.
                if (!goose.getAutoStartBoss() && !goose.isConnected()) {
                    throw new Error("Failed to connect to the Gaggle");
                }
            }
            else
                dump("\nGoose is not ready!!\n");
        }
    } catch (e) {
        FG_trace(e);
        if (!initializingFiregoose) {
            alert("failed to connect to gaggle");
        }
    }
    // adjust the UI
    //  FG_adjustUi();
    //	FG_populateTargetChooser();
}


function FG_disconnectFromGaggle() {
    // stop polling for broadcasts
    //FG_clearTimedEvent();

    FG_trace("disconnectFromGaggle");
    var goose = javaFiregooseLoader.getGoose();
    goose.disconnectFromGaggle();

    FG_adjustUi();
    FG_populateTargetChooser();
}

// controls whether to automatically start the Boss when
// Firegoose starts. This is a slightly different meaning
// than the autostart feature in RmiGaggleConnector. We
// will set autostart on in the connector always.
function FG_updateAutoStartBoss(autoStartBoss) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].
            getService(Components.interfaces.nsIPrefBranch);
    prefs.setBoolPref("extension.firegoose.autoStartBoss", autoStartBoss);
}

function FG_getAutoStartBoss() {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].
            getService(Components.interfaces.nsIPrefBranch);
    return prefs.getBoolPref("extension.firegoose.autoStartBoss");
}



/**
 * adjust the UI to reflect connection status and available
 * page data
 */
function FG_adjustUi() {
    var connected = FG_isConnectedToGaggle();

    // to enable a command you set the attribute "disabled"
    // to the string "false". To disable, set "disabled" to "true"
    var enabled = "false";
    var disabled = "true";

    // for controls that are enabled when connected
    var enabledWhenConnected = connected ? enabled : disabled;

    // for controls that are disabled when connected
    var disabledWhenConnected = connected ? disabled : enabled;

    // enable the show button if we're connected or we've selected
    // a target website that has a show method
    var enabledShow = enabledWhenConnected;
    var targetChooser = document.getElementById("fg_targetChooser");
    if (targetChooser.selectedItem) {
        var targetType = targetChooser.selectedItem.getAttribute("type");
        if (targetType == "Website") {
            var website = targetChooser.selectedItem.getAttribute("label");
            var handler = FG_websiteHandlers[website];
            if (handler.show)
                enabledShow = enabled;
            else
                enabledShow = disabled;
        }
    }

    // show and hide buttons
    var cmd = document.getElementById("fgcmd_showGoose");
    cmd.setAttribute("disabled", enabledShow);
    var cmd = document.getElementById("fgcmd_hideGoose");
    cmd.setAttribute("disabled", enabledWhenConnected);

    // connect, disconnect, and update
    var cmd = document.getElementById("fgcmd_connect");
    cmd.setAttribute("disabled", disabledWhenConnected);
    var cmd = document.getElementById("fgcmd_disconnect");
    cmd.setAttribute("disabled", enabledWhenConnected);
    var cmd = document.getElementById("fgcmd_update");
    cmd.setAttribute("disabled", enabledWhenConnected);

    var btn = document.getElementById("fg_registerOrUpdateButton");
    if (connected) {
        btn.setAttribute("tooltiptext", "Update list of geese");
    }
    else {
        btn.setAttribute("tooltiptext", "Connect to the Gaggle");
    }

    var status = document.getElementById("fg_statusLight");
    if (connected) {
        // display our goose name as a tooltip
        var goose = javaFiregooseLoader.getGoose();
        status.setAttribute("tooltiptext", "Connected as: " + goose.getName());
        status.setAttribute("src", "chrome://firegoose/skin/connected.png");
    }
    else {
        status.setAttribute("tooltiptext", "Not Connected");
        status.setAttribute("src", "chrome://firegoose/skin/disconnected.png");
    }

    var pnl = document.getElementById("fg_nextcomponents");
    pnl.style.backgroundColor = "white";

    FG_adjustBroadcastButton();
}


function FG_adjustBroadcastButton() {

    var targetChooser = document.getElementById("fg_targetChooser");
    dump("\nUser selected " + targetChooser.selectedIndex);

    if (targetChooser.selectedIndex > -1)
        var targetSelected = true;

    var broadcastChooser = document.getElementById("fg_broadcastChooser");
    if (broadcastChooser.selectedIndex > -1)
        var broadcastSelected = true;

    // adjust broadcast button
    var broadcastCmd = document.getElementById("fgcmd_broadcast");
    if (targetSelected && broadcastSelected) {
        broadcastCmd.setAttribute("disabled", "false");
    }
    else {
        broadcastCmd.setAttribute("disabled", "true");
    }
}

//
function FG_targetChosen()
{
    dump("\nBroadcast target picked...\n");
    var targetChooser = document.getElementById("fg_targetChooser");
    if (targetChooser.selectedIndex == 1)
    {
        // Get all the checked
        if (!FG_sendDataToWorkflow)
        {
            FG_sendDataToWorkflow = true;
            dump("\nSend to workflow page...\n");
            FG_workflowDataExtract("", "table");
        }
    }
    else
        FG_adjustBroadcastButton();
}

/**
 * ask the currently selected goose to show itself
 */
function FG_requestShow() {
    var targetChooser = document.getElementById("fg_targetChooser");
    if (targetChooser.selectedItem.getAttribute("type") == "GaggleGoose") {
        var gooseName = targetChooser.selectedItem.getAttribute("label");
        var goose = javaFiregooseLoader.getGoose();
        goose.showGoose(gooseName);
    }
    else {
        var website = targetChooser.selectedItem.getAttribute("label");
        var handler = FG_websiteHandlers[website];
        if (handler.show) {
            handler.show();
        }
    }
}


/**
 * ask the currently selected goose to hide
 */
function FG_requestHide() {
    var targetChooser = document.getElementById("fg_targetChooser");
    if (targetChooser.selectedItem.getAttribute("type") == "GaggleGoose") {
        var gooseName = targetChooser.selectedItem.getAttribute("label");
        var goose = javaFiregooseLoader.getGoose();
        goose.hideGoose(gooseName);
    }
}


/**
 * polls the Goose for incoming data. We use polling here, 'cause we
 * haven't figured out a means to call into javascript from java.
 */
function FG_pollGoose() {
    //dump("\nStart polling...\n");
    var connected = FG_isConnectedToGaggle();
    if (connected != FG_isConnected) {
        FG_adjustUi();
        FG_populateTargetChooser();
        FG_isConnected = connected;
        dump("\nFinished adjusting UI\n");
    }

    //alert(FG_Workflow_InProgress);
    //dump("FG_Workflow_InProgress: " + FG_Workflow_InProgress);
    if (connected && !FG_Workflow_InProgress) {
        var goose = javaFiregooseLoader.getGoose();
        if (FG_Current_GaggleData != null && FG_Current_Tab != null)
        {
            try
            {
                // We just processed some workflow data, we need to report to the server
                if (FG_Current_GaggleData.getType() == "WorkflowData")
                {
                    // This is a URL
                    var data = (FG_Current_GaggleData.getData())[0];
                    dump("\nSending workflow data " + data + "to server\n");
                    // Pass the url to the goose, which will pass it to the boss, which will pass it to the server
                    goose.saveWorkflowData(FG_Current_GaggleData.getRequestID(), "Firegoose", data);
                }
                else
                {
                    // Pass the url to the goose, which will pass it to the boss, which will pass it to the server
                    var browser = gBrowser.getBrowserForTab(FG_Current_Tab);
                    var uri = browser.currentURI.spec;
                    if (FG_Current_WebHandlerReportUrl != null)
                        uri = FG_Current_WebHandlerReportUrl;
                    dump("\nurl to be saved as report: " + uri + "\n");
                    componentname = "Firegoose " + FG_Current_GaggleData.getSubAction();
                    goose.saveWorkflowData(FG_Current_GaggleData.getRequestID(), componentname, uri);
                }
                FG_Current_GaggleData = null;
                FG_Current_WebHandlerReportUrl = null;
            }
            catch(e)
            {
                dump("\nFailed to send workflow data: " + e.message +"\n");
            }
        }

        // Process workflow requests
        //dump("\nRetrieving workflow request...\n");
        var requestID = goose.getWorkflowRequest();
        //dump("Polling RequestID: " + requestID + "\n");
        if (requestID != undefined && requestID != null)
        {
            var gaggleWorkflowData = new FG_GaggleWorkflowDataFromGoose();
            if (gaggleWorkflowData != null)
            {
                FG_Current_GaggleData = gaggleWorkflowData;
                gaggleWorkflowData.setRequestID(requestID);
                dump("\nSetting requestID..." + requestID);
                FG_WorkflowDataReceived(gaggleWorkflowData, goose);
            }
            //goose.removeWorkflowRequest(requestID);
        }

        // Save state
        if (goose.getSaveStateFlag())
        {
            goose.setSaveStateFlag(false);
            dump("\nSaving state " + goose.getSaveStateFileName());
            FG_saveState(goose);
        }

        // Load State
        if (goose.getLoadStateFlag())
        {
            goose.setLoadStateFlag(false);
            dump("\nLoading state " + goose.getLoadStateFileName());
            FG_loadState(goose);
        }

        // we want to check if there's new data from the Gaggle,
        // and if not don't bother doing anything, otherwise we'll
        // be updating the GUI every second, which isn't too cool.
        var value = goose.checkNewDataSignal();
        //dump("\nNew signal value: " + value + " Previous value: " + FG_previousNewDataSignalValue + "\n");
        if (value > FG_previousNewDataSignalValue) {
            FG_previousNewDataSignalValue = value;
            var gaggleData = new FG_GaggleDataFromGoose();
            FG_gaggleDataHolder.put(gaggleData);
            FG_populateBroadcastChooser(gaggleData.getDescription());
        }
        var value = goose.checkTargetUpdateSignal();
        if (value > FG_previousTargetUpdateSignalValue) {
            FG_previousTargetUpdateSignalValue = value;
            FG_populateTargetChooser();
        }
    }
    setTimeout('FG_pollGoose()', 2000);
}

/**
 * Implements the same interface as a FG_GaggleData object, but
 * delegates calls to the java goose to get data from a gaggle
 * broadcast.
 * TODO: This is not very threadsafe which could cause errors.
 */
function FG_GaggleDataFromGoose() {
}

// the name "gaggle" is required for a cheap and sleazy hack in FG_gaggleDataHolder
FG_GaggleDataFromGoose.prototype = new FG_GaggleData("gaggle");

FG_GaggleDataFromGoose.prototype.getType = function() {
    var goose = javaFiregooseLoader.getGoose();
    return goose.getType();
}

FG_GaggleDataFromGoose.prototype.getSize = function() {
    var goose = javaFiregooseLoader.getGoose();
    return goose.getSize();
}

FG_GaggleDataFromGoose.prototype.getSpecies = function() {
    var goose = javaFiregooseLoader.getGoose();
    var names = goose.getNameList();
    if (names && names.length > 0)
        var species = FG_applyDefaultSpecies(goose.getSpecies(), names[0]);
    else
        var species = FG_applyDefaultSpecies(goose.getSpecies());
    return species;
}

FG_GaggleDataFromGoose.prototype.getData = function() {
    dump("GaggleDataFromGoose: getData...");
    var goose = javaFiregooseLoader.getGoose();
    var data = goose.getNameList();
    if (data != undefined && data.length != undefined)
    {
        for (var i = 0; i < data.length; i++)
        {
            dump("Namelist " + i + ": " + data[i] + "\n");
        }
    }
    return data;

    // TODO:  handle all data types here and in FireGoose.java
}

/**
 * adds entries to the Gaggle Data drop-down menu.
 * Entries can be (at most) one Gaggle data element received
 * as a broadcast from the Boss, plus zero or more data elements
 * from the currently visible web page. These come from scrapping
 * the page, calling associated web services, etc.
 *
 * This can silently fail to put anything in the chooser under some
 * circumstances that I don't understand. MDV's page load event for
 * example, in which case the google chart API is busy trying to
 * render a bunch of stuff.
 */
function FG_populateBroadcastChooser(itemToSelect) {
    var popup = document.getElementById("fg_broadcastChooserPopup");
    var chooser = document.getElementById("fg_broadcastChooser");

    // remember currently selected item
    if (!itemToSelect && chooser.selectedItem) {
        itemToSelect = chooser.selectedItem.label;
    }

    // delete existing menu items
    for (var i=popup.childNodes.length - 1; i>=0; i--) {
        popup.removeChild(popup.childNodes.item(i));
    }

    var descriptions = FG_gaggleDataHolder.getDescriptions();
    for (var i in descriptions) {
        var newMenuItem = document.createElement("menuitem");
        newMenuItem.setAttribute("label", descriptions[i]);
        newMenuItem.setAttribute("tooltiptext", descriptions[i]);
        newMenuItem.setAttribute("value", i);
        popup.appendChild(newMenuItem);
    }

    // select first item
    if (popup.childNodes.length > 0) {
        chooser.selectedIndex = 0;
    }
    else {
        var newMenuItem = document.createElement("menuitem");
        newMenuItem.setAttribute("label", "-- no data --");
        newMenuItem.setAttribute("tooltiptext", "Broadcastable data can be received from the Gaggle or found in Firegoose-readable web pages.");
        newMenuItem.setAttribute("value", -1);
        popup.appendChild(newMenuItem);
        chooser.selectedIndex = 0;
    }

    // select previously selected item or boss
    chooser.selectedIndex = 0;
    if (itemToSelect) {
	    for (var i=popup.childNodes.length - 1; i>=0; i--) {
            if (popup.childNodes.item(i).label == itemToSelect) {
                chooser.selectedIndex = i;
                break;
            }
        }
    }

    FG_adjustUi();
}


/**
 * called to update the list of possible target geese or websites
 * to which we can broadcast.
 */
function FG_populateTargetChooser() {
    var newMenuItem;
    var menulist = document.getElementById("fg_targetChooser");
    var popup = document.getElementById("fg_targetChooserPopup");

    // remember currently selected item
    var previouslySelectedItem = null;
    if (menulist.selectedItem) {
        previouslySelectedItem = menulist.selectedItem.label;
        // don't preserve a "More..." selection
		if (previouslySelectedItem && FG_util.startsWith(previouslySelectedItem.toLowerCase(), "more")
                || FG_util.startsWith(previouslySelectedItem.toLowerCase(), "add custom"))
            previouslySelectedItem = null;
    }

    // delete existing menu items
    for (var i = popup.childNodes.length - 1; i>=0; i--) {
        popup.removeChild(popup.childNodes.item(i));
    }

    if (FG_isConnectedToGaggle()) {
        var goose = javaFiregooseLoader.getGoose();
        // add "Boss" to popup menu
        newMenuItem = document.createElement("menuitem");
        newMenuItem.setAttribute("label", "Boss");
        newMenuItem.setAttribute("tooltiptext", "Send broadcasts to the Gaggle Boss");
        newMenuItem.setAttribute("type", "GaggleGoose");
        popup.appendChild(newMenuItem);

        // add new geese to popup menu
        var gooseNames = goose.getGooseNames();
	      for (var i=0; i<gooseNames.length; i++) {
            newMenuItem = document.createElement("menuitem");
            newMenuItem.setAttribute("label", gooseNames[i]);
            newMenuItem.setAttribute("tooltiptext", "Send broadcasts to " + gooseNames[i]);
            newMenuItem.setAttribute("type", "GaggleGoose");
            popup.appendChild(newMenuItem);
        }
    } else {
        var menuItem = document.createElement("menuitem");
        menuItem.setAttribute("label", "Not connected to Boss");
        menuItem.setAttribute("tooltiptext", "Not connected to Boss");
        popup.appendChild(menuItem);
    }

    // separator between geese and websites
    newMenuItem = document.createElement("separator");
    popup.appendChild(newMenuItem);

    // we can hide some of these using preferences
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].
            getService(Components.interfaces.nsIPrefBranch);

    function isVisible(name) {
        try {
            return prefs.getBoolPref(FG_fixName(name));
        } catch (e) {
            return true;
        }
    }

    var keys = [];
    for (var name in FG_websiteHandlers) {
        keys.push(name);
    }
    keys.sort();

    // add an item for each website handler
    for (var i in keys) {
        var name = keys[i];
        var handler = FG_websiteHandlers[name];
        if (!handler.dontDisplayInMenu && isVisible(name)) {
            newMenuItem = document.createElement("menuitem");
            newMenuItem.setAttribute("label", name);
            newMenuItem.setAttribute("tooltiptext", "Send broadcasts to " + name);
            newMenuItem.setAttribute("type", "Website");
            popup.appendChild(newMenuItem);
        }
    }

    // add groove separator
    var separator = document.createElement("menuseparator");
    separator.setAttribute("class", "groove");
    popup.appendChild(separator);

    // enable more websites
    var moreMenuItem = document.createElement("menuitem");
    moreMenuItem.setAttribute("label", "More...");
    moreMenuItem.setAttribute("tooltiptext", "Enable more website targets");
    popup.appendChild(moreMenuItem);

    // add custom website handler
    var moreMenuItem = document.createElement("menuitem");
    moreMenuItem.setAttribute("label", "Add Custom...");
    moreMenuItem.setAttribute("tooltiptext", "Add custom website target");
    popup.appendChild(moreMenuItem);

    // select previously selected item or boss
    menulist.selectedIndex = 0;
    if (previouslySelectedItem) {
	    for (var i=popup.childNodes.length - 1; i>=0; i--) {
            if (popup.childNodes.item(i).label && popup.childNodes.item(i).label == previouslySelectedItem) {
                menulist.selectedIndex = i;
                break;
            }
        }
    }

    FG_adjustUi();
}


/**
 * open the enable websites dialog.
 */
function FG_enableWebsites() {
    var params = new Object();
    params["websiteHandlers"] = FG_websiteHandlers;

    window.openDialog("chrome://firegoose/content/enableWebsites.xul", "enableWebsitesDialog",
            "modal,centerscreen,chrome", params);

    if (params["ok"])
        FG_populateTargetChooser();
    else {
        // select first item
        var menulist = document.getElementById("fg_webSiteChooser");
        menulist.selectedIndex = 0;
    }
}

/**
 * open the add new website dialog and
 * add the newly created websitehandler to the target list
 */
function FG_createNewWebsiteHandler() {
    var params = new Object();
    var newTargetName;
    var newTargetURL;
    var newTargetReceiveType;
    var newTargetReceiveingObjectsName;

    window.openDialog("chrome://firegoose/content/addWebsite.xul", "addWebsiteDialog",
            "modal,centerscreen,chrome", params);

    if (params["newTargetName"] != undefined && params["newTargetURL"] != undefined
            && params["newTargetReceiveType"] != null) {
        newTargetName = params["newTargetName"];
        newTargetURL = params["newTargetURL"];
        if (!FG_util.startsWith(newTargetURL, "http://"))
            newTargetURL = "http://" + newTargetURL;
        newTargetReceiveType = params["newTargetReceiveType"];
        newTargetReceiveingObjectsName = params["newTargetReceiveingObjectsName"];

        //add the new website handler to the list
        if (params["ok"]){
            //create new website handler
            var newWebsiteHandler = createNewWebsiteHandlerWithParameters(newTargetURL, newTargetName, newTargetReceiveType, newTargetReceiveingObjectsName)

            //add to FG Target list
            FG_addWebsiteHandler(newTargetName, newWebsiteHandler);
            FG_populateTargetChooser();

            //save in preferences
            saveNewWebsiteHandlerParameters(newTargetURL, newTargetName, newTargetReceiveType, newTargetReceiveingObjectsName)
        }
    }
}

/**
 * Creates and returns an new website handler object
 *
 * @param newTargetURL
 * @param newTargetName
 * @param newTargetReceiveType
 * @param newTargetReceiveingObjectsName
 */
function createNewWebsiteHandlerWithParameters(newTargetURL, newTargetName, newTargetReceiveType, newTargetReceiveingObjectsName){
    //create the new websitehandler
    var newWebsiteHandler = new Object();
    /**
     * check the given doc to see if we can parse it.
     */
    newWebsiteHandler.recognize = function(doc) {
        return false;
    };
    /**
     * add the websiteHandler's handleNameList function
     * depending on the type of the object that is awaiting
     * the broadcast
     */
    if (newTargetReceiveType == "jsObject") {
        /**
         * takes a species and a Java Array of names and submits them for
         * processing by the website.
         */
        newWebsiteHandler.handleNameList = function(species, names) {
            // since we're broadcasting to an open page, we don't want to open
            // a new page. This is no good from a security point of view.
            // Find the first tab with a page that implements a goose object
            // and call the handler method on the goose object.
            var found = false;
            var num = gBrowser.browsers.length;
            for (var i = 0; i < num; i++) {
                var browser = gBrowser.getBrowserAtIndex(i);
                var doc = browser.contentDocument;
                try {
                    if (FG_util.startsWith(doc.location.href, newTargetURL)
                            && browser.contentWindow.wrappedJSObject[newTargetReceiveingObjectsName] != null) {
                        gBrowser.tabContainer.selectedIndex = i;
                        var goose = browser.contentWindow.wrappedJSObject[newTargetReceiveingObjectsName];
                        goose.handleNameList(species, names);
                        found = true;
                        break;
                    }
                } catch(e) {
                    // wtf? Components.utils.reportError(e);
                    FG_trace(e);
                }
            }
            if (!found) {
                newWebsiteHandler.show();

                // create a poller object to be called from a timer
                var poller = new Object();
                poller.timerCount = 0;
                poller.species = species;
                poller.names = names;
                poller.browser = gBrowser.selectedBrowser;

                // the poll function checks for the presence of the receiving goose
                // and completes the broadcast when the receiving goose is ready
                poller.poll = function() {
                    poller.timerCount++;
                    //                            dump("polling for presence of PIPE goose: " + this.timerCount + "\n");
                    //                            dump("species = " + this.species + "\n");
                    //                            dump("namelist = " + this.names + "\n");

                    var goose = poller.browser.contentWindow.wrappedJSObject[newTargetReceiveingObjectsName];
                    if (goose) {
                        try {
                            goose.handleNameList(poller.species, poller.names);
                            clearInterval(this.timerId);
                        } catch(e) {
                            FG_trace("Error in page's goose.handleNameList(...): " + e);
                        }
                    } else if (poller.timerCount >= 10) {
                        clearInterval(poller.timerId);
                    }
                };

                // set a timer which calls the poller every second
                poller.timerId = setInterval(function() {
                    poller.poll();
                }, 1000);
            }
        };
    } else if (newTargetReceiveType == "urlEncoded") {
        newWebsiteHandler.handleNameList = function(species, names) {
            var url = newTargetURL + "?" + newTargetReceiveingObjectsName + "=";
            ;

            // semi-colon delimited list of gene names
            url += FG_util.join(names, "%3B");

            var newTab = getBrowser().addTab(url);
            getBrowser().selectedTab = newTab;
        };
    } else if (newTargetReceiveType == "domObject") {
        newWebsiteHandler.insertNamelistIntoPasteBox = function(doc) {
            var elements;
            if (!newWebsiteHandler.names) return;

            // put names in paste box
            elements = doc.getElementsByName(newTargetReceiveingObjectsName);
            if (elements) {
                // construct a string out of the name list
                elements[0].value = FG_util.join(newWebsiteHandler.names, "\n");
            }
        };

        newWebsiteHandler.handleNameList = function(species, names) {
            // store the species and names in this object
            newWebsiteHandler.species = species;
            newWebsiteHandler.names = names;

            var url = newTargetURL;
            var doc = window.content.document;
            var element = null;

            if (FG_util.startsWith(doc.location.href, newTargetURL)) {
                element = doc.getElementById(newTargetReceiveingObjectsName);
            }

            if (element) {
                newWebsiteHandler.insertNamelistIntoPasteBox(doc);
            } else {
                // open url in a new tab
                var newTab = getBrowser().addTab();
                var browser = getBrowser().getBrowserForTab(newTab);
                getBrowser().selectedTab = newTab;

                /**
                 * when we open PABST in a new tab, this event listener
                 * should be called. We have to pass in a reference to
                 * this object because the onPageLoad function will be
                 * passed as an event listener.
                 */
                newWebsiteHandler.onPageLoad = function(nwh, aEvent) {
                    if (aEvent.originalTarget.nodeName == "#document") {
                        var doc = window.content.document;
                        nwh.insertNamelistIntoPasteBox(doc);
                    }
                };

                // create a closure which preserves a reference to this
                // so the listener can remove itself after being called.
                // If the user browses away in the new browser, we don't
                // want to keep performing the onPageLoad action.
                newWebsiteHandler.onPageLoadClosure = function(aEvent) {
                    newWebsiteHandler.onPageLoad(newWebsiteHandler, aEvent);
                    // listener removes itself
                    browser.removeEventListener("load", newWebsiteHandler.onPageLoadClosure, true);
                };

                // register the closure as a listener
                browser.addEventListener("load", newWebsiteHandler.onPageLoadClosure, true);
                browser.loadURI(url);
            }
        };
    }
    /**
     * open the website in a browser tab
     */
    newWebsiteHandler.show = function() {
        var url = newTargetURL;
        var newTab = getBrowser().addTab(url);
        getBrowser().selectedTab = newTab;
    };
    newWebsiteHandler.getPageData = function(doc) {
        return null;
    };

    return newWebsiteHandler;
}

/**
 * search for the selected items in Entrez
 */
function FG_searchEntrezGene() {
    var nameList = FG_getSelectionAsNamelist();
    var entrezGeneHandler = FG_websiteHandlers["Entrez Gene"];
    entrezGeneHandler.handleNameList(FG_getPageSpecies(), nameList);
}


/**
 * capture the currently selected text, and query
 * entrez taxonomy for it
 */
function FG_searchEntrezTaxonomy() {
    var doc = window.content.document;
    var selection = doc.getSelection();

    var url = "http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=Taxonomy&cmd=search&term=" + selection

    // open the URL in a new tab
    var newTab = getBrowser().addTab(url);
    getBrowser().selectedTab = newTab;
}


/**
 * capture the currently selected text in the page
 * and treat it as a name list
 */
function FG_getSelectionAsNamelist() {
    var doc = window.content.document;
    var selection = doc.getSelection();

    var list;

    if (selection.indexOf(",") >= 0) {
        // split on comma delimiters
        list = selection.split(/\s*,\s*/);
    }
    else {
        // split on whitespace delimiters
        list = selection.split(/\s+/);
    }

    var results = [];
    for (var i in list) {
        var element = FG_util.trim(list[i]);
        if (element.length > 0 && element != "#")
            results.push(element);
    }
    return results;
}


/**
 * create a namelist out of the selected text
 * and allow it to be broadcast
 */
function FG_captureSelection() {
    var names = FG_getSelectionAsNamelist();

    var gaggleData = new FG_GaggleData(
            "Selection",
            "NameList",
            names.length,
            "Unknown",
            names);

    FG_gaggleDataHolder.put(gaggleData);
    FG_populateBroadcastChooser(gaggleData.getDescription());
}


/**
 * make strings safe to be used as preference names by
 * replacing spaces with underscores.
 */
function FG_fixName(name) {
    return "extension.firegoose.website." + name.replace(" ", "_");
}


/**
 * Experimental:
 * Gives a means of loading a website handler at run time.
 * If a js file is loaded in the browser, eval it. Probably
 * not recommended from a security point of view.
 */
function FG_importWebsiteHandler() {
    dump("importing website handler...\n");
    var node = window.content.document.documentElement;
    if (node.nodeName.toLowerCase() == "html") {
        node = window.content.document.getElementsByTagName("body")[0];
        if (!node) {
            dump("Import Website Handler: unable to find document body\n");
            FG_trace("Import Website Handler: unable to find document body");
            return;
        }
    }


    while (node.nodeType != node.TEXT_NODE) {
        node = node.firstChild;
        if (!node) {
            FG_trace("Import Website Handler: unable to find text node in document");
            return;
        }
    }

    eval(node.nodeValue);
    dump("importing website handler complete!\n");

    FG_populateTargetChooser();
}

/**
 * Save these parameters in the Preferences object in Firefox so that
 * next time the user fires up FireFox, the previously created FG targets
 * can be re-initialized and added to the target list
 *
 * @param newTargetURL
 * @param newTargetName
 * @param newTargetReceiveType
 * @param newTargetReceiveingObjectsName
 */
function saveNewWebsiteHandlerParameters(newTargetURL, newTargetName, newTargetReceiveType, newTargetReceiveingObjectsName){
      //find out the next number to use for the new websitehandler
    var _break = false;
    var counter = 0;
    var prefs;
    try{
        prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefBranch);
    }catch(e){
        FG_trace("could not instantiate preferences obj:" + e);
        return;
    }
    while(true){
        try {
            FG_trace("looking for: extension.firegoose.websites.custom.name." + counter);
            var cwsh_name = prefs.getCharPref("extension.firegoose.websites.custom.name." + counter);
            counter++;
        }catch(e){
            break;
        }
    }
    //use this new index to store these 4 values
    prefs.setCharPref("extension.firegoose.websites.custom.name." + counter, newTargetName);
    prefs.setCharPref("extension.firegoose.websites.custom.url." + counter, newTargetURL);
    prefs.setCharPref("extension.firegoose.websites.custom.type." + counter, newTargetReceiveType);
    prefs.setCharPref("extension.firegoose.websites.custom.objName." + counter, newTargetReceiveingObjectsName);
}
function loadPreviouslyCreatedCustomWebsiteHandlers(){
    var prefs;
    try {
        prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefBranch);
    }catch (e) {
        // if those prefs don't exist, an exception is thrown.
        FG_trace("could not instantiate preferences obj:" + e);
        return;
    }
    var counter = 0;
    var newTargetName;
    var newTargetURL;
    var newTargetReceiveType;
    var newTargetReceiveingObjectsName;
    while(true){
        try {
            FG_trace("looking for: extension.firegoose.websites.custom.name." + counter);
            newTargetName = prefs.getCharPref("extension.firegoose.websites.custom.name." + counter);
            newTargetURL  = prefs.getCharPref("extension.firegoose.websites.custom.url." + counter);
            newTargetReceiveType = prefs.getCharPref("extension.firegoose.websites.custom.type." + counter);
            newTargetReceiveingObjectsName = prefs.getCharPref("extension.firegoose.websites.custom.objName." + counter);
            counter++;

            //create new website handler
            var newWebsiteHandler = createNewWebsiteHandlerWithParameters(newTargetURL, newTargetName, newTargetReceiveType, newTargetReceiveingObjectsName)

            //add to FG Target list
            FG_addWebsiteHandler(newTargetName, newWebsiteHandler);
        }catch(e){
            FG_trace("Finished loading all custom websites ("+counter+")");
            break;
        }
    }
}

