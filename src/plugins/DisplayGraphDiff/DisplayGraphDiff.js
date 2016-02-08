/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Sat Jan 30 2016 19:42:14 GMT+0800 (CST).
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase'
], function (
    PluginConfig,
    PluginBase) {
    'use strict';

    /**
     * Initializes a new instance of DisplayGraphDiff.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin DisplayGraphDiff.
     * @constructor
     */
    var DisplayGraphDiff = function () {
        // Call base class' constructor.
        this.nodeDataByPath = {};
        PluginBase.call(this);
    };

    // Prototypal inheritance from PluginBase.
    DisplayGraphDiff.prototype = Object.create(PluginBase.prototype);
    DisplayGraphDiff.prototype.constructor = DisplayGraphDiff;

    /**
     * Gets the name of the DisplayGraphDiff.
     * @returns {string} The name of the plugin.
     * @public
     */
    DisplayGraphDiff.prototype.getName = function () {
        return 'DisplayGraphDiff';
    };

    /**
     * Gets the semantic version (semver.org) of the DisplayGraphDiff.
     * @returns {string} The version of the plugin.
     * @public
     */
    DisplayGraphDiff.prototype.getVersion = function () {
        return '0.1.0';
    };

    DisplayGraphDiff.prototype.getConfigStructure = function () {
        //var self = this,
            //branchesResponse = $.ajax({url: "api/projects/" + self.projectId.replace("+", "/") + "/branches", async: false}).responseJSON,
            //branches = branchesResponse ? Object.keys(branchesResponse) : [];

        // todo: in the plugin window show a list of available branches
        return [
            {
                name: 'branch1Name',
                displayName: 'First branch name',
                description: 'Select the first branch to compare',
                value: 'master',
                valueType: 'string',
                valueItems: ['master', 'alter'],
                readOnly: false
            },
            {
                name: 'branch2Name',
                displayName: 'Second branch name',
                description: 'Select the second branch to compare',
                value: 'alter',
                valueType: 'string',
                valueItems: ['master', 'alter'],
                readOnly: false
            }
        ];
    };

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    DisplayGraphDiff.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            nodeObject;


        // Using the logger.
        //self.logger.debug('This is a debug message.');
        //self.logger.info('This is an info message.');
        //self.logger.warn('This is a warning message.');
        //self.logger.error('This is an error message.');

        // Using the coreAPI to make changes.

        // todo: allow user to select 2 branches to compare
        self.currentConfig = self.getCurrentConfig();
        var b1 = self.currentConfig.branch1Name,
            b2 = self.currentConfig.branch2Name,
            url = "/api/projects/" + self.projectId.replace("+", "/") + "/compare/" + b1 + "..." + b2;

        // get the diff json between selected branch1 and branch2
        var diff = $.ajax({url: url, async: false}).responseJSON;

        // process this diff
        self._processDiffObject(diff);

        // todo: redirect to graph view
        //window.location.href = window.location.href.replace("ModelEditor", "GraphViz");
        //window.location.href = window.location.href.replace("Crosscut", "GraphViz");
        //window.location.href = window.location.href.replace("SetEditor", "GraphViz");


        // todo: when plugin runs, it updates the color attributes of graph view of the two branches

        // todo: when two versions are the same, use default colors; when different, use other colors


        // todo: find id with special char use .find('[id="' + "/4" + '"]')  use [id^=] finds by partial id

        var graphNodes = $('g.node'),
            node,
            modifiedNode;

        for (node in self.nodeDataByPath) {
            if (self.nodeDataByPath.hasOwnProperty(node)) {
                modifiedNode = graphNodes.find('[id="' + node + '"]');
                if (modifiedNode) {
                    self._modifiyNode(modifiedNode);
                }
            }
        }



        nodeObject = self.activeNode;
        //
        //self.core.setAttribute(nodeObject, 'name', 'My new obj');
        //self.core.setRegistry(nodeObject, 'position', {x: 70, y: 70});

        self.result.setSuccess(true);
        callback(null, self.result);

    };

    DisplayGraphDiff.prototype._processDiffObject = function (diff) {
        // recursively get each diff
        var self = this,
            client = WebGMEGlobal.Client,
            path,
            i,
            node = self.rootNode;

        for (i in diff) {
            if (diff.hasOwnProperty(i)) {
                // todo: skip guid and oGuids for now but use this info for later
                if (i === "guid" || i === "oGuids") continue;
                if (i === "attr") {
                    node.attrChange = true;
                } else if (i === "reg") {
                    node.regChange = true;
                } else {
                    node.childChange = true;
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

    DisplayGraphDiff.prototype._processDiffObjectRec = function (diff, path, node) {
        // recursively get each diff
        var self = this,
            client = WebGMEGlobal.Client,
            i;

        for (i in diff) {
            if (diff.hasOwnProperty(i)) {
                // todo: skip guid and oGuids for now but use this info for later
                if (i === "guid" || i === "oGuids") continue;
                if (i === "attr") {
                    self.nodeDataByPath[path].attrChange = true;
                } else if (i === "reg") {
                    self.nodeDataByPath[path].regChange = true;
                } else {
                    self.nodeDataByPath[path].childChange = true;
                    node = client.getNode(path + "/" + i);
                    // todo: directly store this data at node
                    if (!self.nodeDataByPath[path + "/" + i]) {
                        self.nodeDataByPath[path + "/" + i] = {};
                    }
                    self._processDiffObjectRec(diff[i], path + "/" + i, node);
                }
                // get node from path
            }
        }
    };

    DisplayGraphDiff.prototype._modifiyNode = function (node) {
        var self = this,
            circleEl,
            nodeId = node[0].id;

        if (self.nodeDataByPath[nodeId]) {
            circleEl = node.parent().find('circle');
            if (self.nodeDataByPath[nodeId].childChange) {
                circleEl.attr('r', '7');
                circleEl.css('stroke', 'orange');
            }

            // todo: if added/deleted takes precedence over attr change; if (self.nodeDataByPath[node])

            if (self.nodeDataByPath[nodeId].attrChange || self.nodeDataByPath[nodeId].regChange) {
                circleEl.css('fill', 'gold');
            }

        }
    };

    return DisplayGraphDiff;
});