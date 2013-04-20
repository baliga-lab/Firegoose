//var FG_workflowPageUrl = "http://localhost:8000/workflow";
var FG_workflowPageUrl = "http://networks.systemsbiology.net/workflow";
var FG_workflowDataspaceID = "wfdataspace";
var FG_sendDataToWorkflow = false;
var FG_collectedData = [];


function FG_saveState(goose)
{
    if (goose != null) {
        var filename = goose.getSaveStateFileName();
        dump("\n=====>Save Firegoose state info to " + filename);
        if (filename != null && filename.length > 0) {
            var tabbrowser = getBrowser();
            var taburls = "";

            if (tabbrowser != null) {
                //var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                //                 .getService(Components.interfaces.nsIWindowMediator);
                //var browserEnumerator = wm.getEnumerator("navigator:browser");

                // Check each browser instance for our URL

            //while (!found && browserEnumerator.hasMoreElements()) {
            //    var browserWin = browserEnumerator.getNext();
            //    var tabbrowser = browserWin.gBrowser;

                // Check each tab of this browser instance
                var numTabs = tabbrowser.browsers.length;
                goose.saveStateInfo("URLs:\n");
                for (var index = 0; index < numTabs; index++) {
                    var currentBrowser = tabbrowser.getBrowserAtIndex(index);
                    var url = currentBrowser.currentURI.spec;
                    dump("\nSave url: " + url);
                    goose.saveStateInfo(url + "\n");
                }
            }

            goose.finishSaveState();
        }
    }
}

function FG_loadState(goose)
{
    if (goose != null) {
        var filename = goose.getLoadStateFileName();
        dump("\n=====>Load Firegoose state info from " + filename);
        if (filename != null && filename.length > 0) {
            var datatype = "";
            do {
                var info = goose.loadStateInfo();
                dump("\nRead info: " + info)
                if (info != null && info.length > 0) {
                    if (info.indexOf("URLs:") >= 0) {
                        // subsequent strings are all urls
                        datatype = "url";
                    }
                    else {
                        if (datatype == "url") {
                            newTab = getBrowser().addTab(info);
                        }
                    }
                }
            }
            while (!goose.getFinishedLoadingState());
            goose.finishLoadState();
        }
    }
}


function FG_findOrCreateTabWithUrl(url)
{
    var tabbrowser = getBrowser();
    var found = false;
    var urltab = null;
    if (tabbrowser != null) {
        //var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        //                 .getService(Components.interfaces.nsIWindowMediator);
        //var browserEnumerator = wm.getEnumerator("navigator:browser");

        // Check each browser instance for our URL

    //while (!found && browserEnumerator.hasMoreElements()) {
    //    var browserWin = browserEnumerator.getNext();
    //    var tabbrowser = browserWin.gBrowser;

        // Check each tab of this browser instance
        var numTabs = tabbrowser.browsers.length;
        for (var index = 0; index < numTabs; index++) {
          var currentBrowser = tabbrowser.getBrowserAtIndex(index);
          if (url == currentBrowser.currentURI.spec) {

            // The URL is already opened. Select this tab.
            tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];
            urltab = tabbrowser.selectedTab;
            // Focus *this* browser-window
            //browserWin.focus();

            found = true;
            InjectWorkflowData();
            break;
          }
        }

        // Our URL isn't open. Open it now.
        if (!found) {
            //var recentWindow = wm.getMostRecentWindow("navigator:browser");
            //if (recentWindow) {
              // Use an existing browser window
            //  recentWindow.delayedOpenTab(url, null, null, null, null);
            //}
            //else {
              // No browser windows are open, so open a new one.
            //  window.open(url);
            //}

            var newTab = tabbrowser.addTab(url);
            tabbrowser.selectedTab = newTab;
            urltab = newTab;
        }
    }
    return urltab;
}

