/**
 * @author zhangpn / https://github.com/zhangpn
 */

define(['js/Controls/PropertyGrid/PropertyGridWidgetManager',
    'js/util',
    'text!./templates/GraphDiffConfigDialog.html',
    'css!./styles/GraphDiffConfigDialog.css'
], function (PropertyGridWidgetManager, util, GraphDiffConfigDialogTemplate) {

    'use strict';

    var GraphDiffConfigDialog,
        ENTRY_BASE = $('<div class="form-group"><div class="row"><label class="col-sm-4 control-label">NAME</label><div class="col-sm-8 controls"></div></div><div class="row description"><div class="col-sm-4"></div></div></div>'),
        DESCRIPTION_BASE = $('<div class="desc muted col-sm-8"></div>'),
        ATTRIBUTE_DATA_KEY = 'attribute';

    GraphDiffConfigDialog = function () {
        this._propertyGridWidgetManager = new PropertyGridWidgetManager();
    };

    GraphDiffConfigDialog.prototype.show = function (branches, previousConfigs, saveCallBack) {
        var self = this;

        this._initDialog(branches, previousConfigs, saveCallBack);

        this._dialog.modal('show');

        this._dialog.on('hidden.bs.modal', function () {
            self._dialog.remove();
            self._dialog.empty();
            self._dialog = undefined;
        });
    };

    GraphDiffConfigDialog.prototype._initDialog = function (branches, previousConfigs, saveCallBack) {
        var self = this,
            closeSave;

        closeSave = function () {
            self._dialog.modal('hide');

            var branchesSelected = self._configureWidget();

            if (saveCallBack) {
                saveCallBack(branchesSelected);
            }
        };

        this._dialog = $(GraphDiffConfigDialogTemplate);
        this._widgets = {};

        //get controls
        this._el = this._dialog.find('.modal-body').first();


        var configs = this._getConfigs(branches, previousConfigs);

        this._generateConfigsSection(configs, this._el);


        this._btnSave = this._dialog.find('.btn-save').first();


        //click on SAVE button
        this._btnSave.on('click', function (event) {
            closeSave();

            event.stopPropagation();
            event.preventDefault();
        });
    };

    GraphDiffConfigDialog.prototype._getConfigs = function (branches, previousConfigs) {
        return [
            {
                name: 'branch1Name',
                displayName: 'First branch name',
                description: 'Select the first branch to compare',
                value: previousConfigs ? previousConfigs[0] : (branches.indexOf('master') > -1 ? 'master' : branches[0]),
                valueType: 'string',
                valueItems: branches,
                readOnly: false
            },
            {
                name: 'branch2Name',
                displayName: 'Second branch name',
                description: 'Select the second branch to compare',
                value: previousConfigs ? previousConfigs[1] : (branches[1] || branches[0]),
                valueType: 'string',
                valueItems: branches,
                readOnly: false
            }];
    };

    GraphDiffConfigDialog.prototype._generateConfigsSection = function (configs, containerEl) {
        var i,
            el,
            configEntry,
            widget,
            descEl;

        for (i = 0; i < configs.length; i += 1) {
            configEntry = configs[i];
            descEl = null;

            widget = this._propertyGridWidgetManager.getWidgetForProperty(configEntry);
            this._widgets[configEntry.name] = widget;

            el = ENTRY_BASE.clone();
            el.data(ATTRIBUTE_DATA_KEY, configEntry.name);

            el.find('label.control-label').text(configEntry.displayName);

            if (configEntry.description && configEntry.description !== '') {
                descEl = descEl || DESCRIPTION_BASE.clone();
                descEl.text(configEntry.description);
            }

            el.find('.controls').append(widget.el);
            if (descEl) {
                el.find('.description').append(descEl);
            }


            containerEl.append(el);
        }
    };


    GraphDiffConfigDialog.prototype._configureWidget = function () {
        var branch1,
            branch2,
            currentBranch = WebGMEGlobal.Client.getActiveBranchName();

        if (this._widgets.hasOwnProperty('branch1Name')) {
            branch1 = this._widgets['branch1Name'].getValue();
        }
        if (this._widgets.hasOwnProperty('branch2Name')) {
            branch2 = this._widgets['branch2Name'].getValue();
        }

        if (currentBranch !== branch1 && branch1 !== branch2) {
            WebGMEGlobal.Client.selectBranch(branch1, null, function (err) {
                if (err) {
                    self.logger.error(err);
                }
            });
        }

        return [branch1, branch2];

    };


    return GraphDiffConfigDialog;
});