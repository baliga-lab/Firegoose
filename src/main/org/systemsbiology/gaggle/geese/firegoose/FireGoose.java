/*
 * Copyright (C) 2007 by Institute for Systems Biology,
 * Seattle, Washington, USA.  All rights reserved.
 *
 * This source code is distributed under the GNU Lesser
 * General Public License, the text of which is available at:
 *   http://www.gnu.org/copyleft/lesser.html
 */

package org.systemsbiology.gaggle.geese.firegoose;

import java.rmi.RemoteException;
import java.util.*;

import net.sf.json.JSONObject;
import netscape.javascript.JSObject;
import org.systemsbiology.gaggle.core.Boss;
import org.systemsbiology.gaggle.core.Boss3;
import org.systemsbiology.gaggle.core.Goose;
import org.systemsbiology.gaggle.core.Goose3;
import org.systemsbiology.gaggle.core.datatypes.*;
import org.systemsbiology.gaggle.geese.common.GaggleConnectionListener;
import org.systemsbiology.gaggle.geese.common.RmiGaggleConnector;
import org.systemsbiology.gaggle.geese.common.GooseShutdownHook;


/**
 * The FireGoose class is the java side of the Firefox Gaggle
 * toolbar.
 *
 * @author cbare
 */
public class FireGoose implements Goose3, GaggleConnectionListener {
    String activeGooseNames[] = new String[0];
    RmiGaggleConnector connector = new RmiGaggleConnector(this);
    final static String defaultGooseName = "Firegoose";
    String gooseName = defaultGooseName;
    Boss boss;
    Signal hasNewDataSignal = new Signal();
    Signal hasNewWorkflowDataSignal = new Signal();
    Signal hasTargetUpdateSignal = new Signal();

    String species = "unknown";
    String[] nameList;
    String size;
    String type = null;
    Tuple metadata;

    WorkflowManager workflowManager = new WorkflowManager();


    // This class takes a workflowAction and parses it into
    // various properties, which will be retrieved by the
    // Firegoose polling thread
    class WorkflowGaggleData
    {
        String species = "Unknown";
        String[] nameList;
        String size;
        String type;
        Tuple metadata;
        String requestID;
        String subAction;
        WorkflowAction workflowAction;

        public String getSpecies() { return species; }
        public String[] getNameList() { return nameList; }
        public String getSize() { return size; }
        public String getType() { return type; }
        public String getRequestID() { return requestID; }
        public String getSubAction() { return subAction; }
        public WorkflowAction getWorkflowAction() { return workflowAction; }

        public WorkflowGaggleData(String requestID, WorkflowAction workflowAction)
        {
            if (workflowAction != null)
            {
                System.out.println("=====> Initializing Workflow data " + requestID);
                this.requestID = requestID;
                try
                {
                    if (workflowAction.getSource().getParams().containsKey(WorkflowComponent.ParamNames.Data.getValue()))
                    {
                        Object data = workflowAction.getSource().getParams().get(WorkflowComponent.ParamNames.Data.getValue());
                        System.out.println(((GaggleData)data).getName());
                        System.out.println("JSON param: " + workflowAction.getSource().getJSONParams());

                        this.subAction = "";
                        if (workflowAction.getSource().getParams().containsKey(WorkflowComponent.ParamNames.SubTarget.getValue()))
                        {
                            this.subAction = (String)workflowAction.getSource().getParams().get(WorkflowComponent.ParamNames.SubTarget.getValue());
                            System.out.println("Subaction: " + this.subAction);
                        }

                        //this.actionType = "WorkflowAction";
                        //this.sessionID = workflowAction.getSessionID().toString();
                        this.workflowAction = workflowAction;

                        // This has to be done the latest because hasNewDataSignal.increment() is called
                        // in all the handle[GaggleData] functions
                        //boolean dataProcessed = true;
                        if (data != null)
                        {
                            if (data instanceof WorkflowData)
                            {
                                this.type = "WorkflowData";
                                this.nameList = new String[1];
                                this.nameList[0] = (String)(((WorkflowData)data).getData());
                                System.out.println("Workflow data: " + this.nameList[0]);
                            }
                            else if (data instanceof Network)
                                this.handleNetwork(workflowAction.getSource().getName(), (Network) data);
                            else if (data instanceof Cluster)
                                this.handleCluster(workflowAction.getSource().getName(), (Cluster) data);
                            else if (data instanceof DataMatrix)
                                this.handleMatrix(workflowAction.getSource().getName(), (DataMatrix)data);
                            else if (data instanceof Namelist)
                                this.handleNameList(workflowAction.getSource().getName(), (Namelist)data);
                                // TODO support other data types
                            //else
                            //    dataProcessed = false;
                        }
                    }
                }
                catch (Exception e)
                {
                    System.out.println("Failed to handle workflow action: " + e.getMessage());
                }
            }
        }