function InjectWorkflowData()
{
    dump("\nInjecting data to workflow space...\n");
    var doc = gBrowser.contentDocument;
    var dataspacediv = doc.getElementById(FG_workflowDataspaceID);
    dump("\ndataspace div: " + dataspacediv);
    if (dataspacediv != null) {
         //  Add data into the dataspace
         //  create the accordion if it is not there
         //var header = doc.createElement("h3");
         //header.innerHTML = doc.title;
         //dataspacediv.appendChild(header);
         try {
             var ul =  doc.getElementById("ulcaptureddata");
             for (var lindex = 0; lindex < FG_collectedData.length; lindex++) {
                var li = doc.createElement("li");
                li.className = "licaptureddata";
                ul.appendChild(li);
                var label = doc.createElement("label");
                label.className = "dataspacelabel";
                var checkbox = doc.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "dataspacecheckbox";
                checkbox.name = "checkboxCapturedData";
                label.appendChild(checkbox);
                var url = FG_collectedData[lindex];
                dump("\nurl: " + url);
                dump("\nurl nodename: " + url.nodeName);
                var urlclone = url.cloneNode(true);
                label.appendChild(urlclone);

                var inputdataid = doc.createElement("input");
                inputdataid.type = "hidden";
                inputdataid.setAttribute("value", "");
                label.appendChild(inputdataid);

                var inputorganism = doc.createElement("input");
                inputorganism.type = "hidden";
                inputorganism.setAttribute("value", "Generic");
                label.appendChild(inputorganism);

                var inputdatatype = doc.createElement("input");
                inputdatatype.type = "hidden";
                inputdatatype.setAttribute("value", "Generic");
                label.appendChild(inputdatatype);

                var hoverimage = doc.createElement("img");
                hoverimage.className = "dataspacehoverimage";
                hoverimage.src = "http://networks.systemsbiology.net/static/images/list-add.png";
                //label.appendChild(hoverimage);
                li.appendChild(label);
                //datadiv.appendChild(FG_collectedData[lindex]);
             }
             //dataspacediv.appendChild(datadiv);

             // set the signal value to trigger the UI actions
             var inputsignal = doc.getElementById("inputDataSignal");
             var signalval = parseInt(inputsignal.value) + 1;
             inputsignal.value = signalval.toString();
         }
         catch (e) {
             dump("\nFailed to inject data: " + e);
         }
    }
    FG_sendDataToWorkflow = false;
}

function getSelectedElements(win, tagName) {
    var sel = win.getSelection(), selectedElements = [];
    var range, elementRange, elements;
    try {
        if (sel.getRangeAt && sel.rangeCount) {
            dump("\nParsing selected range...\n");
            elementRange = win.document.createRange();
            for (var r = 0; r < sel.rangeCount; ++r) {
                dump("\nGetting range at " + r);
                range = sel.getRangeAt(r);
                containerEl = range.commonAncestorContainer;
                dump("\nContainer " + containerEl);
                if (containerEl.nodeType != 1) {
                    containerEl = containerEl.parentNode;
                }
                dump("\nContainer node name: " + containerEl.nodeName);
                //dump("\nContainer outer html: " + containerEl.outerHTML);
                //dump("\nContainer inner html: " + containerEl.innerHTML);
                //dump("\nContainer parent node: " + containerEl.parentNode);
                if (containerEl.nodeName.toLowerCase() == tagName) {
                    selectedElements.push(containerEl);
                } else {
                    elements = containerEl.getElementsByTagName(tagName);
                    for (var i = 0; i < elements.length; ++i) {
                        elementRange.selectNodeContents(elements[i]);
                        if (elementRange.compareBoundaryPoints(Range.END_TO_START, range) < 1
                                && elementRange.compareBoundaryPoints(Range.START_TO_END, range) > -1) {
                            dump("\nCaptured element " + elements[i]);
                            //dump("\nCaptured element node name: " + elements[i].nodeName);
                            //dump("\nCaptured element outer html: " + elements[i].outerHTML);
                            selectedElements.push(elements[i]);
                        }
                    }
                }
            }
            elementRange.detach();
        }
    } catch (e) {
        dump("\nFailed to capture selected elements: " + e);
    }
    return selectedElements;
}

