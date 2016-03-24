/*globals define, WebGMEGlobal*/
/*jshint browser: true*/
/**
 * @author zhangpn / https://github.com/zhangpn
 */

define(['../../../node_modules/webgme/src/client/js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    'widgets/GraphDiffViz/GraphDiffConfigDialog',
    'js/Panels/GraphViz/GraphVizPanelControl',
    'underscore'
], function (CONSTANTS,
             GMEConcepts,
             nodePropertyNames,
             GraphDiffConfigDialog,
             GraphVizPanelControl,
             underscore) {

    'use strict';

    var GraphDiffVizControl,
        IGNORED_KEYS = ["guid", "removed", "oGuids", "hash", "pointer", "set", "validPlugins", "CrossCuts", "meta", "childrenListChanged"],
        IGNORED_KEYS_IN_ADDED_NODE = ["_id", "pointer", "base", "reg", "atr"];


    GraphDiffVizControl = function (options) {

        var opts = _.extend( {}, options);

        GraphVizPanelControl.apply(this, [opts]);

        this._diffProcessed = false;

        this._logger.debug('ctor finished');
    };

    _.extend(GraphDiffVizControl.prototype, GraphVizPanelControl.prototype);

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
                var dialog = new GraphDiffConfigDialog(),
                    branches = self._getAvailableBranches();

                // todo: suggest for faster performance

                if (branches) {
                    dialog.show(branches, self._previousConfigs, function (previousConfigs) {
                        if (!_.isEqual(previousConfigs, self._previousConfigs)) {
                            self._previousConfigs = previousConfigs;
                            self._otherBranch = previousConfigs[1];
                            self._firstBranch = previousConfigs[0];

                            self._diffProcessed = false;
                            self._generateData();
                        }
                    });
                }
            }
        });
        this._toolbarItems.push(this.$panelConfigBtn);


        this._toolbarInitialized = true;
    };


    GraphDiffVizControl.prototype._initWidgetEventHandlers = function () {
        var self = this;

        this._graphVizWidget.onBackgroundDblClick = function () {
            if (self._currentNodeParentId) {
                WebGMEGlobal.State.registerActiveObject(self._currentNodeParentId);
            }
        };

        this._graphVizWidget.onNodeOpen = function (id) {
            self._selfPatterns[id] = {children: 1};
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        };

        this._graphVizWidget.onNodeDblClick = function (id) {
            WebGMEGlobal.State.registerActiveObject(id);
        };

        this._graphVizWidget.onNodeClose = function (id) {
            var deleteRecursive,
                node,
                childrenIDs,
                i;

            deleteRecursive = function (nodeId) {
                if (self._selfPatterns.hasOwnProperty(nodeId)) {
                    node = self._nodes[nodeId];

                    if (node) {
                        childrenIDs = node.childrenIDs;
                        for (i = 0; i < childrenIDs.length; i += 1) {
                            deleteRecursive(childrenIDs[i]);
                        }
                    }

                    delete self._selfPatterns[nodeId];
                }
            };

            //call the cleanup recursively
            deleteRecursive(id);

            if (id === self._currentNodeId) {
                self._selfPatterns[id] = {children: 0};
            }

            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        };
    };

    GraphDiffVizControl.prototype.selectedObjectChanged = function (nodeId) {
        var desc = this._getObjectDescriptor(nodeId),
            self = this;

        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        //remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;
        this._currentNodeParentId = undefined;

        this._nodes = {};

        if (this._currentNodeId || this._currentNodeId === CONSTANTS.PROJECT_ROOT_ID) {
            //put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = {children: 0};

            this._graphVizWidget.setTitle(desc.name.toUpperCase());

            if (desc.parentId || desc.parentId === CONSTANTS.PROJECT_ROOT_ID) {
                this.$btnModelHierarchyUp.show();
            } else {
                this.$btnModelHierarchyUp.hide();
            }

            this._currentNodeParentId = desc.parentId;

            this._territoryId = this._client.addUI(this, function (events) {
                self._eventCallback(events);
            });
            //update the territory
            this._client.updateTerritory(this._territoryId, this._selfPatterns);

            setTimeout(function () {
                self._selfPatterns[nodeId] = {children: 1};
                self._client.updateTerritory(self._territoryId, self._selfPatterns);
            }, 1000);
        }
    };

    GraphDiffVizControl.prototype._getAvailableBranches = function () {
        var branchesResponse = $.ajax({
            url: "api/projects/" + this._client.getProjectObject().projectId.replace("+", "/") + "/branches",
            async: false
        }).responseJSON;

        return branchesResponse ? Object.keys(branchesResponse) : null;
    };

    GraphDiffVizControl.prototype._generateData = function () {
        var self = this,
            data;

        data = _.extend({},
            (this._currentNodeId || this._currentNodeId === CONSTANTS.PROJECT_ROOT_ID ) ?
                this._nodes[this._currentNodeId] : {});

        function loadRecursive(node) {
            var len = (node && node.childrenIDs) ? node.childrenIDs.length : 0;
            while (len--) {
                node.children = node.children || [];
                if (self._nodes[node.childrenIDs[len]]) {
                    if ((self._displayModelsOnly === true &&
                        self._nodes[node.childrenIDs[len]].isConnection !== true) ||
                        self._displayModelsOnly === false) {
                        node.children.push(_.extend({}, self._nodes[node.childrenIDs[len]]));
                        loadRecursive(node.children[node.children.length - 1]);
                    }
                }
            }
        }



        loadRecursive(data);


        if (!this._diffProcessed) {
            this._getDiffs();
            this._diffProcessed = true;
        }
        if (this.addedNodes || this.removedNodes) {
            this._updateData(data);
        }

        this._graphVizWidget.setData(data);
    };

    GraphDiffVizControl.prototype._checkBranchSwitching = function () {
        var branch1 = WebGMEGlobal.Client.getActiveBranchName(),    // make first branch current branch
            branch2 = this._otherBranch;

        return branch1 && branch2 && branch1 === branch2;
    };

    GraphDiffVizControl.prototype._updateData = function (data) {
        var self = this,
            _findInsertionPoint,
            _insertChildNode,
            _getInsertionIndex;

        //if (this._checkBranchSwitching()) return;

        _insertChildNode = function (nodeToAdd, pNode) {

            if (pNode.childrenIDs.indexOf(nodeToAdd.id) === -1) {
                pNode.childrenIDs.push(nodeToAdd.id);
            }

            if (pNode.childrenIDs.length) {
                if (pNode.children) {
                    if (pNode.children.length) {
                        pNode.children.unshift(nodeToAdd);
                    }
                } else {
                    pNode.children = [nodeToAdd];
                }
            }
            //if (pNode.childrenIDs.length > 0) {
            //    if (!pNode.children) {
            //        pNode.children = [];
            //    }
            //    pNode.children.unshift(nodeToAdd);
            //}
            // else if (pNode.childrenNum > 0) {
            //    pNode.children = [];
            //    pNode.children.push(nodeToAdd);
            //}

            //if (pNode.childrenIDs.length > 0)


            //pNode.children.unshift(nodeToAdd);
            pNode.childrenNum = pNode.childrenIDs.length;
        };

        _getInsertionIndex = function (nodes, idToFind) {
            for (var i = 0; i < nodes.length; i += 1) {
                if (nodes[i].id === idToFind) {
                    return i;
                }
            }
            return -1;
        };

        _findInsertionPoint = function (pid, nodeToAdd, pNode) {

            if (pid === pNode.id) {
                _insertChildNode(nodeToAdd, pNode);
                return true;
            } else if (pNode.children && pNode.children.length && pNode.childrenIDs.length) {
                if (pNode.childrenIDs.indexOf(pid) > -1) {
                    var index = pNode.children.length === pNode.childrenIDs.length ?
                        pNode.childrenIDs.length - 1 - pNode.childrenIDs.indexOf(pid) :
                        _getInsertionIndex(pNode.children, pid);

                    if (index === -1) return false;

                    _insertChildNode(nodeToAdd, pNode.children[index]);
                    return true;
                } else {
                    for (var i = 0; i < pNode.children.length; ++i) {
                        var found = _findInsertionPoint(pid, nodeToAdd, pNode.children[i]);
                        if (found) return true;
                    }
                }
            }
            return false;
        };


        // find added node's parent and add it to its child node
        for (var n in this.addedNodes) {
            if (this.addedNodes.hasOwnProperty(n)) {
                // todo: isConnection attribute check
                var parentId = self.addedNodes[n].parent,
                    addedNode = {
                        childrenIDs: [],
                        childrenNum: 0,
                        id: n,
                        isConnection: false,
                        name: self.addedNodes[n].node && self.addedNodes[n].node.atr ? self.addedNodes[n].node.atr.name : 'unnamed',  // todo: get name from project
                        parentId: parentId
                    };
                this.nodeDataByPath[n] = {
                    added: true
                };
                if (!this.nodeDataByPath[parentId]) {
                    this.nodeDataByPath[parentId] = {};
                }
                this.nodeDataByPath[parentId].childMajorChange = true;
                _findInsertionPoint(parentId, addedNode, data);
            }
        }
    };

    GraphDiffVizControl.prototype._getDiffs = function () {
        //if (this._checkBranchSwitching()) return;
        var branch1 = this._firstBranch,
            branch2 = this._otherBranch,
            projectId = WebGMEGlobal.Client.getProjectObject().projectId,
            projectSubUrl = projectId.replace("+", "/"),
            url = "/api/projects/" + projectSubUrl + "/compare/" + branch1 + "..." + branch2,
            diffObj = $.ajax({url: url, async: false}).responseJSON;


        this.nodeDataByPath = {};
        this.idToBaseNodes = {};
        this.addedNodes = {};
        this.removedNodes = {};


        this._projectSubUrl = projectSubUrl;
        this._processDiffObject(diffObj);

    };

    GraphDiffVizControl.prototype._processDiffObject = function (diff) {
        // recursively get each diff
        var self = this,
            client = WebGMEGlobal.Client,
            path,
            i,
            node = self.rootNode;

        for (i in diff) {
            if (diff.hasOwnProperty(i)) {
                // todo: skip guid and oGuids for now but use this info for later
                if (IGNORED_KEYS.indexOf(i) > -1) continue;
                if (i === "attr") {
                    node.attrChange = true;
                } else if (i === "reg") {
                    node.regChange = true;
                } else {
                    path = "/" + i;
                    node = client.getNode(path);
                    // todo: directly store this data at node
                    if (!self.nodeDataByPath[path]) {
                        self.nodeDataByPath[path] = {};
                        self.nodeDataByPath[path].parentPath = "";
                    }
                    self._processAddRemoveNodes(diff, i, "");
                    if (Object.keys(diff[i]).length > 2) {
                        self._processDiffObjectRec(diff[i], path);
                    }
                }
                // get node from path

            }
        }

    };


    GraphDiffVizControl.prototype._processDiffObjectRec = function (diff, path) {
        // recursively get each diff
        var self = this,
            i;

        for (i in diff) {
            if (diff.hasOwnProperty(i)) {
                // todo: skip guid and oGuids for now but use this info for later
                if (IGNORED_KEYS.indexOf(i) > -1) continue;
                if (i === "attr") {
                    self.nodeDataByPath[path].attrChange = true;
                    if (self.nodeDataByPath[path].parentPath) {
                        self.nodeDataByPath[self.nodeDataByPath[path].parentPath].childChange = true;
                    }
                } else if (i === "reg") {
                    self.nodeDataByPath[path].regChange = true;
                    if (self.nodeDataByPath[path].parentPath) {
                        self.nodeDataByPath[self.nodeDataByPath[path].parentPath].childChange = true;
                    }
                } else {
                    // todo: directly store this data at node
                    if (!self.nodeDataByPath[path + "/" + i]) {
                        self.nodeDataByPath[path + "/" + i] = {};
                        self.nodeDataByPath[path + "/" + i].parentPath = path;
                    }
                    self._processAddRemoveNodes(diff, i, path);
                    if (Object.keys(diff[i]).length > 2) {
                            self._processDiffObjectRec(diff[i], path + "/" + i);
                    }
                }
            }
        }
    };

    GraphDiffVizControl.prototype._processAddRemoveNodes = function (diff, i, path) {
        var self = this;
        if (diff[i].pointer && diff[i].pointer["base"]) {
            self.idToBaseNodes[path + "/" + i] = diff[i].pointer["base"];
        }

        if (diff[i].hasOwnProperty("removed")) {

            if (!self.nodeDataByPath[path + "/" + i]) {
                self.nodeDataByPath[path + "/" + i] = {};
            }
            if (!diff[i].removed) {
                // node may be added in the other branch, attempt to retrieve that node
                var url = "/api/projects/" + self._projectSubUrl + "/branches/" + self._otherBranch + "/tree" + path + "/" + i,
                    n = $.ajax({url: url, async: false}).responseJSON;
                //"/api/projects/guest/SysML/branches/master/tree/749768943/391052248"
                if (!self.addedNodes.hasOwnProperty(path + "/" + i)) {
                    self.addedNodes[path + "/" + i] = {};
                    self.addedNodes[path + "/" + i].node = n;
                    self.addedNodes[path + "/" + i].parent = path;
                }
                self._markChildrenAdded(path + "/" + i, diff[i]);
            } else {
                if (!self.nodeDataByPath[path]) {
                    self.nodeDataByPath[path] = {};
                }
                self.nodeDataByPath[path + "/" + i].removed = true;
                self.removedNodes[path + "/" + i] = true;
                self._markChildrenRemoved(path + "/" + i);
            }
            if (path) {
                self.nodeDataByPath[path].childMajorChange = true;
            }
        }
    };

    GraphDiffVizControl.prototype._markChildrenAdded = function (parentId, diff) {
        var self = this;

        for (var i in diff) {
            if (diff.hasOwnProperty(i) && IGNORED_KEYS.indexOf(i) === -1) {
                var url = "/api/projects/" + self._projectSubUrl + "/branches/" + self._otherBranch + "/tree" + parentId + "/" + i,
                    n = $.ajax({url: url, async: false}).responseJSON;

                self.addedNodes[parentId + '/' + i] = {
                    node: n,
                    parent: parentId
                };
                self._markChildrenAdded(parentId + '/' + i, diff[i]);
            }
        }
    };

    GraphDiffVizControl.prototype._markChildrenRemoved = function (parentId) {
        var client = this._client,
            node = client.getNode(parentId),
            childrenIds = node ? node.getChildrenIds() : [],
            i;

        for (i = 0; i < childrenIds.length; i += 1) {
            if (!this.nodeDataByPath[childrenIds[i]]) {
                this.nodeDataByPath[childrenIds[i]] = {};
            }
            this.nodeDataByPath[childrenIds[i]].removed = true;
            this.nodeDataByPath[parentId].childMajorChange = true;
            this.removedNodes[childrenIds[i]] = true;
            this._markChildrenRemoved(childrenIds[i]);
        }

    };


    return GraphDiffVizControl;
});
