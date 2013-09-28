/*
 * Copyright (C) 2007 by Institute for Systems Biology,
 * Seattle, Washington, USA.  All rights reserved.
 *
 * This source code is distributed under the GNU Lesser
 * General Public License, the text of which is available at:
 *   http://www.gnu.org/copyleft/lesser.html
 */


/**
 * To support asynchronous calls, set the property 'isAsynch' to true
 * and implement the method 'asynchronouslyFetchData', which takes a
 * callback function as an arguement. See the function FG_broadcast in
 * firegoose.js.
 */
function FG_GaggleData(name, dataType, size, species, data) {
	this._name = name;
	this._type = dataType;
	this._size = size;
	this._species = species;
	this._data = data;
}

FG_GaggleData.prototype.getName = function() {
	return this._name;
}

/**
 * types are: NameList, Map, Network, DataMatrix, Cluster
 * TODO: support Tuple
 */
FG_GaggleData.prototype.getType = function() {
	return this._type;
}

FG_GaggleData.prototype.getSize = function() {
	return this._size;
}

/*
 * Be careful not to call getData() from within getSpecies().
 */
FG_GaggleData.prototype.getSpecies = function() {
	return this._applyDefaultSpecies(this._species);
}

FG_GaggleData.prototype.getDescription = function() {
	return this.getName() + ": " + this.getType() + this._sizeString();
}

FG_GaggleData.prototype._sizeString = function() {
	if (this.getSize())
		return "(" + this.getSize() + ")";
	else
		return "";
}

FG_GaggleData.prototype.getData = function() {
    dump("Gaggle prototype getData...\n");
	return this._data;
}


FG_GaggleData.prototype.toString = function() {
	return this.getDescription();
}

/**
 * This method will be "overridden" in the firegoose (by
 * replacing it) which is the least goofy way I could think
 * of to avoid a circular dependency between this and
 * firegoose.js where the real defaulting policy is implemented.
 * 
 * Be careful not to call getData from within getSpecies(). 
 */
FG_GaggleData.prototype._applyDefaultSpecies = function(species) {
	return species;
}


/**
 * set the GaggleData object to lazily convert a js object to
 * java when the data is requested (when getData() is called).
 */
FG_GaggleData.prototype.setConvertToJavaOnGetData = function() {
	dump("\nsetConvertToJavaOnGetData " + this._name + "\n");

	var oldGetData = this.getData;
	if (!oldGetData._already_setConvertToJavaOnGetData) {
		this.getData = function() {
			dump("\nGaggleData.getData()");

			// getData may already be overridden to read data lazily
		    var data = oldGetData.call(this);
            dump("\nold get data returns " + data);

			if (!data)
				return null;
	
			// is this a good way to detect whether data is a java object?
			if (data.getClass) {
			    dump("\nReturn by getClass\n");
				return data;
			}
			else {
				// if we call getSpecies() here, we can't call getData from within
				// getSpecies or we set up an infinite recursion. So, how to get
				// a sample name for guessing species?
				dump("\n\njs type of data: " + this.getType());
				if (this.getType() == "Network") {
				    dump("\nConverting network to Java object....\n");
					this._data = FG_GaggleData.jsToJavaNetwork(this.getName(), this.getSpecies(), data);
				}
				else if (this.getType() == "DataMatrix") {
				    dump("\nConverting data matrix to Java object " + this.getName() + "\n");
					this._data = FG_GaggleData.jsToJavaDataMatrix(this.getName(), this.getSpecies(), data);
				}
				else if (this.getType() == "Cluster") {
				    dump("\nConverting cluster to Java object " + this.getName() + " " + this.getSpecies());
				    this._data = FG_GaggleData.jsToJavaCluster(this.getName(), this.getSpecies(), data);
				}
				else if (this.getType() == "NameList") {
				    dump("\nConverting namelist to Java object " + this.getName() + " " + this.getSpecies());
				    this._data = FG_GaggleData.jsToJavaNameList(this.getName(), this.getSpecies(), data);
				}
				return this._data;
			}
		}
		this.getData._already_setConvertToJavaOnGetData=true;
	}

	return this;
}

