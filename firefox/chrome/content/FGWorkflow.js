var FG_Current_WorkflowActions = new Array();
var FG_Current_Tab;

function FG_findWorkflowData(requestID)
{
    if (requestID != undefined)
    {
        dump("Looking for action with requestID: " + requestID + "\n");

        for (var i = 0; i < FG_Current_WorkflowActions.length; i++)
        {
             var gaggleWorkflowData = FG_Current_WorkflowActions[i];
             if (gaggleWorkflowData != undefined && gaggleWorkflowData.getRequestID() == requestID)
             {
                dump("Found WorkflowAction!!\n");
                return gaggleWorkflowData; //.getWorkflowAction();
             }
        }
    }
    return null;
}

function FG_WorkflowDataReceived(gaggleData)
{
    try
    {
        dump("Workflow data received....\n");
        var action = gaggleData.getWorkflowAction();

        // set the UI
        FG_setWorkflowUI(action);

        dump("Workflow data " + gaggleData.getType() + " received for Session: " + action.getSessionID() + "\n");
        //FG_Current_WorkflowAction = {};
        //FG_Current_WorkflowAction.SessionID = action.getSessionID();
        //FG_Current_WorkflowAction.RequestID = action.requestID;
        //dump("WorkflowAction RequestID: " + FG_Current_WorkflowAction.RequestID);
        var newTab;
        if (gaggleData.getType() == "WorkflowData")
        {
            // This is a URL
            var data = (gaggleData.getData())[0];
            newTab = getBrowser().addTab(data);
            getBrowser().selectedTab = newTab;

            //alert(newTab);

        }
        else
        {
            // This is a WorkflowAction (Contains gaggleData such as Network, Cluster, Namelist, etc and a subaction)
            dump("SubAction: " + gaggleData.getSubAction() + "\n");
            newTab = FG_dispatchBroadcastToWebsite(gaggleData, gaggleData.getSubAction());
        }

        if (newTab != null)
        {
            dump("Setting tab value: " + gaggleData.getRequestID());
            newTab.value = gaggleData.getRequestID();
            FG_Current_Tab = newTab;
            FG_Current_WorkflowActions.push(gaggleData);
            FG_setWorkflowUI(action);
        }
    }
    catch(e)
    {
        dump("Failed to process workflow data: " + e.message);
    }

    // var action = gaggleData.getWorkflowAction();
    // FG_Current_WorkflowAction.jsonParams = JSON.parse(action.getSource().getJSONParams());
}

function FG_setWorkflowUI(action)
{
    if (action != undefined && action != null)
    {
        dump("\nSetting workflow UI\n");
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
    }
    else
    {
        var pnl = document.getElementById("fg_nextcomponents");
        pnl.value = "";
    }
}

function FG_GetDataForTargets(gaggleWorkflowData)
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
                        FG_processWorkflowResponseData(data, gaggleWorkflowData);
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
    dump("\n===============>Next workflow component<=================\n");

    dump("\nCurrent Tab value: " + FG_Current_Tab.value + "\n");
    var gaggleWorkflowData = FG_findWorkflowData(FG_Current_Tab.value);
    if (gaggleWorkflowData)
    {
        var data = FG_GetDataForTargets(gaggleWorkflowData);
        FG_processWorkflowResponseData(data, gaggleWorkflowData);
    }
}

function FG_processWorkflowResponseData(data, gaggleWorkflowData)
{
    if (data != null)// && data.length > 0)
    {
        var goose = javaFiregooseLoader.getGoose();
        var action = gaggleWorkflowData.getWorkflowAction();
        if (goose != null && action != null && action.getTargets() != null)
        {
            dump("\nAbout to submit " + action.getTargets().length + " data to the boss\n");
            for (var i = 0; i < action.getTargets().length; i++)
            {
                // For now the data is replicated to each targets
                // TODO: later we should support sending different data to the targets
                var broadcastData = data[i];
                dump("\nBroadcast data type: " + broadcastData.getType() + "\n");
                if (broadcastData.getType() == "NameList") {
                    //var javaArray = javaFiregooseLoader.toJavaStringArray(broadcastData.getData());
                    //if (javaArray != null && javaArray.length > 0)
                    //    dump("Namelist array: " + javaArray[0] + "\n");

                    var delimitedString = javaFiregooseLoader.jsStringArrayToDelimitedString(broadcastData.getData(), "!");
                    goose.submitNameList(gaggleWorkflowData.getRequestID(),
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
                            gaggleWorkflowData.getRequestID(),
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
                            goose.submitNetwork(gaggleWorkflowData.getRequestID(), i, network);
                        }
                }
                else if (broadcastData.getType() == "DataMatrix") {
                        // matrix is a java object
                        var matrix = broadcastData.getData();
                        // TODO is this necessary? apply defaulting to species
                        matrix.setSpecies(broadcastData.getSpecies());
                        goose.submitDataMatrix(gaggleWorkflowData.getRequestID(), i, matrix);
                }
                else if (broadcastData.getType() == "Cluster") {
                        goose.submitCluster(
                                gaggleWorkflowData.getRequestID(),
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
            dump("\n>>>>>Submitting data for " + gaggleWorkflowData.getRequestID());
            if (goose.CompleteWorkflowAction(gaggleWorkflowData.getRequestID()))
            {
                dump("\nSuccessfully submitted data\n");
                FG_setWorkflowUI(null);
            }
            else
                dump("\nFailed to submit data!!\n")
        }
    }
}

/**
 * Delegates calls to the java goose to get workflow data
 * We inherit from FG_GaggleData because FG_DispatchDataToWebsite
 * calls getDataAsNameList, which is defined in FG_DispatchDataToWebsite
**/
function FG_GaggleWorkflowDataFromGoose() {
}

// the name "gaggle" is required for a cheap and sleazy hack in FG_gaggleDataHolder
//FG_GaggleWorkflowDataFromGoose.prototype = new FG_GaggleData("gaggle", requestID);
FG_GaggleWorkflowDataFromGoose.prototype = new FG_GaggleData("gaggle");

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