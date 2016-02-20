/*globals define, WebGMEGlobal*/
/*jshint browser: true*/
/**
 * @author zhangpn / https://github.com/zhangpn
 */

define(['../../../node_modules/webgme/src/client/js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    'widgets/GraphDiffViz/GraphDiffConfigDialog'
], function (CONSTANTS,
             GMEConcepts,
             nodePropertyNames,
             GraphDiffConfigDialog) {

    'use strict';

    var GraphDiffVizControl;

    GraphDiffVizControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._currentNodeId = null;
        this._currentNodeParentId = undefined;

        this._initWidgetEventHandlers();

        this._logger.debug('ctor finished');
    };

    GraphDiffVizControl.prototype._initWidgetEventHandlers = function () {
        this._widget.onNodeClick = function (id) {
            // Change the current active object
            WebGMEGlobal.State.registerActiveObject(id);
        };
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    GraphDiffVizControl.prototype.selectedObjectChanged = function (nodeId) {
        var desc = this._getObjectDescriptor(nodeId),
            self = this;

        self._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (self._currentNodeId) {
            self._client.removeUI(self._territoryId);
        }

        self._currentNodeId = nodeId;
        self._currentNodeParentId = undefined;

        if (self._currentNodeId || self._currentNodeId === CONSTANTS.PROJECT_ROOT_ID) {
            // Put new node's info into territory rules
            self._selfPatterns = {};
            self._selfPatterns[nodeId] = {children: 0};  // Territory "rule"

            self._widget.setTitle(desc.name.toUpperCase());

            if (desc.parentId || desc.parentId === CONSTANTS.PROJECT_ROOT_ID) {
                self.$btnModelHierarchyUp.show();
            } else {
                self.$btnModelHierarchyUp.hide();
            }

            self._currentNodeParentId = desc.parentId;

            self._territoryId = self._client.addUI(self, function (events) {
                self._eventCallback(events);
            });

            // Update the territory
            self._client.updateTerritory(self._territoryId, self._selfPatterns);

            self._selfPatterns[nodeId] = {children: 1};
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

    // This next function retrieves the relevant node information for the widget
    GraphDiffVizControl.prototype._getObjectDescriptor = function (nodeId) {
        var nodeObj = this._client.getNode(nodeId),
            objDescriptor;

        if (nodeObj) {
            objDescriptor = {
                'id': undefined,
                'name': undefined,
                'childrenIds': undefined,
                'parentId': undefined,
                'isConnection': false
            };

            objDescriptor.id = nodeObj.getId();
            objDescriptor.name = nodeObj.getAttribute(nodePropertyNames.Attributes.name);
            objDescriptor.childrenIds = nodeObj.getChildrenIds();
            objDescriptor.childrenNum = objDescriptor.childrenIds.length;
            objDescriptor.parentId = nodeObj.getParentId();
            objDescriptor.isConnection = GMEConcepts.isConnection(nodeId);  // GMEConcepts can be helpful
        }

        return objDescriptor;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    GraphDiffVizControl.prototype._eventCallback = function (events) {
        var i = events ? events.length : 0,
            event;

        this._logger.debug('_eventCallback \'' + i + '\' items');

        while (i--) {
            event = events[i];
            switch (event.etype) {
                case CONSTANTS.TERRITORY_EVENT_LOAD:
                    this._onLoad(event.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UPDATE:
                    this._onUpdate(event.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                    this._onUnload(event.eid);
                    break;
                default:
                    break;
            }
        }

        this._logger.debug('_eventCallback \'' + events.length + '\' items - DONE');
    };

    GraphDiffVizControl.prototype._onLoad = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.addNode(descgiription);
    };

    GraphDiffVizControl.prototype._onUpdate = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.updateNode(description);
    };

    GraphDiffVizControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    GraphDiffVizControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        this.selectedObjectChanged(activeObjectId);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    GraphDiffVizControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        this._removeToolbarItems();
    };

    GraphDiffVizControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
    };

    GraphDiffVizControl.prototype._detachClientEventListeners = function () {
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
    };

    GraphDiffVizControl.prototype.onActivate = function () {
        this._attachClientEventListeners();
        this._displayToolbarItems();
    };

    GraphDiffVizControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
        this._hideToolbarItems();
    };

    /* * * * * * * * * * Updating the toolbar * * * * * * * * * */
    GraphDiffVizControl.prototype._displayToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].show();
            }
        } else {
            this._initializeToolbar();
        }
    };

    GraphDiffVizControl.prototype._hideToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].hide();
            }
        }
    };

    GraphDiffVizControl.prototype._removeToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].destroy();
            }
        }
    };

    GraphDiffVizControl.prototype._initializeToolbar = function () {
        var self = this,
            toolBar = WebGMEGlobal.Toolbar;

        this._toolbarItems = [];

        this._toolbarItems.push(toolBar.addSeparator());

        /************** Go to hierarchical parent button ****************/
        this.$btnModelHierarchyUp = toolBar.addButton({
            title: 'Go to parent',
            icon: 'glyphicon glyphicon-circle-arrow-up',
            clickFn: function (/*data*/) {
                WebGMEGlobal.State.registerActiveObject(self._currentNodeParentId);
            }
        });
        this._toolbarItems.push(this.$btnModelHierarchyUp);
        this.$btnModelHierarchyUp.hide();

        /************** Checkbox example *******************/

        this.$cbShowConnection = toolBar.addCheckBox({
            title: 'toggle checkbox',
            icon: 'gme icon-gme_diagonal-arrow',
            checkChangedFn: function (data, checked) {
                self._logger.log('Checkbox has been clicked!');
            }
        });
        this._toolbarItems.push(this.$cbShowConnection);

        /******** Adding panel configuration button ********/
        this.$panelConfigBtn = toolBar.addButton({
            title: 'Configure panel',
            icon: 'glyphicon glyphicon-cog',
            clickFn: function () {
                var dialog = new GraphDiffConfigDialog();

                // todo: suggest for faster performance
                var branchesResponse = $.ajax({url: "api/projects/" + self._client.getProjectObject().projectId.replace("+", "/") + "/branches", async: false}).responseJSON,
                    branches = branchesResponse ? Object.keys(branchesResponse) : null;

                if (branches) {
                    dialog.show(branches, function () {
                        console.log("branches are: " + branches);
                    });
                }

                //dialog.show(JSON.stringify(metaObj, undefined, 2), function (text) {
                //    try {
                //        var newMetaObj = JSON.parse(text);
                //        client.setMeta(self._metaInfo[CONSTANTS.GME_ID], newMetaObj);
                //    } catch (e) {
                //        self.logger.error('Saving META failed... Either not JSON object or something else went wrong...');
                //    }
                //});
            }
        });
        this._toolbarItems.push(this.$panelConfigBtn);


        this._toolbarInitialized = true;
    };

    return GraphDiffVizControl;
});
