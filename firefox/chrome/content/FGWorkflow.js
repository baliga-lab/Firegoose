var FG_Current_WorkflowAction;

function FG_WorkflowDataReceived(gaggleData)
{
    try
    {
        dump("Workflow data received....\n");
        var action = gaggleData.getWorkflowAction();

        // set the UI
        var targets = action.getTargets();
        var pnl = document.getElementById("fg_nextcomponents");
        if (targets != undefined && targets != null)
        {
            var nextcomponents = "";
            for (var i = 0; i < targets.length; i++)
            {
                var component = targets[i];
                dump("Target component name: " + component.getName());
                nextcomponents += (component.getName() + " ");
            }
            dump("\n" + nextcomponents + "\n");
            pnl.value = nextcomponents;
        }


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


function FG_GetDataForTargets(sessionID)
{
    // Parse the web page using web handlers and obtain data for each target component
    // return a list of GaggleData
    var data = new Array();
    var chooser = document.getElementById("fg_broadcastChooser");
    if (chooser.selectedItem) {
        dump("Broadcast chooser: " + chooser.selectedItem.getAttribute("value"));
        var broadcastData = FG_gaggleDataHolder.get(chooser.selectedItem.getAttribute("value"));

        if (broadcastData.isAsynch) {
            dump("fetching data asynchronously...\n");
            broadcastData.asynchronouslyFetchData(
                    function() {
                        data.push(broadcastData);
                        FG_processWorkflowResponseData(data, sessionID);
                    });
        }
        else {
            data.push(broadcastData);
        }

        //alert(broadcastData.getType());


        //data.push(broadcastData);
    }
    return data;
}

function FG_executeNextWorkflow(sessionID)
{
    dump("===============>Next workflow component<=================\n");

    var sessionID = FG_Current_WorkflowAction.SessionID;
    var data = FG_GetDataForTargets(sessionID);
    FG_processWorkflowResponseData(data, sessionID);
}

function FG_processWorkflowResponseData(data, sessionID)
{
    if (data != null && data.length > 0)
    {
        var goose = javaFiregooseLoader.getGoose();
        if (goose != null)
        {

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
                                         //broadcastData.getData()
                                         delimitedString,
                                         "!"
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
                        dump("Processing Network\n");
                        var network = broadcastData.getData();
                        if (network != undefined)
                        {
                            dump("Network retrieved");
                            // TODO is this necessary? apply defaulting to species
                            network.setSpecies(broadcastData.getSpecies());
                            goose.submitNetwork(sessionID, i, network);
                        }
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
function FG_GaggleWorkflowDataFromGoose() {
}

// the name "gaggle" is required for a cheap and sleazy hack in FG_gaggleDataHolder
//FG_GaggleWorkflowDataFromGoose.prototype = new FG_GaggleData("gaggle", requestID);
FG_GaggleWorkflowDataFromGoose.prototype = new FG_GaggleData("gaggle");

//FG_GaggleWorkflowDataFromGoose.prototype.setRequestID(requestID)
//{
//    dump("Setting requestID: " + requestID);
//    this.requestID = requestID;
//}

FG_GaggleWorkflowDataFromGoose.prototype.getType = function() {
    var goose = javaFiregooseLoader.getGoose();
    this._type = goose.getWorkflowDataType(this.requestID);
    return this._type;
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