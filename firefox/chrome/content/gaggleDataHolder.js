/*
 * Copyright (C) 2007 by Institute for Systems Biology,
 * Seattle, Washington, USA.  All rights reserved.
 *
 * This source code is distributed under the GNU Lesser
 * General Public License, the text of which is available at:
 *   http://www.gnu.org/copyleft/lesser.html
 */

/**
* Represents the set of available broadcasts from either the currently visible page
* or the rest of the gaggle.
* Members prefixed w/ an underscore '_' character are to be considered private.
*/

var FG_gaggleDataHolder = {

	_pageData: {},
	_gaggleData: null,

	getDescriptions: function() {
		var result = {};
		if (this._gaggleData) {
			result[this._gaggleData.getName()] = this._gaggleData.getDescription();
		}
		for (var i in this._pageData) {
			result[this._pageData[i].getName()] = this._pageData[i].getDescription();
		}
		return result;
	},

	get: function(name) {
		if (name == "gaggle")
			return this._gaggleData;
		else
			return this._pageData[name];
	},

	put: function(gaggleDataElement) {
        //dump("FG_gaggleDataHolder put\n");
		if (gaggleDataElement.getName() == "gaggle")
			this._gaggleData = gaggleDataElement;
		else
			this._pageData[gaggleDataElement.getName()] = gaggleDataElement;
	},

	putAll: function(gaggleDataElements) {
        //dump("FG_gaggleDataHolder put all!\n");
		for (var i in gaggleDataElements)	
			this.put(gaggleDataElements[i]);
	},

	clearPageData: function() {
        //dump("FG_gaggleDataHolder clear page data!\n");
		this._pageData = {};
	},

	getSpecies: function() {
		if (this._gaggleData) {
			return this._gaggleData.getSpecies();
		}
		// return the species of the first item of in-page data
		// may result in web-service calls
		for (var i in this._pageData) {
			return this._pageData[i].getSpecies();
		}
		return "unknown";
	}

}
