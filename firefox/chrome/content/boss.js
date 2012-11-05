// An API which can be exposed in javascripted web pages

var FG_boss = new Object();

FG_boss.broadcast = function(targets, message) {
	dump("targets = " + targets + "\n");
	dump("message: type=" + message.type + " from=" + message.source + "\n");
	
	if (message.type == "NameList") {
		var broadcastData = new FG_GaggleData(
			message.name,
			message.type,
			message.size,
			message.species,
			message.data);
		FG_dispatchBroadcast(broadcastData, "PIPE", "Website");
	}
}