// ElementID is the type of the DOM element that contains data.
// It could be a generic type such as "table". Or the ID of a specific element
function FG_workflowDataExtract(elementID, elementType)
{
      dump("\nExtracting data from page for " + elementType);

      FG_collectedData = [];
      var tables = [];
      var doc = gBrowser.contentDocument;

      // We first check if there are any selected text
      //alert(document.commandDispatcher.focusedElement);
      var focusedElement = document.commandDispatcher.focusedElement;
      var elements1;
      var elements2;
      if (null != focusedElement)
      {
          try
          {
              //alert(getSelectedElements(focusedElement, "a"));
              elements1 = getSelectedElements(focusedElement, "a");
              dump("\nSelected a tags: " + elements1);

          }
          catch(e)
          {
              trywindow = true;
          }
      }
      else
      {
          trywindow = true;
      }

      if (trywindow)
      {
          var focusedWindow = document.commandDispatcher.focusedWindow;
          //alert(focusedWindow);
          var winWrapper = new XPCNativeWrapper(focusedWindow, 'document');
          dump("\nWinWrapper: " + winWrapper);
          var Selection = winWrapper.getSelection();
          dump("\n Section: " + Selection);
          if (Selection != null) {
              elements2 = getSelectedElements(winWrapper, "a");
              dump("\nSelected elements: " + elements2);
          }
          //parseSelection(Selection);
      }

      if (elements1 != null && elements1.length > 0)
      {
         for (var i = 0; i < elements1.length; i++) {
            dump("\nLink: " + elements1[i]);
            FG_collectedData.push(elements1[i]);
         }
      }

      if (elements2 != null && elements2.length > 0)
      {
         for (var j = 0; j < elements2.length; j++) {
            dump("\nLink: " + elements2[j]);
            FG_collectedData.push(elements2[j]);
         }
      }

      if (FG_collectedData.length == 0) {
          // If no selected text, we find all the tables on a page and get all the hypertext links in the table
          if (elementType == "table") {
              if (elementID.length == 0)
                  tables = doc.getElementsByTagName("table");
              else {
                 var table = doc.getElementById(elementID);
                 if (table != null)
                     tables.push(table);
              }
              dump("\nFound " + tables.length + " tables\n");

              for (var i = 0; i < tables.length; i++)  {
                  var curTable = tables[i];
                  // We try to find checkboxes. If we find checkboxes, the selected rows will be added.
                  // Otherwise, all the urls in the table will be added.
                  //var gatheredLinksInTable = [];
                  var row = 0;
                  var col = 0;
                  var tablerows = curTable.getElementsByTagName("tr");
                  dump("\nFound " + tablerows.length + " rows\n");
                  if (tablerows == null || tablerows.length == 0)
                  {
                      var rtbody = curTable.getElementsByTagName("tbody");
                      dump("\nFound " + rtbody.length + " tbody\n");
                      if (rtbody != null && rtbody.length > 0)
                      {
                          var tbody = rtbody[0];
                          tablerows = tbody.getElementsByTagName("tr");
                          dump("\nFound " + tablerows.length + " rows\n");
                      }
                  }
                  for (var row = 0; row < tablerows.length; row++) {
                      var currow = tablerows[row];
                      var rowchecked = false;
                      var checkboxFound = false;
                      var cells = currow.getElementsByTagName("td");
                      dump("\nFound " + cells.length + " cells\n");
                      for (var col = 0; col < cells.length; col++) {
                         var cell = cells[col];
                         if (col == 0) {
                             var checkboxes = cell.getElementsByTagName("input");
                             if (checkboxes != null && checkboxes.length > 0 && checkboxes[0].type == "checkbox") {
                                 // we find a checked checkbox, now we find the url on that row
                                 checkboxFound = true;
                                 var checkbox = checkboxes[0];
                                 dump("\ncheckbox " + checkbox.checked);
                                 if (checkbox.checked) {
                                     rowchecked = true;
                                 }
                             }
                         }
                         if ((checkboxFound && rowchecked) || !checkboxFound) {
                             var urls = cell.getElementsByTagName("a");
                             for (var j = 0; j < urls.length; j++)
                             {
                                var url = urls[j];
                                dump("\nFound url: " + url + " node name " + url.nodeName + "\n");
                                FG_collectedData.push(url);
                             }
                         }
                      }
                  }
              }
              dump("\nGathered data length: " + FG_collectedData.length);
          }
      }
      if (FG_collectedData.length > 0) {
           // We gathered data, now we send it to the workflow page
           dump("\nFind or create tab for url: " + FG_workflowPageUrl);
           FG_findOrCreateTabWithUrl(FG_workflowPageUrl);
      }
      else
          FG_sendDataToWorkflow = false;
}

// Event handler for the Send to workflow button
function FG_sendToWorkflow()
{
    if (!FG_sendDataToWorkflow)
    {
        FG_sendDataToWorkflow = true;
        dump("\nSend to workflow page...\n");

        FG_workflowDataExtract("", "table");
    }
}

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

