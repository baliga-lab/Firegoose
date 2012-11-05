var FG_Current_WorkflowAction;

function FG_WorkflowDataReceived(gaggleData)
{
    try
    {
        dump("Workflow data received....\n");
        var action = gaggleData.getWorkflowAction();
        dump("Workflow data " + gaggleData.getType() + " received for Session: " + action.getSessionID() + "\n");
        FG_Current_WorkflowAction = {};
        FG_Current_WorkflowAction.SessionID = action.getSessionID();

        if (gaggleData.getType() == "WorkflowData")
        {
            // This is a URL
            var data = (gaggleData.getData())[0];
            var newTab = getBrowser().addTab(data);
            getBrowser().selectedTab = newTab;
        }
        else
        {
            // This is a WorkflowAction (Contains gaggleData such as Network, Cluster, Namelist, etc and a subaction)
            dump("SubAction: " + gaggleData.getSubAction() + "\n");
            FG_dispatchBroadcastToWebsite(gaggleData, gaggleData.getSubAction());
        }
    }
    catch(e)
    {
        dump("Failed to process workflow data: " + e.message);
    }

    // var action = gaggleData.getWorkflowAction();
    // FG_Current_WorkflowAction.jsonParams = JSON.parse(action.getSource().getJSONParams());
}


function FG_GetDataForTargets()
{
    // Parse the web page using web handlers and obtain data for each target component
    // return a list of GaggleData
    var data = new Array();
    var chooser = document.getElementById("fg_broadcastChooser");
    if (chooser.selectedItem) {
        dump("Broadcast chooser: " + chooser.selectedItem.getAttribute("value"));
        var broadcastData = FG_gaggleDataHolder.get(chooser.selectedItem.getAttribute("value"));
        //alert(broadcastData.getType());

        data.push(broadcastData);
        data.push(broadcastData);
    }
    return data;
}

function FG_executeNextWorkflow(sessionID)
{
    dump("===============>Next workflow component<=================\n");

    var data = FG_GetDataForTargets();
    if (data != null && data.length > 0)
    {
        var goose = javaFiregooseLoader.getGoose();
        if (goose != null)
        {
            var sessionID = FG_Current_WorkflowAction.SessionID;
            dump("About to submit " + data.length + " data to the boss\n");
            for (var i = 0; i < data.length; i++)
            {
                var broadcastData = data[i];
                dump("Broadcast data type: " + broadcastData.getType() + "\n");
                if (broadcastData.getType() == "NameList") {
                    //var javaArray = javaFiregooseLoader.toJavaStringArray(broadcastData.getData());
                    //if (javaArray != null && javaArray.length > 0)
                    //    dump("Namelist array: " + javaArray[0] + "\n");

                    var delimitedString = javaFiregooseLoader.jsStringArrayToDelimitedString(broadcastData.getData(), "!");
                    goose.submitNameList(sessionID,
                                         i,
                                         broadcastData.getName(),
                                         broadcastData.getSpecies(),
                                         broadcastData.getData()
                                         );
                }
                else if (broadcastData.getType() == "Map") {
                    goose.submitMap(
                            sessionID,
                            i,
                            broadcastData.getSpecies(),
                            broadcastData.getName(),
                            FG_objectToJavaHashMap(broadcastData.getData())
                            );
                }
                else if (broadcastData.getType() == "Network") {
                        // network is a java object
                        var network = broadcastData.getData();
                        // TODO is this necessary? apply defaulting to species
                        network.setSpecies(broadcastData.getSpecies());
                        goose.submitNetwork(sessionID, i, network);
                }
                else if (broadcastData.getType() == "DataMatrix") {
                        // matrix is a java object
                        var matrix = broadcastData.getData();
                        // TODO is this necessary? apply defaulting to species
                        matrix.setSpecies(broadcastData.getSpecies());
                        goose.submitDataMatrix(sessionID, i, matrix);
                }
                else if (broadcastData.getType() == "Cluster") {
                        goose.submitCluster(
                                sessionID,
                                i,
                                broadcastData.getSpecies(),
                                broadcastData.getName(),
                                broadcastData.getData().rowNames,
                                broadcastData.getData().columnNames
                                );
                }
                else {
                    FG_trace("Error in FG_dispatchBroadcastToGoose(broadcastData, target): Unknown data type: \"" + broadcastData.getType() + "\"");
                }
            }
            dump(">>>>>Submitting data for " + sessionID);
            goose.CompleteWorkflowAction(sessionID);
        }
    }
}

/**
 * Delegates calls to the java goose to get workflow data
**/
function FG_GaggleWorkflowDataFromGoose(requestID) {
    this.requestID = requestID;
}

// the name "gaggle" is required for a cheap and sleazy hack in FG_gaggleDataHolder
//FG_GaggleWorkflowDataFromGoose.prototype = new FG_GaggleData("gaggle", requestID);

FG_GaggleWorkflowDataFromGoose.prototype.getType = function() {
    var goose = javaFiregooseLoader.getGoose();
    return goose.getWorkflowDataType(this.requestID);
}

FG_GaggleWorkflowDataFromGoose.prototype.getSize = function() {
    var goose = javaFiregooseLoader.getGoose();
    return goose.getWorkflowDataSize(this.requestID);
}

FG_GaggleWorkflowDataFromGoose.prototype.getSpecies = function() {
    var goose = javaFiregooseLoader.getGoose();
    var names = goose.getWorkflowDataNameList(this.requestID);
    if (names && names.length > 0)
        var species = FG_applyDefaultSpecies(goose.getWorkflowDataSpecies(this.requestID), names[0]);
    else
        var species = FG_applyDefaultSpecies(goose.getWorkflowDataSpecies(this.requestID));
    return species;
}

FG_GaggleWorkflowDataFromGoose.prototype.getData = function() {
    var goose = javaFiregooseLoader.getGoose();
    var data = goose.getWorkflowDataNameList(this.requestID);
    if (data != undefined && data.length != undefined)
    {
        dump("\nGet name list of length " + data.length);
        for (var i = 0; i < data.length; i++)
        {
            dump("\nName: " + data[i]);
        }
        dump("\n");
    }
    return data;

    // TODO:  handle all data types here and in FireGoose.java
}

FG_GaggleWorkflowDataFromGoose.prototype.getWorkflowAction = function() {
    var goose = javaFiregooseLoader.getGoose();
    return goose.getWorkflowAction(this.requestID);
}

FG_GaggleWorkflowDataFromGoose.prototype.getSubAction = function() {
     var goose = javaFiregooseLoader.getGoose();
     return goose.getWorkflowDataSubAction(this.requestID);
}