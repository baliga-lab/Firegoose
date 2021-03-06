/*
 * Copyright (C) 2009 by Institute for Systems Biology,
 * Seattle, Washington, USA.  All rights reserved.
 *
 * This source code is distributed under the GNU Lesser
 * General Public License, the text of which is available at:
 *   http://www.gnu.org/copyleft/lesser.html
 */

/*
 * handler for STAMP 
 * Alignment, Similarity, & Database Matching for DNA Motifs
 *
 * http://www.benoslab.pitt.edu/stamp/
 */

var FG_stampHandler = new Object();


/**
 * check the given doc to see if we can parse it.
 */
FG_stampHandler.recognize = function(doc) {
	if (doc) {
		var url = doc.location.href;
		return url.indexOf("http://www.benoslab.pitt.edu/stamp/") == 0;
	}
	else
		return false;
}


/**
 * open STAMP in a browser tab
 */
FG_stampHandler.show = function() {
	var url = "http://www.benoslab.pitt.edu/stamp/";
	var newTab = getBrowser().addTab(url);
	getBrowser().selectedTab = newTab;
}


/**
 * Retrieve the data from the page. Returns a list of GaggleData objects.
 * (see firefox/chrome/content/gaggleData.js).
 */
FG_stampHandler.getPageData = function(doc) {
	FG_trace("STAMPE getPageData");
	var results = [];

	return results;
}


/**
 * takes a species and a Java Array of names and submits them for
 * processing by the website.
 */
//FG_stampHandler.handleNameList = function(species, names) {
//	alert("Website handler got namelist(" + names.length + ") species=" + species + ".");
//}


FG_stampHandler.handleMatrix = function(matrix) {
	FG_trace("STAMP handleMatrix");
	var newTab = getBrowser().addTab();
	var browser = getBrowser().getBrowserForTab(newTab);

	try {
		browser.addEventListener("load", this.createOnloadFormFiller(matrix), true);
	}
	catch (e) {
		FG_trace("Error registering STAMP load event callback: " + e);
	}

	try {
		var url = "http://www.benoslab.pitt.edu/stamp/";
		getBrowser().selectedTab = newTab;
		browser.loadURI(url);
		return newTab;
	}
	catch (e) {
		FG_trace("Error loading STAMP page:" + e);
	}
}

FG_stampHandler.createOnloadFormFiller = function(matrix) {
	var onLoadFormFiller = function(aEvent) {
		if (aEvent.originalTarget.nodeName == "#document") {
			dump("STAMP createOnloadFormFiller called...\n");
			FG_trace("STAMP createOnloadFormFiller called.");

			var doc = window.content.document;

            try
            {
                // build position-specific scoring matrix as a string
                FG_trace("building PSSM string " + matrix.getName());
                var pssm = ">" + matrix.getName() + "\n";
                var rowNames = matrix.getRowTitles();
                FG_trace("Row names " + rowNames);
                var len = rowNames.length;
                FG_trace("Row names length " + len);
                for (var i=0; i<len; i++) {
                    var values = matrix.get(i);
                    FG_trace("row values " + values);
                    if (values.length > 0) {
                        pssm += values[0];
                    }
                    for (var j=1; j<values.length; j++) {
                        pssm += " " + values[j];
                    }
                    pssm += "\n";
                }
            }
            catch (e)
            {
                FG_trace("Failed to build PSSM string " + e);
            }

			// find input field and dump matrix into it.
			FG_trace("finding input element");
			var elements = doc.getElementsByName("input");
			if (elements && elements.length > 0) {
				elements[0].value = pssm;
			}
			else {
				FG_trace("STAMP handler: input field not found!");
			}
		}
		FG_Workflow_InProgress = false;
	};
	return onLoadFormFiller;
}


// create and register website handler
FG_addWebsiteHandler("STAMP", FG_stampHandler);