function FG_WorkflowDataReceived(gaggleData, goose)
{
    try
    {
        dump("Workflow data received....\n");
        var action = gaggleData.getWorkflowAction();
        // We need to process webhandlers in serial because some webhandlers (such as EMBL String)
        // needs focus to post data to the web page. Execution in parallel of multiple subactions
        // will cause the tab to lose focus and thus lose data.
        FG_Workflow_InProgress = true;
        // set the UI
        FG_setWorkflowUI(action);

        dump("\nWorkflow data " + gaggleData.getType() + " received for Session: " + action.getSessionID() + "\n");
        var newTab;
        if (gaggleData.getType() == "WorkflowData")
        {
            // This is a URL, it might be ; delimited
            var data = (gaggleData.getData())[0];
            var actions = data.split(";");
            for (var i = 0; i < actions.length; i++)
            {
                if (actions[i] != null && actions[i] != "NONE" && actions[i].length > 0 )
                {
                    var datastring = actions[i];
                    newTab = getBrowser().addTab(actions[i]);
                    getBrowser().selectedTab = newTab;
                    if (newTab != null)
                    {
                        dump("Setting tab value: " + gaggleData.getRequestID());
                        newTab.value = gaggleData.getRequestID();
                        FG_Current_Tab = newTab;
                        FG_setWorkflowUI(action);
                    }
                }
            }
            FG_Current_WorkflowActions.push(gaggleData);
            FG_Workflow_InProgress = false;
        }
        else
        {
            // This is a WorkflowAction (Contains gaggleData such as Network, Cluster, Namelist, etc and a subaction)
            dump("SubAction: " + gaggleData.getSubAction() + "\n");
            // We get a string of concatenated subactions delimited by ';'
            var subactions = gaggleData.getSubAction();
            if (subactions != null && subactions.length > 0)
            {
                FG_Current_WorkflowActions.push(gaggleData);
                var actions = subactions.split(";");
                for (var i = 0; i < actions.length; i++)
                {
                    dump("Subaction: " + actions[i]);
                    if (actions[i] == "NONE")
                        continue;
                    newTab = FG_dispatchBroadcastToWebsite(gaggleData, actions[i]);
                    if (newTab != null)
                    {
                        dump("Setting tab value: " + gaggleData.getRequestID());

                        newTab.value = gaggleData.getRequestID();
                        FG_Current_Tab = newTab;
                        FG_setWorkflowUI(action);
                    }
                }
            }
            else
                FG_Workflow_InProgress = false;
        }
    }
    catch(e)
    {
        dump("Failed to process workflow data: " + e.message);
        FG_Workflow_InProgress = false;
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
        if (targets != undefined && targets != null)
        {
            var popup = document.getElementById("fg_nextcomponentPopup");
            var chooser = document.getElementById("fg_nextcomponents");
            dump("\nClean up" + popup.childNodes.length + " components\n");
            for (var i=popup.childNodes.length - 1; i>=0; i--) {
                popup.removeChild(popup.childNodes.item(i));
            }

            var nextcomponents = "";
            for (var i = 0; i < targets.length; i++)
            {
                var component = targets[i];
                dump("Target component name: " + component.getName());
                var newMenuItem = document.createElement("menuitem");
                newMenuItem.setAttribute("label", (component.getName() + "-" + component.getWorkflowIndex().toString()));
                newMenuItem.setAttribute("tooltiptext", component.getName());
                newMenuItem.setAttribute("value", i);
                popup.appendChild(newMenuItem);
                //nextcomponents += (component.getName() + " ");
            }
            if (popup.childNodes.length > 0) {
               chooser.selectedIndex = 0;
            }
            dump("\n" + nextcomponents + "\n");
            //pnl.value = nextcomponents;
        }
    }
    else
    {
        var popup = document.getElementById("fg_nextcomponentPopup");
        var chooser = document.getElementById("fg_nextcomponents");
        dump("\nAfter committing data clean up" + popup.childNodes.length + " components\n");
        for (var j=popup.childNodes.length - 1; j>=0; j--) {
            popup.removeChild(popup.childNodes.item(j));
        }
        chooser.selectedIndex = -1;
    }
}

