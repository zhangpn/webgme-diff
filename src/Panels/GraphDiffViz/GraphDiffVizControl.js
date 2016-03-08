/*globals define, WebGMEGlobal*/
/*jshint browser: true*/
/**
 * @author zhangpn / https://github.com/zhangpn
 */

define(['../../../node_modules/webgme/src/client/js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    'widgets/GraphDiffViz/GraphDiffConfigDialog',
    'js/Panels/GraphViz/GraphVizPanelControl'
], function (CONSTANTS,
             GMEConcepts,
             nodePropertyNames,
             GraphDiffConfigDialog,
             GraphVizPanelControl) {

    'use strict';

    var GraphDiffVizControl,
        IGNORED_KEYS = ["guid", "oGuids", "hash", "pointer", "set", "validPlugins", "CrossCuts", "meta", "childrenListChanged"];


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
                    dialog.show(branches, function (previousConfigs) {
                        self._previousConfigs = previousConfigs;
                        self._otherBranch = branches[1];
                        self._firstBranch = branches[0];

                        self._diffProcessed = false;
                        self._generateData();
                    });
                }
            }
        });
        this._toolbarItems.push(this.$panelConfigBtn);


        this._toolbarInitialized = true;
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

        if (!this._diffProcessed) {
            this._getDiffs();
            this._diffProcessed = true;
        }


        loadRecursive(data);


        if (this.addedNodes) {
            this._updateData(data);
        }

        this._graphVizWidget.setData(data);
    };

    GraphDiffVizControl.prototype._updateData = function (data) {
        var self = this,
            _findInsertionPoint,
            _insertChildNode;


        _insertChildNode = function (nodeToAdd, pNode) {
            if (pNode.childrenIDs.length > 0 && pNode.children.length > 0) {
                pNode.children.splice(0, 0, nodeToAdd);
            }
            if (pNode.childrenIDs.indexOf(nodeToAdd.id) === -1) {
                pNode.childrenIDs.push(nodeToAdd.id);
            }

            pNode.childrenNum = pNode.childrenIDs.length;
        };

        _findInsertionPoint = function (pid, nodeToAdd, pNode) {

            if (pid === pNode.id) {
                _insertChildNode(nodeToAdd, pNode);
                return true;
            } else if (pNode.children && pNode.children.length === pNode.childrenIDs.length) {
                if (pNode.childrenIDs.indexOf(pid) > -1) {
                    var index = pNode.childrenIDs.length - 1 - pNode.childrenIDs.indexOf(pid);
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
                        name: "RoomB",  // todo: get name from project
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

    GraphDiffVizControl.prototype._getDiffs = function (nodes, links) {
        var branch1 = this._firstBranch,
            branch2 = this._otherBranch,
            projectId = WebGMEGlobal.Client.getProjectObject().projectId,
            projectSubUrl = projectId.replace("+", "/"),
            url = "/api/projects/" + projectSubUrl + "/compare/" + branch1 + "..." + branch2,
            diffObj = $.ajax({url: url, async: false}).responseJSON;


        this.nodeDataByPath = {};
        this.idToBaseNodes = {};
        this.addedNodes = {};


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
                    }
                    self._processDiffObjectRec(diff[i], path, node);
                }
                // get node from path

            }
        }

    };


    GraphDiffVizControl.prototype._processDiffObjectRec = function (diff, path, node) {
        // recursively get each diff
        var self = this,
            client = WebGMEGlobal.Client,
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
                } else if (i === "removed") {
                    //self.nodeDataByPath[self.nodeDataByPath[path].parentPath].childMajorChange = true;
                    if (diff[i]) {
                        self.nodeDataByPath[path].removed = true;
                    } else {
                        self.nodeDataByPath[path].added = true;
                    }
                } else {
                    node = client.getNode(path + "/" + i);
                    if (node) {
                        //self._openNode(path);
                        // todo: directly store this data at node
                        if (!self.nodeDataByPath[path + "/" + i]) {
                            self.nodeDataByPath[path + "/" + i] = {};
                            self.nodeDataByPath[path + "/" + i].parentPath = path;
                        }
                        // if guid and oguid are the only keys of diff obj, skip it
                        if (Object.keys(diff[i]).length > 2 && diff[i].hasOwnProperty("guid") && diff[i].hasOwnProperty("oGuids")) {
                            self._processDiffObjectRec(diff[i], path + "/" + i, node);
                        }
                    } else {
                        //node =
                        //if ()
                        if (diff[i].pointer && diff[i].pointer["base"]) {
                            self.idToBaseNodes[path + "/" + i] = diff[i].pointer["base"];
                        }

                        if (diff[i].hasOwnProperty("removed") ) {

                            if (diff[i].removed === false) {

                                // node may be added in the other branch, attempt to retrieve that node
                                var url = "/api/projects/" + self._projectSubUrl + "/branches/" + self._otherBranch + "/tree" + path + "/" + i,
                                    n = $.ajax({url: url, async: false}).responseJSON;
                                //"/api/projects/guest/SysML/branches/master/tree/749768943/391052248"
                                if (!self.addedNodes.hasOwnProperty(path + "/" + i)) {
                                    self.addedNodes[path + "/" + i] = {};
                                    self.addedNodes[path + "/" + i].node = n;
                                    self.addedNodes[path + "/" + i].parent = path;
                                }
                            } else if (diff[i].removed === true) {
                                if (!self.nodeDataByPath[path]) {
                                    self.nodeDataByPath[path] = {};
                                }
                                self.nodeDataByPath[path].childMajorChange = true;
                            }
                        }

                    }

                }
                // get node from path
            }
        }
    };


    return GraphDiffVizControl;
});