        private void handleNameList(String sourceGooseName, Namelist namelist) throws RemoteException {
            this.species = namelist.getSpecies();
            this.nameList = namelist.getNames();
            this.type = "NameList";
            this.size = String.valueOf(nameList.length);
            System.out.println("Extracted namelist: " + type + "(" + size + ")");
        }

        private void handleMatrix(String sourceGooseName, DataMatrix simpleDataMatrix) throws RemoteException {
            //TODO
            System.out.println("incoming broadcast: DataMatrix");
        }


        private void handleTuple(String string, GaggleTuple gaggleTuple) throws RemoteException {
            //TODO
            System.out.println("incoming broadcast: gaggleTuple");
        }

        private void handleCluster(String sourceGooseName, Cluster cluster) throws RemoteException {
            // we handle clusters by translating them to namelists
            this.species = cluster.getSpecies();
            this.nameList = cluster.getRowNames();
            this.type = "NameList";
            this.size = String.valueOf(nameList.length);
            System.out.println("Extracted cluster translated to " + type + "(" + size + ")");
        }

        private void handleNetwork(String sourceGooseName, Network network) throws RemoteException {
            System.out.println("incoming broadcast: network");
        }
    }


    // This class stores the orginal request
    // It also serves as a staging area for firegoose to submit data for all the target
    // components one by one. Once all the data is submitted, we call boss.handleWorkflowAction
    // with the response
    class WorkflowStagingData
    {
        private WorkflowAction request;
        private WorkflowAction response;
        private ArrayList<WorkflowComponent> targets;
        private ArrayList<GaggleData> data;

        public WorkflowAction getWorkflowResponse() { return response; }

        public WorkflowStagingData(WorkflowAction request)
        {
            this.request = request;
            this.response = new WorkflowAction(request.getSessionID(),
                                               WorkflowAction.ActionType.Response,
                                               request.getSource(),
                                               null,
                                               request.getOption() | WorkflowAction.Options.SuccessMessage.getValue(),
                                               null
                                               );
            this.targets = new ArrayList<WorkflowComponent>();
            this.data = new ArrayList<GaggleData>();
        }

        public void addSessionData(int targetIndex, GaggleData gdata)
        {
            WorkflowComponent[] reqTargets = this.request.getTargets();
            if (reqTargets != null)
            {
                if (targetIndex < reqTargets.length)
                {
                    System.out.println("Data added for session " + this.request.getSessionID());
                    this.targets.add(reqTargets[targetIndex]);
                    // gdata could be null. Fortunately ArrayList allows null elements
                    this.data.add(gdata);
                }
                else
                {
                    System.out.println("FireGoose: index out of range of all the targets!");
                }
            }
        }

        public boolean finalizeWorkflowAction()
        {
            if (this.targets.size() > 0)
            {
                System.out.println("Finalize targets for " + this.request.getSessionID());
                WorkflowComponent[] targetarray = new WorkflowComponent[this.targets.size()];
                this.targets.toArray(targetarray);
                this.response.setTargets(targetarray);

                System.out.println("Finalize data for " + this.request.getSessionID());
                GaggleData[] dataarray = new GaggleData[this.data.size()];
                this.data.toArray(dataarray);
                this.response.setData(dataarray);
                return true;
            }
            else
            {
                System.out.println("No target for " + this.request.getSessionID());
                return false;
            }
        }
    }

    class WorkflowManager
    {
        HashMap<String, WorkflowStagingData> workflowStagingDataMap = new HashMap<String, WorkflowStagingData>();
        Map<String, WorkflowGaggleData> processingQueue = Collections.synchronizedMap(new HashMap<String, WorkflowGaggleData>());

        public WorkflowManager()
        {

        }

        public String getSpecies(String requestID)
        {
            if (this.processingQueue.containsKey(requestID))
            {
                return this.processingQueue.get(requestID).getSpecies();
            }
            return null;
        }

        public String[] getNameList(String requestID)
        {
            if (this.processingQueue.containsKey(requestID))
                return this.processingQueue.get(requestID).getNameList();
            return null;
        }

        public String getSize(String requestID)
        {
            if (this.processingQueue.containsKey(requestID))
                return this.processingQueue.get(requestID).getSize();
            return null;
        }