function FG_GetDataForTargets(gaggleWorkflowData, gooseindex)
{
    // Parse the web page using web handlers and obtain data for each target component
    // return a list of GaggleData
    var data = new Array();
    var chooser = document.getElementById("fg_broadcastChooser");
    if (chooser.selectedItem) {
        dump("Broadcast chooser: " + chooser.selectedItem.getAttribute("value"));
        var broadcastData = FG_gaggleDataHolder.get(chooser.selectedItem.getAttribute("value"));
        if (broadcastData != null)
        {
            if (broadcastData.isAsynch) {
                dump("fetching data asynchronously...\n");
                broadcastData.asynchronouslyFetchData(
                        function() {
                            data.push(broadcastData);
                            FG_processWorkflowResponseData(data, gaggleWorkflowData, gooseindex);
                        });
            }
            else {
                dump("\nEmpty data\n")
                data.push(broadcastData);
            }
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
        var popup = document.getElementById("fg_nextcomponentPopup");
        var chooser = document.getElementById("fg_nextcomponents");
        dump("\nSelected index: " + chooser.selectedIndex + "\n");
        var gooseindex = chooser.selectedItem.getAttribute("value");
        dump("Selected next component: " + gooseindex);
        var data = FG_GetDataForTargets(gaggleWorkflowData, gooseindex);
        FG_processWorkflowResponseData(data, gaggleWorkflowData, gooseindex);
    }
}

function FG_processWorkflowResponseData(data, gaggleWorkflowData, gooseindex)
{
    // We let the user send a null data to the next component to get the workflow going
    //if (data != null && data.length > 0)
    {
        var goose = javaFiregooseLoader.getGoose();
        var action = gaggleWorkflowData.getWorkflowAction();
        if (goose != null && action != null && action.getTargets() != null)
        {
            dump("\nAbout to submit " + action.getTargets().length + " data to the boss\n");

            //for (var i = 0; i < action.getTargets().length; i++)
            {
                // For now the data is replicated to each targets
                // TODO: later we should support sending different data to the targets

                var broadcastData = null;
                if (data != null && data.length > 0)
                    broadcastData = data[0];
                else {
                    dump("\nSend dummy data to next goose\n")
                    var tempdata = [];
                    tempdata.push("");
                    broadcastData = new FG_GaggleData("gaggle", "NameList", 0, null, tempdata);
                }
                dump("\nSubmit data type: " + broadcastData.getType() + " for Goose " + gooseindex + "\n");
                if (broadcastData.getType() == "NameList") {
                    //var javaArray = javaFiregooseLoader.toJavaStringArray(broadcastData.getData());
                    //if (javaArray != null && javaArray.length > 0)
                    //    dump("Namelist array: " + javaArray[0] + "\n");

                    var delimitedString = javaFiregooseLoader.jsStringArrayToDelimitedString(broadcastData.getData(), "!");
                    goose.submitNameList(gaggleWorkflowData.getRequestID(),
                                         parseInt(gooseindex),
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
                            parseInt(gooseindex),
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
                            goose.submitNetwork(gaggleWorkflowData.getRequestID(), parseInt(gooseindex), network);
                        }
                }
                else if (broadcastData.getType() == "DataMatrix") {
                        // matrix is a java object
                        var matrix = broadcastData.getData();
                        // TODO is this necessary? apply defaulting to species
                        matrix.setSpecies(broadcastData.getSpecies());
                        goose.submitDataMatrix(gaggleWorkflowData.getRequestID(), parseInt(gooseindex), matrix);
                }
                else if (broadcastData.getType() == "Cluster") {
                        goose.submitCluster(
                                gaggleWorkflowData.getRequestID(),
                                parseInt(gooseindex),
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

            // diable the item from the nextcomponent dropdown
            var popup = document.getElementById("fg_nextcomponentPopup");
            var chooser = document.getElementById("fg_nextcomponents");
            var component = action.getTargets()[parseInt(gooseindex)];
            dump("\nUpdate dropdown for " + component.getName());
            for (var i=popup.childNodes.length - 1; i>=0; i--) {
                if (i == parseInt(gooseindex))
                {
                    popup.childNodes[i].setAttribute("label", (component.getName() + "(data committed)"));
                    break;
                }
            }

            if (goose.AllDataCommittedForRequest(gaggleWorkflowData.getRequestID()))
            {
                dump("\n>>>>>Submitting data for " + gaggleWorkflowData.getRequestID());
                if (goose.CompleteWorkflowAction(gaggleWorkflowData.getRequestID()))
                {
                    dump("\nSuccessfully submitted data\n");
                    FG_setWorkflowUI(null);
                }
                else
                    dump("\nFailed to submit data!!\n");
            }
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
    dump("\nGetting WorkflowAction for " + this.requestID);
    return goose.getWorkflowAction(this.requestID);
}

FG_GaggleWorkflowDataFromGoose.prototype.getSubAction = function() {
     var goose = javaFiregooseLoader.getGoose();
     dump("\nGetting subaction for " + this.requestID);
     return goose.getWorkflowDataSubAction(this.requestID);
}