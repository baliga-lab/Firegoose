//var FG_workflowPageUrl = "http://localhost:8000/workflow";
//var FG_workflowPageUrl = "http://poland:8000/workflow";
var FG_workflowPageUrl = "http://networks.systemsbiology.net/workflow";
var FG_workflowDataspaceID = "tblUserFiles";
var FG_collectedData = null;
var FG_collectedTableData = null;
var FG_currentTabUrl = null;

function FG_saveState(goose)
{
    if (goose != null) {
        var filename = goose.getSaveStateFileName();
        dump("\n=====>Save Firegoose state info to " + filename);
        if (filename != null && filename.length > 0) {
            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                 .getService(Components.interfaces.nsIWindowMediator);
            var browserEnumerator = wm.getEnumerator("navigator:browser");

            while (browserEnumerator.hasMoreElements()) {
                var browserWin = browserEnumerator.getNext();
                dump("\nNext browser window: " + browserWin);
                var tabbrowser = browserWin.gBrowser;
                var taburls = "";

                if (tabbrowser != null) {
                    // Check each tab of this browser instance
                    var numTabs = tabbrowser.browsers.length;
                    dump("\nNumber of tabs: " + numTabs);
                    for (var index = 0; index < numTabs; index++) {
                        var currentBrowser = tabbrowser.getBrowserAtIndex(index);
                        var url = currentBrowser.currentURI.spec;
                        var currentTab = tabbrowser.tabContainer.childNodes[index];
                        dump("\nTab value: " + currentTab.value);
                        if (currentTab.value == null) {
                            // No data is associated with this tab, we simply store the url
                            dump("\nSave url: " + url);
                            goose.saveStateInfo(url + "\n");
                        }
                        else {
                            // The tab is created by a web handler, we need to save the data
                            // in order to restore the state correctly
                            var splitted = currentTab.value.split(";;");
                            if (splitted.length < 2) {
                                // Not enough workflow data stored, we save the url
                                dump("\nSave url: " + url);
                                goose.saveStateInfo(url + "\n");
                            }
                            else {
                                // Workflow data associated with the tab, we save the handler as well as the data
                                try {
                                    var handler = splitted[0];
                                    var broadcastdataIndex = splitted[1];
                                    dump("\nBroadcastdata Index: " + broadcastdataIndex);
                                    var broadcastData = FG_gaggleDataHolder.getBroadcastData(parseInt(broadcastdataIndex) - 1);
                                    dump("\nData " + broadcastData);
                                    var data = null;
                                    if (broadcastData.getGaggleData == undefined)
                                    {
                                        dump("\nSave namelist data");
                                        goose.saveStateInfo(handler,
                                            broadcastData.getName(),
                                            broadcastData.getSpecies(),
                                            broadcastData.getData());
                                    }
                                    else {
                                        data = broadcastData.getGaggleData();
                                        dump("\nSave handler: " + handler + " data " + data);
                                        goose.saveStateInfo(handler, data);
                                    }
                                }
                                catch(e) {
                                    dump("\n\nFailed to save broadcast data: " + e);
                                }
                            }
                        }
                    }
                }
            }
            dump("\n\nFinishing save state...");
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
            do {
                var info = goose.loadStateInfo();
                dump("\nRead info: " + info)
                if (info != null && info.length > 0) {
                    var splitted = info.split(";;");
                    if (splitted != null) {
                        var type = splitted[0];
                        if (type.indexOf("URLs") >= 0) {
                            // subsequent strings are all urls
                            dump("Open URL: " + splitted[1]);
                            newTab = getBrowser().addTab(splitted[1]);
                        }
                        else if (type.indexOf("HANDLER") >= 0) {
                            var handler = splitted[1];
                            var dataclass = splitted[2];
                            var datafilename = splitted[3];
                            dump("\n=>>>>>Pass data to handler " + handler + " class " + dataclass + " from " + datafilename);
                            //var gaggleData = new FG_GaggleData("", "gaggle-namelist", splitted.length - 3, null, data);
                            var data = goose.loadGaggleData(datafilename);
                            dump("\nPass data to " + handler);
                            if (data != null)
                            {
                                var type = dataclass.substring(dataclass.lastIndexOf(".") + 1);
                                dump("\nType: " + type);
                                var deserializedData = new FG_GaggleDeserializedData(data, type);
                                //deserializedData.initializeData(data, type);
                                FG_dispatchBroadcastToWebsite(deserializedData, handler);
                            }
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
    dump("Tab url: " + FG_currentTabUrl);
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

function InsertData(url, targettable)
{
    if (url != null && targettable != null) {
        dump("\nInserting " + url + " to " + targettable + "with " + targettable.rows.length + " rows\n");
        var doc = gBrowser.contentDocument;
        //var tabbrowser = getBrowser();
        //var urltab = tabbrowser.selectedTab;

        var row = targettable.insertRow(-1);
        dump("\nRow " + row);
        //targettable.appendChild(row);
        //var td0 = document.createElement("td");
        //$(row).append($(td0));
        //var checkbox = document.createElement("input");
        //checkbox.setAttribute("type", "checkbox");
        //$(td0).append($(checkbox));

        var td1 = row.insertCell(0);// doc.createElement("td");
        //row.appendChild(td1);
        var label = doc.createElement("label");
        label.className = "dataspacelabel";
        td1.appendChild(label);

        var checkbox = doc.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        label.appendChild(checkbox);

        try {
            var urlclone = url.cloneNode(true);
            dump("\nCloned url " + urlclone);
            label.appendChild(urlclone);
        }
        catch (e)
        {
            var link = doc.createElement("a");
            link.text = url;
            link.href =  url;
            dump("\nURL " + link);
            label.appendChild(link);
        }


        var idinput = doc.createElement("input");
        idinput.setAttribute("type", "hidden");
        idinput.setAttribute("value", "");
        label.appendChild(idinput);

        //alert(linkpair['organism']);
        var organisminput = doc.createElement("input");
        organisminput.setAttribute("type", "hidden");
        organisminput.setAttribute("value", "Generic");
        label.appendChild(organisminput);

        var useridinput = doc.createElement("input");
        useridinput.setAttribute("type", "hidden");
        useridinput.setAttribute("value", "*");
        label.appendChild(useridinput);

        var td2 = row.insertCell(1); //doc.createElement("td");
        //row.appendChild(td2);
        td2.innerHTML = "Generic";

        var td3 = row.insertCell(2); // doc.createElement("td");
        //row.appendChild(td3);
        td3.innerHTML = FG_currentTabUrl; //"Captured data";
        dump(td3.innerHTML);

        var td4 = row.insertCell(3); //document.createElement("td");
        //row.appendChild(td4);
        var select = doc.createElement("select");
        //select.onchange = "javascript:DataOperationSelected(this);";
        select.className = "firegooseInsertedSelect"
        td4.appendChild(select);
        var option0 = doc.createElement("option");
        option0.value = "0";
        option0.innerHTML = "Select an operation";
        select.appendChild(option0);
        var option1 = doc.createElement("option");
        option1.value = "1";
        option1.innerHTML = "Open";
        select.appendChild(option1);

        //TODO add quick view back later
        //var option2 = doc.createElement("option");
        //option2.value = "2";
        //option2.innerHTML = "QuickView";
        //select.appendChild(option2);

        var option3 = doc.createElement("option");
        option3.value = "3";
        option3.innerHTML = "Download";
        select.appendChild(option3);

        //var hoverimage = doc.createElement("img");
        //hoverimage.className = "dataspacehoverimage";
        //hoverimage.src = "http://networks.systemsbiology.net/static/images/list-add.png";
        //label.appendChild(hoverimage);
        //li.appendChild(label);
    }
}


function InjectWorkflowData()
{
    dump("\nInjecting data to workflow space...\n");
    dump("Data tab url: " + FG_currentTabUrl);
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
             //var ul =  doc.getElementById("ulGeneric");
             var datatable = doc.getElementById("tblUserFiles");
             dump("inserting target " + datatable);
             for (var lindex = 0; lindex < FG_collectedData.length; lindex++) {
                  InsertData(FG_collectedData[lindex], datatable);
                //datadiv.appendChild(FG_collectedData[lindex]);
             }
             //dataspacediv.appendChild(datadiv);
             if (FG_collectedTableData != null) {
                 for (var tindex = 0; tindex < FG_collectedTableData.length; tindex++) {
                    var tabledata = FG_collectedTableData[tindex];
                    dump("\nTable " + tindex);
                    if (tabledata != null) {
                       for (var col = 0; col < tabledata.length; col++) {
                            dump("\ncolumn " + col);
                            var urls = tabledata[col];
                            if (urls != null) {
                                //dump("\nurl array: " + urls);
                                if (urls.length > 0) {
                                    for (var l = 0; l < urls.length; l++) {
                                        var url = urls[l];
                                        InsertData(url, datatable);
                                    }
                                }
                            }
                       }
                    }
                 }
             }

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

      FG_collectedData = new Array();
      var tables = [];
      var doc = gBrowser.contentDocument;

      FG_currentTabUrl = gBrowser.selectedBrowser.contentWindow.location.href;
      dump("\ndata url: " + FG_currentTabUrl);

      var broadcastChooser = document.getElementById("fg_broadcastChooser");
      dump("\nbroadcastChooser value " + broadcastChooser.selectedItem.getAttribute("value"));
      var broadcastData = FG_gaggleDataHolder.get(broadcastChooser.selectedItem.getAttribute("value"));
      dump("\n\nBroadcast data " + broadcastData);
      var hasGaggleData = false;
      if (broadcastData != null)
      {
          var data = null;
          try {
            data = broadcastData.getData();
          }
          catch (e) {
            dump("\nFailed to get data " + e);
            data = (broadcastData.getDataAsNameList != null) ? broadcastData.getDataAsNameList() : null;
          }
          dump("\n\ndata class: " + typeof(data));
          if (data != null)
          {
              dump("\nExtract gaggle data\n");
              //var namelist = (broadcastData.getDataAsNameList != null) ? broadcastData.getDataAsNameList() : broadcastData.getData();
              var goose = javaFiregooseLoader.getGoose();
              if (goose != null)
              {
                  var savedfilename = goose.saveGaggleData(data, "");
                  dump("\nSaved gaggle data file " + savedfilename);
                  if (savedfilename != null)
                  {
                     var dataurl = doc.createElement("a");
                     dataurl.text = broadcastChooser.selectedItem.getAttribute("value");
                     dataurl.href = savedfilename;
                     dataurl.hostname = "";
                     //dataurl.protocol = "file";
                     dump("\nCreated url " + dataurl);
                     FG_collectedData.push(dataurl);
                  }
              }
              hasGaggleData = true;
          }
      }

      if (!hasGaggleData) {
      // We first check if there are any selected text
      //alert(document.commandDispatcher.focusedElement);
          var focusedElement = document.commandDispatcher.focusedElement;
          var elements1;
          var elements2;
          FG_currentTabUrl = "";
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

                  FG_collectedTableData = new Array();
                  for (var i = 0; i < tables.length; i++)  {
                      var curTable = tables[i];
                      dump("\n\n New table " + i);
                      FG_collectedTableData[i] = new Array();

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

                                    if (FG_collectedTableData[i][col] == null)
                                        FG_collectedTableData[i][col] = new Array();
                                    FG_collectedTableData[i][col].push(url);
                                    //dump("\nSaved url to " + FG_collectedTableData[i][col]);
                                    //FG_collectedData.push(url);
                                 }
                             }
                          }
                      }
                  }
                  dump("\nGathered data length: " + (FG_collectedData.length + FG_collectedTableData.length));
              }
          }
      }

      if (FG_collectedData.length > 0 || FG_collectedTableData.length > 0) {
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

function HandleGaggleData(gaggleData, secondaryData)
{
    // Put the data to the holder and the broadcast chooser
    FG_gaggleDataHolder.put(gaggleData);
    FG_populateBroadcastChooser(gaggleData.getDescription());

    // We get a string of concatenated subactions delimited by ';'
    dump("SubAction: " + gaggleData.getSubAction() + "\n");
    var subactions = gaggleData.getSubAction();
    //var action = gaggleData.getWorkflowAction();
    var data = (secondaryData != null) ? secondaryData : gaggleData;
    if (subactions != null && subactions.length > 0)
    {
        FG_Current_WorkflowActions.push(data);
        var actions = subactions.split(";");
        for (var i = 0; i < actions.length; i++)
        {
            dump("Subaction: " + actions[i]);
            if (actions[i] == "NONE")
                continue;
            //var data = gaggleData.getWorkflowActionData();
            //if (data != null && data.length > 0)
            newTab = FG_dispatchBroadcastToWebsite(data, actions[i]);
            if (newTab != null)
            {
                var tabvalue = newTab.value;
                tabvalue += (";;" + gaggleData.getRequestID());
                newTab.value = tabvalue;
                dump("\n\nFinal Tab value: " + newTab.value);
                FG_Current_Tab = newTab;
                //FG_setWorkflowUI(action);
            }
        }
    }
    else
        FG_Workflow_InProgress = false;
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
                    if (datastring.toLowerCase().indexOf(".txt"))
                    {
                        dump("\n\nHandling txt namelist...\n");
                        var namelist = FG_Goose.ProcessTextFile(datastring);
                        if (namelist != null)
                        {
                           dump("\n\nHandle namelist from txt: " + namelist);
                           var deserializedData = new FG_GaggleDeserializedData(namelist, "Namelist");
                           HandleGaggleData(gaggleData, deserializedData);
                        }
                    }
                    else {
                        newTab = getBrowser().addTab(actions[i]);
                        getBrowser().selectedTab = newTab;
                        if (newTab != null)
                        {
                            dump("Setting tab value: " + gaggleData.getRequestID());
                            tabdata = gaggleData.getRequestID();
                            newTab.value = tabdata;
                            FG_Current_Tab = newTab;
                            FG_setWorkflowUI(action);
                        }
                    }
                }
            }
            FG_Current_WorkflowActions.push(gaggleData, subactions);
            FG_Workflow_InProgress = false;
        }
        else
        {
            // This is a WorkflowAction (Contains gaggleData such as Network, Cluster, Namelist, etc and a subaction)
            HandleGaggleData(gaggleData, null);
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

    var tabvalue = FG_Current_Tab.value;
    dump("\nTab value: " + tabvalue);
    var splitted = tabvalue.split(";;");
    var requestID = (splitted.length != 3) ? splitted[0] : splitted[2];
    dump("\nExtracted requestID: " + requestID + "\n");
    var gaggleWorkflowData = FG_findWorkflowData(requestID);
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

FG_GaggleWorkflowDataFromGoose.prototype.getGaggleData = function() {
    var goose = javaFiregooseLoader.getGoose();
    var data = goose.getWorkflowData(this.requestID);
    if (data != undefined && data.length != undefined)
    {
        dump("\nGet gaggle data of length " + data.length);
        for (var i = 0; i < data.length; i++)
        {
            dump("\nName: " + data[i]);
        }
        dump("\n");
        return data[0];
    }
    return null;
}


FG_GaggleWorkflowDataFromGoose.prototype.getDescription = function() {
    return this.getName() + ": " + this.getType() + this._sizeString();
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


// Delegate for restore data
// the name "gaggle" is required for a cheap and sleazy hack in FG_gaggleDataHolder
//FG_GaggleWorkflowDataFromGoose.prototype = new FG_GaggleData("gaggle", requestID);
FG_GaggleDeserializedData.prototype = new FG_GaggleData();
FG_GaggleDeserializedData.prototype.constructor = FG_GaggleDeserializedData;

function FG_GaggleDeserializedData(data, type) {
    try {
        dump("\nData " + data + " Type " + type);
        this._type = type;
        if (type == "Namelist")
        {
            this._data = data;//.getNames();
            this._size = data.getNames().length;
            dump("\nNamelist length: " + this._size);
        }
        else if (type == "Cluster")
        {
            this._data = data;//.getRowNames();
            this._size = data.getRowNames().length;
            dump("\nCluster length: " + this._size);
        }
        else if (type == "Network") {

        }

        this._species = data.getSpecies();
        this._name = data.getName();
    }
    catch (e) {
        dump("\nFailed to analyze deserialized data: " + e);
    }
}

FG_GaggleDeserializedData.prototype.getType = function() {
    return this._type;
}

FG_GaggleDeserializedData.prototype.getSize = function() {
    return this._data.getSize();
}

FG_GaggleDeserializedData.prototype.getSpecies = function() {
    return this._species;
}

FG_GaggleDeserializedData.prototype.getData = function() {
    return this._data;

    // TODO:  handle all data types here and in FireGoose.java
}

FG_GaggleDeserializedData.prototype.getDescription = function() {
    return this.getName() + ": " + this.getType() + this._sizeString();
}