        public String getType(String requestID)
        {
            if (this.processingQueue.containsKey(requestID))
                return this.processingQueue.get(requestID).getType();
            return null;
        }

        public String getSubAction(String requestID)
        {
            if (this.processingQueue.containsKey(requestID))
                return this.processingQueue.get(requestID).getSubAction();
            return null;
        }

        public void addSession(WorkflowAction request)
        {
            if (request != null)
            {
                System.out.println("Storing workflow request to the processing queue");
                UUID requestID = UUID.randomUUID();
                WorkflowGaggleData wfgd = new WorkflowGaggleData(requestID.toString(), request);
                this.processingQueue.put(requestID.toString(), wfgd);

                if (!workflowStagingDataMap.containsKey(request.getSessionID())
                    && request.getTargets() != null
                    && request.getTargets().length > 0)
                {
                    System.out.println("Store request " + request.getSessionID());
                    WorkflowStagingData r = new WorkflowStagingData(request);
                    this.workflowStagingDataMap.put(request.getSessionID(), r);
                }
            }
        }

        public WorkflowAction getWorkflowAction(String requestID)
        {
            if (this.processingQueue.containsKey(requestID))
                return this.processingQueue.get(requestID).getWorkflowAction();
            return null;
        }

        public String getCurrentRequest()
        {
            if (!this.processingQueue.isEmpty())
            {
                System.out.println("Getting " + this.processingQueue.size() + " workflow requests...");
                System.out.println((String)((this.processingQueue.keySet().toArray())[0]));
                return (String)((this.processingQueue.keySet().toArray())[0]);
            }
            return null;
        }

        public void removeRequest(String requestID)
        {
            if (requestID != null)
            {
                System.out.println("Removing workflow request " + requestID);
                this.processingQueue.remove(requestID);
            }
        }

        public void addSessionTargetData(String sessionID, int targetIndex, GaggleData data)
        {
            if (this.workflowStagingDataMap.containsKey(sessionID))
            {
                System.out.println("Adding data for " + sessionID);
                WorkflowStagingData stagingData = this.workflowStagingDataMap.get(sessionID);
                if (stagingData != null)
                {
                    stagingData.addSessionData(targetIndex, data);
                }
            }
        }

        public boolean finalizeSessionAction(String sessionID)
        {
            if (this.workflowStagingDataMap.containsKey(sessionID))
            {
                WorkflowStagingData stagingData = this.workflowStagingDataMap.get(sessionID);
                System.out.println("Finalizing response for " + sessionID);
                return stagingData.finalizeWorkflowAction();
            }
            return false;
        }

        public WorkflowAction getSessionResponse(String sessionID)
        {
            if (this.workflowStagingDataMap.containsKey(sessionID))
            {
                System.out.println("Response data for " + sessionID);
                return this.workflowStagingDataMap.get(sessionID).getWorkflowResponse();
            }
            return null;
        }

        public void RemoveSessionData(String sessionID)
        {
            if (this.workflowStagingDataMap.containsKey(sessionID))
            {
                this.workflowStagingDataMap.remove(sessionID);
                System.out.println("Session data removed for " + sessionID);
            }
        }
    }


    public FireGoose() {
        System.out.println("created Firegoose instance");
        connector.setAutoStartBoss(true);
        connector.addListener(this);
        
        // this has no effect. Firefox probably doesn't wait for the JVM to shut down properly.
        new GooseShutdownHook(connector);
    }

    public String getSpecies() {
        return species;
    }

    public void setSpecies(String species) {
        this.species = species;
    }

    public String getWorkflowDataSpecies(String requestID)
    {
        return this.workflowManager.getSpecies(requestID);
    }

    public String[] getNameList() {
        return nameList;
    }

    public String[] getWorkflowDataNameList(String requestID)
    {
        System.out.println("Get workflow namelist");
        return this.workflowManager.getNameList(requestID);
    }

    public String getWorkflowDataSubAction(String requestID)
    {
        return this.workflowManager.getSubAction(requestID);
    }

    /**
     * Used to implement a FG_GaggleData object that represents the
     * broadcast from the Gaggle.
     * See FG_GaggleDataFromGoose in firegoose.js
     * @return a type
     */
    public String getType() {
		return type;
	}

    public String getWorkflowDataType(String requestID)
    {
        return this.workflowManager.getType(requestID);
    }

    public String getSize() {
    	return size;
    }