FG_GaggleData.prototype.getDataAsNameList = function() {
    if (this._type == null)
        this._type = this.getType();
    dump("\nGetDataAsNameList type " + this._type);
    if (this._type.toLowerCase() == "namelist")
    {
        dump("\nNamelist " + this.getData());
        return this.getData().getNames();
    }
	else if (this._type.toLowerCase() == 'network') {
		var network = this.getData();
		if (network) {
		    if (network.getNodes != undefined)
			    return network.getNodes();
			else
			    return network;
		}
	}
	else if (this._type.toLowerCase() =="datamatrix") {
		var matrix = this.getData();
		if (matrix) {
			return matrix.getRowTitles();
		}
	}
	else if (this._type.toLowerCase() == "cluster") {
		var cluster = this.getData();
		if (cluster && cluster.rowNames) {
			return cluster.rowNames;
		}
		else if (cluster && cluster.getRowNames) {
			return cluster.getRowNames();
		}
	}
}


// takes a javascript dataMatrix object and returns a java DataMatrix.
FG_GaggleData.jsToJavaDataMatrix = function(name, species, jsDataMatrix) {
	var matrix = javaFiregooseLoader.createDataMatrix();
	var data = jsDataMatrix.data;
	dump("\nData " + data);
	var rows = data.length;
	dump("\nMatrix rows " + rows);
	var columns = data[0].length;
	dump("\nMatrix columns " + columns);

	matrix.setName(name);
	matrix.setSpecies(species);
	matrix.setRowTitlesTitle(jsDataMatrix.rowTitlesTitle)
	matrix.setRowTitles(javaFiregooseLoader.toJavaStringArray(jsDataMatrix.rowTitles));
	matrix.setColumnTitles(javaFiregooseLoader.toJavaStringArray(jsDataMatrix.columnTitles));
	var twodimensionarray = javaFiregooseLoader.toJavaDoubleMatrix(jsDataMatrix.data);
	matrix.set(twodimensionarray);
	return matrix;
};


// take a javascript network object and create a java equivalent
FG_GaggleData.jsToJavaNetwork = function(name, species, jsNetwork) {
	var network = javaFiregooseLoader.createNetwork();

	// we handle orphan nodes below in the loop through interactions
//		for (var i in jsNetwork.nodes) {
//			var node = jsNetwork.nodes[i];
//			network.add(node);
//		}

	network.setName(name);
	network.setSpecies(species);

	for (var i in jsNetwork.interactions) {
		// rows may be either 1 element (an orphan node) or 3 elements
		// in the form [<node>, <interaction>, <node>]
		var row = jsNetwork.interactions[i];
		if (row.length >= 3 && row[1].length>0 && row[2].length>0) {
			var interaction = javaFiregooseLoader.createInteraction(row[0], row[2], row[1]);
			network.add(interaction);
		}
		else if (row.length >= 1 && row[0].length>0) {
			network.add(row[0]);
		}
	}

	for (var i in jsNetwork.nodeAttributes) {
		var row = jsNetwork.nodeAttributes[i];
		if (row.length >= 3) {
			network.addNodeAttribute(row[0], row[1], row[2]);
		}
	}

	for (var i in jsNetwork.edgeAttributes) {
		var row = jsNetwork.edgeAttributes[i];
		if (row.length >= 3) {
			network.addEdgeAttribute(row[0], row[1], row[2]);
		}
	}

	return network;
};

FG_GaggleData.jsToJavaCluster = function(name, species, jsCluster) {
    dump("\nCreating Java Cluster "); // + jsCluster.rowNames + " " + jsCluster.columnNames);
    return javaFiregooseLoader.createCluster(name, species, jsCluster);
};

FG_GaggleData.jsToJavaNameList = function(name, species, jsNameList) {
    dump("\nCreating Java NameList "); // + jsNameList);
    return javaFiregooseLoader.createNameList(name, species, jsNameList);
};


FG_GaggleData.prototype.setRequestID = function(requestID)
{
    dump("\nSetting RequestID: " + requestID);
    this.requestID = requestID;
};

FG_GaggleData.prototype.getRequestID = function()
{
    dump("\nGetting RequestID: " + this.requestID);
    return this.requestID;
};

