/*
 * Copyright (C) 2007 by Institute for Systems Biology,
 * Seattle, Washington, USA.  All rights reserved.
 *
 * This source code is distributed under the GNU Lesser
 * General Public License, the text of which is available at:
 *   http://www.gnu.org/copyleft/lesser.html
 */

var FG_util = {


/**
 * strip off leading and trailing whitespace from a string
 */
trim: function (sInString) {
  sInString = sInString.replace( /^\s+/g, "" );// strip leading
  return sInString.replace( /\s+$/g, "" );// strip trailing
},



/**
 * Join the elements to a delimited string. There is a native
 * javascript join function, but this one works on java arrays
 * and javascript arrays too.
 */
join: function (items, delimiter) {
	var queryString = "";
	if (items.length > 0) {
		queryString += items[0];
	}
	for (var i=1; i<items.length; i++) {
		queryString += delimiter;
		queryString += items[i];
	}
	return queryString;
},



/**
 * log a message to the javascript console
 */
trace: function (msg) {
    Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(msg);
},


/**
 * Returns true if the string starts with the
 * prefix. Returns false otherwise.
 */
startsWith: function(string, prefix) {
	if (string.length >= prefix.length) {
		if (string.substring(0,prefix.length) == prefix)
			return true;
	}
	return false;
},

objectToString: function(o) {
	var first = true;
	var str = "{";
	for (var i in o) {
		if (first)
			first = false;
		else
			str += ", ";
		str += i + ":" + o[i];
	}
	str += "}";
	return str;
}

}