    public String getWorkflowDataSize(String requestID)
    {
        return this.workflowManager.getSize(requestID);
    }

    public String getWorkflowRequest()
    {
        return this.workflowManager.getCurrentRequest();
    }

    public void removeWorkflowRequest(String requestID)
    {
        if (requestID != null)
        {
            System.out.println("Remove " + requestID + " workflow requests");
            this.workflowManager.removeRequest(requestID);
        }
    }

    public WorkflowAction getWorkflowAction(String requestID)
    {
        return this.workflowManager.getWorkflowAction(requestID);
    }

    public void test(Object object) {
    	// this finally worked somehow:
    	// it's an example of calling into javascript from java
    	// this works w/ the apple MRJPlugin implementation of JSObject
    	// but not with the sun implementation found on windows.
    	if (object == null) {
    		System.out.println("Hey that tickles! It's a null!");
    	}
    	else {
    		System.out.println("I got a " + object.getClass().getName());
    		System.out.println("This object has a name: " + ((JSObject)object).getMember("name"));
    		((JSObject)object).call("test",new Object[] {});
    		System.out.println("did that do anything?");
    	}
    }


    /**
     * a hacky way to signal that we have received a new broadcast
     * from the Gaggle, so we don't have to keep updating. The idea is to
     * compare the return value with the value you got last time. If the
     * value has changed, we got a broadcast since last time you checked.
     * @return an integer that increases every time we get a broadcast.
     */
    public int checkNewDataSignal() {
    	return hasNewDataSignal.check();
    }
    
    public int checkTargetUpdateSignal() {
    	return hasTargetUpdateSignal.check();
    }

    public String[] getGooseNames() {
        List<String> results = new ArrayList<String>();
            for (String name : activeGooseNames) {
                if (!this.gooseName.equals(name)) {
                    results.add(name);
                }
            }

        return results.toArray(new String[0]);
    }

    public void broadcastNameList(String targetGoose, String name, String species, String[] names) {
        try {
            Namelist namelist = new Namelist();
            namelist.setName(name);
            namelist.setSpecies(species);
            namelist.setNames(names);
            boss.broadcastNamelist(gooseName, targetGoose, namelist);
        }
        catch (RemoteException e) {
        	System.out.println("FireGoose: rmi error calling boss.broadcastNamelist");
        }
        catch (Exception e) {
            System.out.println(e);        	
        }
    }

    public void broadcastNetwork(String targetGoose, Network network) {
        try {
            boss.broadcastNetwork(gooseName, targetGoose, network);
        }
        catch (RemoteException e) {
        	System.out.println("FireGoose: rmi error calling boss.broadcastNetwork");
            System.out.println(e);
        }
        catch (Exception e) {
            System.out.println(e);        	
        }
    }

    public void broadcastDataMatrix(String targetGoose, DataMatrix matrix) {
        try {
            boss.broadcastMatrix(gooseName, targetGoose, matrix);
        }
        catch (RemoteException e) {
        	System.out.println("FireGoose: rmi error calling boss.broadcastMatrix");
            System.out.println(e);
        }
        catch (Exception e) {
            System.out.println(e);        	
        }
    }

    public void broadcastMap(String targetGoose, String species, String name, HashMap<String, String> map) {
    	System.out.println("broadcastMap not implemented");
        /*try {
            boss.broadcast(gooseName, targetGoose, species, name, map);
        }
        catch (RemoteException e) {
            System.err.println("SampleGoose: rmi error calling boss.broadcast (map)");
            System.out.println(e);
        } */
    }

    public void broadcastCluster(String targetGoose, String species, String name, String [] rowNames, String [] columnNames) {
        try {
        	Cluster cluster = new Cluster(name, species, rowNames, columnNames);
            boss.broadcastCluster(gooseName, targetGoose, cluster);
        }
        catch (RemoteException e) {
            System.err.println("FireGoose: rmi error calling boss.broadcast (map)");
            System.out.println(e);
        }
    }

    public void showGoose(String gooseName) {
        try {
            boss.show(gooseName);
        }
        catch (RemoteException e) {
        	System.out.println("FireGoose: rmi error calling boss.show (gooseName)");
            System.out.println(e);
        }
        catch (Exception e) {
            System.out.println(e);
        }
    }

    public void hideGoose(String gooseName) {
        try {
            boss.hide(gooseName);
        }
        catch (RemoteException e) {
        	System.out.println("FireGoose: rmi error calling boss.hide (gooseName)");
            System.out.println(e);
        }
        catch (Exception e) {
            System.out.println(e);
        }
    }


