/*
 * Copyright (C) 2007 by Institute for Systems Biology,
 * Seattle, Washington, USA.  All rights reserved.
 *
 * This source code is distributed under the GNU Lesser
 * General Public License, the text of which is available at:
 *   http://www.gnu.org/copyleft/lesser.html
 */

/*
   This is a place-holder for an unimplemented idea: To wrap the Java
   FireGoose object in a javascript wrapper. One use of this would be to
   facilitate alternate implementations of the communications layer between
   the firegoose and the gaggle boss. Another would be to cleanly translate
   between Java datatypes and Javascript datatypes. Confusion between, for
   instance, a Java String and a Javascript String is a source of some ugly
   bugs.
 */
   

function Goose() {
    this._goose = javaFirefoxExtension.getGoose();
}

Goose.prototype.myFunction = function() {
    
}