    public void disconnectFromGaggle() {
        connector.disconnectFromGaggle(true);
    }


    public void setAutoStartBoss(boolean autoStartBoss) {
    	this.connector.setAutoStartBoss(autoStartBoss);
    }
    
    public boolean getAutoStartBoss() {
    	return this.connector.getAutoStartBoss();
    }


    // Goose methods ---------------------------------------------------------

    public void connectToGaggle() throws Exception {
    	try {
	    	if (!connector.isConnected()) {
	    		gooseName = defaultGooseName;
	    		connector.connectToGaggle();
	    	}
    	}
    	catch (Exception e) {
    		System.out.println("Exception trying to connect to Boss:");
    		e.printStackTrace();
    	}
    }

    /**
     * Try to connect to Gaggle without autostarting Boss.
     */
    public void connectToGaggleIfAvailable() throws Exception {
    	boolean autostart = connector.getAutoStartBoss();
		try {
			connector.setAutoStartBoss(false);
			connector.connectToGaggle();
		}
		catch (Exception e) {
			System.out.println("Firegoose tried and failed to connect to Gaggle Boss: " + e.getClass().getName() + ": " + e.getMessage() );
		}
		finally {
			connector.setAutoStartBoss(autostart);
		}

    }

    public void handleNameList(String sourceGooseName, Namelist namelist) throws RemoteException {
        this.species = namelist.getSpecies();
        this.nameList = namelist.getNames();
        this.type = "NameList";
        this.size = String.valueOf(nameList.length);
        System.out.println("incoming broadcast: " + type + "(" + size + ")");
        System.out.println("Current signal value: " + hasNewDataSignal.check());
        hasNewDataSignal.increment();
        System.out.println("New signal value: " + hasNewDataSignal.check());
    }

    public void handleMatrix(String sourceGooseName, DataMatrix simpleDataMatrix) throws RemoteException {
        //TODO
        System.out.println("incoming broadcast: DataMatrix");
    }


    public void handleTuple(String string, GaggleTuple gaggleTuple) throws RemoteException {
        //TODO
        System.out.println("incoming broadcast: gaggleTuple");
    }

    public void handleCluster(String sourceGooseName, Cluster cluster) throws RemoteException {
    	// we handle clusters by translating them to namelists
        this.species = cluster.getSpecies();
        this.nameList = cluster.getRowNames();
        this.type = "NameList";
        this.size = String.valueOf(nameList.length);
        hasNewDataSignal.increment();
        System.out.println("incoming broadcast: cluster translated to " + type + "(" + size + ")");
    }

    public void handleNetwork(String sourceGooseName, Network network) throws RemoteException {
        System.out.println("incoming broadcast: network");
    }

    // Received workflow request from another component
    // We store the action in the workflowManager and then call the corresponding handle functions
    // to store properties of the data
    public void handleWorkflowAction(org.systemsbiology.gaggle.core.datatypes.WorkflowAction workflowAction)
    {
        if (workflowAction != null)
        {
            System.out.println("Received workflow action request!!");
            this.workflowManager.addSession(workflowAction);
        }
    }

    public void handleWorkflowInformation(java.lang.String s, java.lang.String s1)
    {

    }

    public void handleTable(java.lang.String s, org.systemsbiology.gaggle.core.datatypes.Table table)
    {

    }


    // Submit a NameList to the workflow manager
    // names is a delimited string of all the names
    public void submitNameList(String sessionID, int targetIndex, String name, String species, String[] names) //, String delimit)
    {
        //System.out.println("Got Namelist..." + names + " " + delimit);
        try
        {
            Namelist namelist = new Namelist();
            namelist.setName(name);
            namelist.setSpecies(species);
            //String[] splittedstrings = names.split(delimit);
            namelist.setNames(names); //.split(delimit));
            this.workflowManager.addSessionTargetData(sessionID, targetIndex, namelist);
            System.out.println("Added namelist to workflow manager " + sessionID);
        }
        catch (Exception e)
        {
            System.out.println("Failed to submit Namelist to workflow: " + e.getMessage());
        }
    }

    public void submitNetwork(String sessionID, int targetIndex, Network network) {
        this.workflowManager.addSessionTargetData(sessionID, targetIndex, network);
        System.out.println("Added network to workflow manager " + sessionID);
    }

    public void submitDataMatrix(String sessionID, int targetIndex, DataMatrix matrix) {
        this.workflowManager.addSessionTargetData(sessionID, targetIndex, matrix);
        System.out.println("Added Matrix to workflow manager " + sessionID);
    }

    public void submitMap(String sessionID, int targetIndex, String species, String name, HashMap<String, String> map) {
        System.out.println("Map not implemented");
//        try {
//            boss.broadcast(gooseName, targetGoose, species, name, map);
//        }
//        catch (RemoteException e) {
//            System.err.println("SampleGoose: rmi error calling boss.broadcast (map)");
//            System.out.println(e);
//        }
    }

    public void submitCluster(String sessionID, int targetIndex, String species, String name,
                              String [] rowNames, String [] columnNames)
    {
        Cluster cluster = new Cluster(name, species, rowNames, columnNames);
        this.workflowManager.addSessionTargetData(sessionID, targetIndex, cluster);
        System.out.println("Added cluster to workflow manager " + sessionID);
    }

    // All the data are ready, we submit the response to the boss
    public void CompleteWorkflowAction(String sessionID)
    {
        if (this.workflowManager.finalizeSessionAction(sessionID))
        {
            WorkflowAction response = this.workflowManager.getSessionResponse(sessionID);
            if (response != null)
            {
                if (boss instanceof Boss3)
                {
                    try
                    {
                        System.out.println("About to send workflow response to boss...");
                        ((Boss3)boss).handleWorkflowAction(response);
                        System.out.println("Data Sent!");
                    }
                    catch (Exception e)
                    {
                        System.out.println("Failed to submit workflow response to boss: " + e.getMessage());
                    }
                }
                else
                    System.out.println("Boss does not support Workflow!");
            }
        }
        this.workflowManager.RemoveSessionData(sessionID);
    }



    public void update(String[] gooseNames) throws RemoteException {
        this.activeGooseNames = gooseNames;
        this.hasTargetUpdateSignal.increment();
    }

    public String getName() {
        return gooseName;
    }

    public void setName(String gooseName) {
        this.gooseName = gooseName;
        System.out.println("Set firegoose name to: " + this.gooseName);
    }


    public Tuple getMetadata() {
        return metadata;
    }

    public void setMetadata(Tuple metadata) {
        this.metadata = metadata;
    }

    public void doBroadcastList() {
        // TODO Auto-generated method stub
    }

    public void doExit() throws RemoteException {
        // TODO Auto-generated method stub
    }

    public void doHide() {
        // TODO Auto-generated method stub
        // could use window.focus() and window.blur() to implement these, if
        // we had a method of calling javascript from java.
    	System.out.println("FireGoose.doHide()");
    }

    public void doShow() {
    	System.out.println("FireGoose.doShow()");
    }

    public String[] getSelection() {
        // TODO Auto-generated method stub
        return null;
    }

    public int getSelectionCount() {
        // TODO Auto-generated method stub
        return 0;
    }

    public void clearSelections() {
        // TODO Auto-generated method stub
    }

    //implements GaggleConnectionListener
	public void setConnected(boolean connected, Boss boss) {
		if (connected) {
			this.boss = boss;
		}
		else {
			this.boss = null;
		}
		System.out.println("set connected: " + connected);
		System.out.println("isConnected: " + connector.isConnected());
	}
    
    public boolean isConnected() {
        return connector.isConnected();
    }






    /*
    public void handleMap(String species, String dataTitle, HashMap hashMap) {
        this.species = species;
        this.dataTitle = dataTitle;
        this.map = hashMap;
        this.incomingDataMsg = "Map(" + hashMap.size() + ")";
    }

    public void handleMatrix(DataMatrix matrix) throws RemoteException {
        this.species = matrix.getSpecies();
        this.dataMatrix = matrix;
        this.incomingDataMsg = "Matrix(" + matrix.getRowCount() + "x" + matrix.getColumnCount() + ")";
    }

    public void handleNetwork(String species, Network network) throws RemoteException {
        this.species = species;
        this.network = network;
        this.incomingDataMsg = "Network(" + network.nodeCount() + "x" + network.edgeCount() + ")";
    }
    */


    // end Goose methods -----------------------------------------------------

	/**
	 * A signal to tell when a new broadcast from the Gaggle has arrived. Dunno
	 * if this really helps thread safety much, but it's an effort in that direction.
	 */
	private static class Signal {
		private int value = 0;

		/**
		 * @return the value of the signal.
		 */
		public synchronized int check() {
			return value;
		}

		public synchronized void reset() {
			value = 0;
		}

		/**
		 * increment the value of the signal.
		 */
		public synchronized void increment() {
			value++;
		}
	}
}
