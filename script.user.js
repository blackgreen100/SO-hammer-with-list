// ==UserScript==
// @name           Stack Overflow Gold Tag Badge Hammer-with-list script
// @version        0.6.1
// @description    Placeholder
// @author         @blackgreen
// @include        /^https?://(?:[^/.]+\.)*(?:stackoverflow\.com)/(?:q(?:uestions)?\/\d+|review|tools|admin|users|search|\?|$)/
// @exclude        *://chat.stackoverflow.com/*
// @exclude        *://chat.stackexchange.com/*
// @exclude        *://chat.*.stackexchange.com/*
// @exclude        *://stackexchange.com/*
// @exclude        *://api.*.stackexchange.com/*
// @exclude        *://data.stackexchange.com/*
// @require        https://code.jquery.com/jquery-3.5.0.min.js
// @require        https://github.com/SO-Close-Vote-Reviewers/UserScripts/raw/master/gm4-polyfill.js
// @require        https://cdn.jsdelivr.net/gh/makyen/extension-and-userscript-utilities@94cbac04cb446d35dd025974a7575b25b9e134ca/executeInPage.js
// @grant          GM_setValue
// @grant          GM_getValue
// @grant          GM.setValue
// @grant          GM.getValue
// @connect        raw.githubusercontent.com
// @grant          GM_openInTab
// @grant          GM_xmlhttpRequest
// @grant          GM.openInTab
// @grant          GM.xmlHttpRequest
// @downloadURL    https://raw.githubusercontent.com/blackgreen100/SO-hammer-with-list/master/script.user.js
// @updateURL      https://raw.githubusercontent.com/blackgreen100/SO-hammer-with-list/master/script.user.js
// ==/UserScript==
/* jshint jquery:    true */
/* globals GM, StackExchange, $, makyenUtilities */ // eslint-disable-line no-unused-vars, no-redeclare

(function() {

    'use strict';
    const executeInPage = makyenUtilities.executeInPage;
    const isSuggestedEditReviewPage = /^\/review\/suggested-edits(?:\/|$)/i.test(window.location.pathname);

    const host = 'https://stackoverflow.com'

    // Duplicate management
    // Copied and adapted from https://stackapps.com/questions/8061/duplicate-target-manager/8062#8062

    function getStorageKey(){
        return document.location.hostname.replace(/\./, '_') + '_sowhl_lists';
    }

    async function loadOriginals(reload = false) {
        if (DUPELINKS.length > 0 && !reload){
            return DUPELINKS;
        }
        const key = getStorageKey();
        const originalsJson = await GM.getValue(key, '[]');
        DUPELINKS = JSON.parse(originalsJson);
        return DUPELINKS.sort((a, b) => a[0].localeCompare(b[0]))
    }

    async function storeOriginals() {
        const key = getStorageKey();
        const linksJson = JSON.stringify(DUPELINKS);
        return GM.setValue(key, linksJson);
    }

    // DUPELINKS model:
    // [
    //      ['name', [ { qid: 1234, title: "title" }, ...]],
    // ]
    let DUPELINKS = []

    function addSlinkClassToAllLinkChildren(el) {
        el.find('a').addClass('s-link');
    }

    //Add the CSS needed for the CV Request GUI.
    $(document.documentElement).append($('' +
        '<style id="sohwl-styles">' +
        '    .post-menu > span > a,' +
        '    .post-menu > span > a:hover,' +
        '    .subheader.tools-rev .sowhlui {' +
        '        top:12px;' +
        '        margin-left: 10px;' +
        '        position: relative;' +
        '    } ' +
        '    .sowhlui {' +
        '        display:inline-block;' +
        '    } ' +
        '    .sowhlui * {' +
        '        box-sizing: border-box;' +
        '    } ' +
        '    .so-hammer {' +
        '        display: none;' +
        '        margin:0;' +
        '        z-index:1002;' +
        '        position:absolute;' +
        '        white-space:nowrap;' +
        '        border-radius:3px;' +
        '        left:15vw;' +
        '        width:70vw;' +
        '        max-width:700px;' +
        '        background: var(--mp-main-bg-color);' +
        '        border: 3px solid var(--mp-main-bg-color);' +
        '        outline: 1px solid var(--mp-muted-color);' +
        '        box-shadow: 0px 5px 10px -5px var(--mp-muted-color);' +
        '    }' +
        '    .subheader.tools-rev .sowhlui .so-hammer {' +
        '        left: 0;' +
        '        top: 150%;' +
        '    }' +
        '    .so-hammer dd, .so-hammer dl {' +
        '        margin: 0;' +
        '        padding: 0;' +
        '    }' +
        '    .so-hammer dl dd {' +
        '        padding: 0px;' +
        '        margin: 0;' +
        '        width: 100%;' +
        '        display: table;' +
        '    }' +
        '    .so-hammer dl label, .so-hammer dl .sowhlCloseSection {' +
        '        display: table-cell;' +
        '    }' +
        '    .so-hammer dl button {' +
        '        margin: 2.5px 0;' +
        '    }' +
        '    .so-hammer dl label {' +
        '        width: 100%;' +
        '        padding: 0px;' +
        '    }' +
        '    .so-hammer dd > div {' +
        '        padding: 0px 15px;' +
        '        padding-bottom: 15px;' +
        '    }' +
        '    .so-hammer dd > div > .sowhlCloseSection {' +
        '        white-space: nowrap;' +
        '    }' +
        '    .so-hammer dd > div > .sowhlCloseSection > input {' +
        '        display: inline-block;' +
        '        vertical-align: middle;' +
        '    }' +
        '    .so-hammer dd > div > .sowhlCloseSection > input[type="text"] {' +
        '        width: 300px;' +
        '        margin-right: 5px;' +
        '    }' +
        '    .so-hammer hr {' +
        '        margin: 0 0 0 15px;' +
        '        border: 0px;' +
        '        border-bottom: 1px solid #ccc;' +
        '    }' +
        '    .so-hammer dd > a {' +
        '        display: block;' +
        '        padding: 10px 15px;' +
        '    }' +
        '    .so-hammer label {' +
        '        display: inline-block;' +
        '        padding: 10px 15px;' +
        '    }' +
        '    .so-hammer label:last-child {' +
        '        padding-left: 0;' +
        '    }' +
        '    .so-hammer label.sowhlChooseMnemonic {' +
        '        display: inline-block;' +
        '        padding: 5px 0px;' +
        '        white-space: nowrap;' +
        '    }' +
        '    .so-hammer div.sowhlOptionSubItem  {' +
        '        margin-left: 15px;' +
        '        padding: 5px 0px 5px 0px;' +
        '    }' +
        '    .so-hammer .sowhlOptionSubItem > label {' +
        '        white-space: normal;' +
        '        padding-left: 1.5em;' +
        '        text-indent: -1.5em;' +
        '    }' +
        '    .so-hammer .sowhlLinkButton {' +
        '        color: var(--theme-link-color);' +
        '        text-decoration: none;' +
        '        cursor: pointer;' +
        '        border: none;' +
        '        background: none;' +
        '    }' +
        '    .sowhlOptionsList  {' +
        '    }' +
        '    .sowhlReasonRow {' +
        '        display: flex;' +
        '        width: 100%;' +
        '    }' +
        '    .sowhlReasonRow input[type="text"] {' +
        '        flex: auto;' +
        '        margin-right: 2vw;' +
        '    }' +
        '    .sowhlReasonRow input[type="submit"] {' +
        '        flex: initial;' +
        '    }' +
        '    .so-hammer .sowhlChooseMnemonicContainer {' +
        '        display: block;' +
        '        white-space: normal;' +
        '    } ' +
        '</style>' +
        ''));

    //Send GUI Item
    function GuiPopup(_gui, _guiType) {
        this.gui = _gui;
        this.guiType = _gui.guiType;
        this.item = $('' +
            '<dd>' +
            '    <div class="sowhlItemMainDiv" style="display:none">' +
            '        <div class="sowhlCloseSection">' +
            '            <div class="sowhlChooseMnemonicContainer">' +
            '                <label class="sowhlChooseMnemonic">' +
            '                    Choose: ' +
            '                    <select name="sowhlTargetList">' +
            '                        <option value="choose" title="Choose duplicate target(s)">choose</option>' + //Used only as the default. Replaced in populateSelectOptions
            '                    </select>' +
            '                </label>' +
            '            </div>' +
            '            <button class="sowhlCloseBtn" disabled="true" style="width:180px">Close</button>' +
            '        </div>' +
            '        <button class="sowhlManageLinks sowhlLinkButton" style="margin-top:20px; padding-left:0">Manage</button>' +
            '        <div class="sowhlManageContainer">' +
            '            <div class="sowhlAddItemContainer">' +
            '                <label class="sowhlAddItem">' +
            '                    Add group: ' +
            '                    <input name="sowhlNewItem" placeholder="Name" />' +
            '                    <button class="sowhlAddItemBtn" disabled="true">Add</button>' +
            '                </label>' +
            '            </div>' +
            '           <div class="sowhlDupeListContainer" style="margin-top:10px">' +
            '               <ul class="sowhlDupeList"></ul>' +
            '           </div>' +
            '           <div class="sowhlBtnRow" style="margin-top:10px; display:inline">' +
            '               <button class="sowhlAddThis sowhlLinkButton" style="padding-left:0">Add this question to selected targets</button>' +
            '               <button class="sowhlDelGroup sowhlLinkButton" style="padding-left:0; color:darkred">Delete all</button>' +
            '           </div>' +
            '           <div class="sowhlErrMsg" style="margin-top:20px; color:red"></div>' +
            '        </div>' +
            '    </div>' +
            '    <hr>' +
            '</dd>' +
            '');
        let item = this.item;

        let closeButton = this.closeButton = $('.sowhlCloseBtn', item);
        // if duplicate, allow editing dupe list only
        // if it's otherwise not possible to cast a close vote, hide close button
        // if open, allow hammering
        if(this.gui.questionStatus.isDuplicate) {
            this.closeButton.html('Edit links')
            this.closeButton.on('click', () => {
                this.editDuplicateList()
            })
        } else if(this.gui.questionStatus.isClosed || this.gui.questionStatus.isLocked || this.gui.questionStatus.isDeleted) {
            this.closeButton.hide();
        } else {
            this.closeButton.on('click', () => {
                // hammer question
                this.voteToClose(() => { this.editDuplicateList() })
            })
        }

        let targetSelect = this.targetSelect = $('select[name="sowhlTargetList"]', item);
        targetSelect.val('choose');
        this.populateSelectOptions();

        // dependency for populateDuplicateList
        this.addThisQuestion = $('.sowhlAddThis', item)

        this.targetSelect.on('change', () => {
            if(!this.manageLinksVisible) {
                closeButton.removeAttr('disabled')
            }
            this.populateDuplicateList()
        });

        this.duplicateList = $('ul.sowhlDupeList', item)
        this.manageContainer = $('.sowhlManageContainer', item)

        this.manageLinks = $('.sowhlManageLinks', item)

        this.manageLinksVisible = false
        this.manageLinks.on('click', () => {
            if(this.manageLinksVisible) {
                this.manageContainer.hide()
                if(DUPELINKS[targetSelect.val()]) {
                    closeButton.removeAttr('disabled')
                }
            } else {
                this.manageContainer.show()
                closeButton.attr('disabled', 'disabled')
            }
            this.manageLinksVisible = !this.manageLinksVisible
        })

        let addItemButton = this.addItemButton = $('.sowhlAddItemBtn', item);
        let addItemInput = $('input[name="sowhlNewItem"]', item)

        this.addItemButton.on('click', () => {
            const v = addItemInput.val()
            DUPELINKS.push([v, []])
            storeOriginals()
            this.populateSelectOptions()
            addItemInput.val('')
        })

        addItemInput.on('input', function() {
            if(this.value && this.value.length > 0) {
                addItemButton.removeAttr('disabled')
            } else {
                addItemButton.attr('disabled', 'disabled')
            }
        })

        this.delGroup = $('.sowhlDelGroup', item)
        this.delGroup.on('click', () => {
            const idx = targetSelect.val();
            if(!idx || isNaN(idx)) {
                this.showError('Please select a target first')
                return
            }
            const doDel = confirm('Are you sure you want to delete the ' + DUPELINKS[idx][0] + ' group?')
            if(doDel) {
                DUPELINKS.splice(idx, 1)
                storeOriginals()
                this.clearDuplicateList()
                this.populateSelectOptions()
            }
        })

        this.errMsg = $('.sowhlErrMsg', item)

        _gui.targetSelect = this.targetSelect;
    }
    Object.assign(GuiPopup.prototype, {
        onopen: function() {},
        onclose: function() {
            this.targetSelect.val('choose')
            this.closeButton.attr('disabled', 'disabled')
            this.clearDuplicateList()
            this.manageContainer.hide()
            this.manageLinksVisible = false
            this.clearError()
        },
        voteToClose: function(_callback) {
            const fkey = StackExchange.options.user.fkey
            const idx = this.targetSelect.val();

            const _endpoint = host + '/flags/questions/' + this.gui.questionId + '/close/add'
            const _payload = '' +
                'closeReasonId=Duplicate' +
                '&' +
                'duplicateOfQuestionId=' + DUPELINKS[idx][1][0].qid +
                '&' +
                'siteSpecificOtherText=placeholder' +
                '&' +
                'originalSiteSpecificOtherText=placeholder' +
                '&' +
                'fkey=' + fkey

            GM.xmlHttpRequest({
                method: 'POST',
                url: _endpoint,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                data: _payload,
                onload: (_response) => {
                    if (_response.status !== 200) {
                        this.gui.hideMenu();
                        var responseText = _response.responseText;
                        var shownResponseText = responseText.length < 100 ? ' ' + responseText : '';
                        handleError('Failed calling close API.' + shownResponseText, _response);
                        return
                    }
                    if(_callback) {
                        _callback()
                    }
                    this.gui.hideMenu();
                },
                onerror: (error) => {
                    handleError('Got an error when calling close API.', error);
                },
            });
        },
        editDuplicateList: function() {
            const fkey = StackExchange.options.user.fkey
            const idx = this.targetSelect.val();
            const _targetIds = DUPELINKS[idx][1].map((v) => v.qid)

            const _endpoint = host + '/questions/originals/' + this.gui.questionId + '/save-originals'
            const _payload = '' +
                'originalsIdsJson=' + encodeURIComponent('[' + _targetIds.join(',') + ']') +
                '&' +
                'fkey=' + fkey

            GM.xmlHttpRequest({
                method: 'POST',
                url: _endpoint,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                data: _payload,
                onload: function(newMessageResponse) {
                    if (newMessageResponse.status !== 200) {
                        var responseText = newMessageResponse.responseText;
                        var shownResponseText = responseText.length < 100 ? ' ' + responseText : '';
                        handleError('Failed calling originals API.' + shownResponseText, newMessageResponse);
                        return
                    }
                    window.location.reload()
                },
                onerror: function(error) {
                    handleError('Got an error when calling originals API.', error);
                },
            });
        },
        populateSelectOptions: function() {
            loadOriginals().then((LINKS) => {
                const selectHTML = LINKS.reduce((acc, entry, i) => {
                    const [mnemonic, ] = entry
                    return acc + `<option value="${i}" title="${mnemonic}">${mnemonic}</option>`
                }, '')
                this.targetSelect.html(selectHTML)
                this.targetSelect.val('');
            })
        },
        populateDuplicateList: function() {
            const idx = this.targetSelect.val()
            if(isNaN(idx)) {
                return
            }
            this.clearDuplicateList()
            this.clearError()
            let currentQuestionInList = false
            DUPELINKS[idx][1].forEach((v) => {
                // check whether the current question is included in a dupe list
                // this flag is used to change the behavior of the "Add this question" button to remove it instead
                if(v.qid === this.gui.questionId) {
                    currentQuestionInList = true
                }
                this.duplicateList.append(`<li><a href="${host + '/questions/' + v.qid}" target="_blank" rel="noopener noreferrer">${v.title}</a></li>`)
            })
            if(!currentQuestionInList && !this.gui.questionStatus.isDeleted) {
                this.addThisQuestion.html('Add this question to selected targets')
                this.addThisQuestion.on('click', this.addQuestionToList.bind(this))
            } else {
                this.addThisQuestion.html('Remove this question from the selected targets')
                this.addThisQuestion.on('click', this.removeQuestionFromList.bind(this))
            }
        },
        clearDuplicateList: function() {
            this.duplicateList.empty()
        },
        showError: function(message) {
            this.errMsg.text(message)
        },
        clearError: function() {
            this.errMsg.text('')
        },
        addQuestionToList: function() {
            const idx = this.targetSelect.val();
            if(!idx || isNaN(idx)) {
                this.showError('Please select a target first')
                return
            }
            if(DUPELINKS[idx][1].length >= 5) {
                this.showError('Cannot have more than 5 originals')
                return
            }

            const qid = this.gui.questionId
            if(DUPELINKS[idx][1].some((v) => v.qid === qid)) {
                this.showError('This question is already included in this target')
                return
            }
            const title = $('#question-header h1 a').first().text();
            DUPELINKS[idx][1].push({ qid, title })
            storeOriginals()
            this.populateDuplicateList()
        },
        removeQuestionFromList: function() {
            const idx = this.targetSelect.val();
            if(!idx || isNaN(idx)) {
                this.showError('Please select a target first')
                return
            }

            const qid = this.gui.questionId
            const j = DUPELINKS[idx][1].findIndex((v) => v.qid === qid)
            if(j === -1) {
                this.showError('This question is not included in this target')
                return
            }
            DUPELINKS[idx][1].splice(j, 1)
            storeOriginals()
            this.populateDuplicateList()
        }
    });

    var guiCount = 0;
    function Gui(_id, _isPostMenuFlex, _status) {
        guiCount++;
        var gui = this; // eslint-disable-line consistent-this
        this.guiType = 'question'; // todo: probably not needed
        this.questionId = _id;
        this.questionStatus = _status;
        this.isPostMenuFlex = _isPostMenuFlex;
        //A <span> that contains the entire GUI.
        this.wrapper = $(`<${_isPostMenuFlex ? 'div' : 'span'} class="sowhlui${_isPostMenuFlex ? ' flex--item' : ''} hammer" data-gui-type="question" data-gui-id="${_id}"/>`);
        //The link used as the cv-pls/del-pls/etc. button on each post
        this.button = $('<a href="javascript:void(0)" class="cv-button"></a>');
        this.button.text('Hammer');
        this.button.attr('title', 'Hammer question');

        this.wrapper.append(this.button);
        //The <dl> which contains each list item in the GUI
        this.list = $('<dl class="so-hammer" data-guicount="' + guiCount + '"/>');
        this.wrapper.append(this.list);
        //Items in the cv-pls dialog
        this.items = {
            send: new GuiPopup(this, this.guiType),
        };
        //Add all the items, in the desired order, and event listeners for each.
        ['send'].forEach(function(itemKey) {
            gui.list.append(gui.items[itemKey].item);
            $('a', gui.items[itemKey].item).first().on('click', gui.toggleItem.bind(gui, itemKey));
        });
        //Hide the closing <hr> for the last item.
        this.list.find('hr').last().hide();
        this.defaultItemKey = 'send';
        this.defaultItem = this.items[this.defaultItemKey];
        //Toggle the display of the cv-pls dialog.
        this.button.on('click', function() {
            //Close all 1st level menus
            $('div.sowhlItemMainDiv', gui.list).hide();
            //Call the appropriate GUI open/close function for each item.
            var onWhat = gui.list.is(':visible') ? 'onguiclose' : 'onguiopen';
            Object.keys(gui.items).forEach(function(item) {
                var toCall = gui.items[item][onWhat];
                if (typeof toCall === 'function') {
                    toCall.call(gui.items[item]);
                }
            });
            gui.list.toggle();
            gui.openDefaultItem();
        });
        this.documentClickListener = function(e) {
            //Hide the CV popup if visible & the click is not in the
            //  popup (preventing right-clicks from closing the popup when they are inside the popup).
            if (gui.list.is(':visible') && !gui.wrapper[0].contains(e.target)) {
                gui.hideMenu();
            }
        };
        $(document).on('click', this.documentClickListener);
        if (_isPostMenuFlex) {
            //This is going to be in a post-menu .d-flex
            addSlinkClassToAllLinkChildren(this.list);
        }
    }
    Object.assign(Gui.prototype, {
        closeAllItems: function() {
            //Close all items in the GUI
            Object.keys(this.items).forEach(function(item) {
                this.closeItem(item);
            }, this);
        },
        closeTarget: function() {
            //Close the room selection
            this.closeItem('room');
        },
        closeItem: function(itemKey) {
            //Close a single item in the GUI
            var item = this.items[itemKey];
            var $item = item.item;
            $('div.sowhlItemMainDiv', $item).hide();
            if (item.onclose) {
                item.onclose(item);
            }
        },
        openItem: function(itemKey) {
            //Open an item in the GUI
            this.closeAllItems();
            var item = this.items[itemKey];
            var $item = item.item;
            $('div.sowhlItemMainDiv', $item).show();
            $('input[type="text"]', $item).focus();
            if (item.onopen) {
                item.onopen(item);
            }
        },
        toggleItem: function(item, e) {
            //Toggle an item in the GUI
            //May be called as a bound event handler, with the correct this
            if (e) {
                e.stopPropagation();
                e.target.blur();
            }
            var $divs = $('div.sowhlItemMainDiv', this.items[item].item);
            if ($divs.is(':hidden')) {
                this.openItem(item);
            } else {
                this.closeAllItems();
            }
        },
        hideMenu: function() {
            //Hide the GUI
            this.closeAllItems();
            this.list.hide();
        },
        showMenu: function() {
            //Show the GUI
            this.closeAllItems();
            this.list.show();
        },
        isDefaultHidden: function() {
            //Is the default item currently open?
            return $('.sowhlItemMainDiv', this.defaultItem.item).is(':hidden');
        },
        openDefaultItem: function() {
            //Open the default item
            this.openItem(this.defaultItemKey);
        },
        destroy: function() {
            //Remove any references made by the GUI which exist outside of it to data within the GUI.
            //The intent is to permit the GUI to be garbage collected.
            //Let each item clean up, if needed (none currently).
            this.hideMenu();
            Object.keys(this.items).forEach(function(itemKey) {
                var item = this.items[itemKey];
                if (typeof item.ondestroy === 'function') {
                    item.ondestroy(item);
                }
            }, this);
            $(document).off('click', this.documentClickListener);
            this.wrapper.remove();
        },
    });

    let addedToDom = 0
    //Adding the hammer link to the question
    function addHammerToDom() {
        if(addedToDom > 0) {
            return
        }
        //Add a cv-pls GUIs to any post of the specified type when one does not already exist on the .post-menu .post-menu-container
        //Putting the GUI in when the .post-menu is .preview-options messes up the page-UI interaction for
        //  editing. This should be further investigated, but just not putting it there is sufficient.
        const nonGridJSPostMenus = $('.js-post-menu:not(.post-menu)').filter(function() {
            //SE currently uses different HTML on review pages, where a .js-post-menu has buttons as its children.
            //  However, those are all display:none, but that doesn't prevent us from adding a request button.
            const $this = $(this);
            return $this.children('button').length && !$this.children('.grid').length;
        });
        $(`.question .post-menu:not(.preview-options) .post-menu-container, .question .post-menu:not(.preview-options), .question .js-post-menu:not(.preview-options) > .d-flex`).add(nonGridJSPostMenus).filter(function() {
            const $this = $(this);
            if ($this.is('.post-menu')) {
                if ($this.children('.post-menu-container').length || $this.find('.post-menu-container').length) {
                    //This .post-menu has a .post-menu-container, so we don't want to use it.
                    return false;
                }
            }
            return true;
        }).each(function() {
            const $this = $(this);
            if (!$this.closest('.question,.answer').is('.question')) {
                //The closest .question/.answer for this .post-menu .post-menu-container is not the type we're looking for.
                return;
            }
            const qc = getQuestionContext($this);
            const qstatus = {
                isClosed: isQuestionClosed(qc),
                isDuplicate: isQuestionDuplicate(qc),
                isDeleted: isQuestionDeleted(qc),
                isLocked: isPostLocked(qc),
            }

            if (!$('.sowhlui.hammer', this).length) {
                //No sowhlui on this post yet
                const newGui = new Gui(
                    $this.closest('.question').attr(`data-questionid`),
                    $this.is('.js-post-menu > .d-flex'),
                    qstatus
                );
                if ($this.is('.post-menu')) {
                    $this.append('<span class="lsep">|</span>'); //separator between each .post-menu .post-menu-container item
                }
                $this.append(newGui.wrapper);
                addedToDom++
            }
        });
    }

    addHammerToDom();



    // Post info
    function isQuestionClosed(questionContext) {
        //True if the question is closed.
        const pre201910CloseBannerExists = $('.special-status .question-status H2 B', questionContext).filter(function() {
            return /hold|closed|marked/i.test($(this).text());
        }).length > 0;
        const postNotices = $('.js-post-notice', questionContext);
        const postNoticeIsDuplicateClosure = postNotices.filter(function() {
            return /already has (?:an answer|answers)|close\/reopen/i.test($(this).text());
        }).length > 0;
        const postNoticeBoldStartsWithClosed = anyElementTextStartsWithClosed($('b', postNotices));
        const postNoticesRelativetimeContainers = $('.relativetime', postNotices).parent();
        const postNoticesRelativetimeContainerStartsWithClosed = anyElementTextStartsWithClosed(postNoticesRelativetimeContainers);
        const post201910CloseBannerExists = postNoticeIsDuplicateClosure || postNoticeBoldStartsWithClosed || postNoticesRelativetimeContainerStartsWithClosed;
        const closeButton = $('.js-close-question-link', questionContext);
        const closeButtonIsClose = closeButton.attr('data-isclosed') || closeButton.text().toLowerCase().indexOf('reopen') > -1;
        return pre201910CloseBannerExists || post201910CloseBannerExists || closeButtonIsClose;
    }

    function isQuestionDuplicate(questionContext) {
        return $('#question-header a.question-hyperlink').text().endsWith('[duplicate]')
    }

    function anyElementTextStartsWithClosed($obj) {
        return $obj.filter(function() {
            return /^Closed/.test($(this).text().trim());
        }).length > 0;
    }

    function isQuestionDeleted(questionContext) {
        //True if the question is deleted.
        return $('.question', questionContext).first().is('.deleted-answer');
    }

    function isPostLocked(post) {
        let isLocked = false;
        $(post).find('.iconLightbulb, .iconLock').closest('.d-flex').each(function() {
            const firstBoldText = $(this).find('b').first().text();
            isLocked = isLocked || /community wiki|locked/i.test(firstBoldText);
        });
        return isLocked;
    }

    function isPostCommentLocked(post) {
        let isCommentLocked = false;
        $(post).find('.iconLightbulb, .iconLock').closest('.d-flex').each(function() {
            const $this = $(this);
            const firstBoldText = $this.find('b').first().text();
            const isLocked = /community wiki|locked/i.test(firstBoldText);
            if (isLocked) {
                isCommentLocked = /Comments .{0,30}\bhave been disabled/.test($this.text());
            }
        });
        return isCommentLocked;
    }

    function getQuestionContext(element) {
        const $el = (element instanceof jQuery) ? element : $(element);
        if (isSuggestedEditReviewPage && element.closest('.s-page-title').length) {
            return $('.js-review-task');
        }
        const context = $el.closest('#mainbar, .review-content, .mainbar, #mainbar-full, .show-original, body.tools-page #mainbar > table.default-view-post-table > tbody > tr > td, .js-review-task, .makyen-flag-post-preview-container');
        if (!context.length) {
            //A containing element which we recognize as the context for the element's question wasn't found.
            return $(document);
        }
        const q = context.find('.question')
        if (q.length) {
            return q.first();
        }
        //There was no .question in what was found, try higher up the DOM.
        return getQuestionContext(context.parent());
    }

    function handleError(message, error) {
        var seeConsole = ' (See the console for more details.)';
        console.error(message, error);
        alert(message + seeConsole);
    }

    // Watch StackExchange functions
    function isSEFunctionValid(seFunctionText) {
        //Test to see if a StackExchange method is currently valid.
        return isPageFunctionValid('StackExchange.' + seFunctionText);
    }

    function isPageFunctionValid(methodName) {
        //Given potentially nested property names, determine if the named
        //  function exists in the page and is a function.
        //NOTE: unsafeWindow properties are *only* used without invoking getters
        //If we are already in an environment where we are in the page context (e.g. Tampermonkey w/ @grant none), use window instead of unsafeWindow.
        var win = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
        //Determine if StackExchange.question.init is a function without invoking any getters in this context.
        return typeof methodName.split('.').reduce(function(sum, prop) {
            var type = typeof sum;
            if (type === 'object' || type === 'function') {
                var descriptor = Object.getOwnPropertyDescriptor(sum, prop);
                return descriptor ? descriptor.value : false;
            } //else
            return false;
        }, win) === 'function';
    }

    function watchEvents(eventTypeBase, listeners) {
        //Add listeners for the indicated events. Each event has a base name with
        //  a postfix added based on the key used to store the function reference in the
        //  listeners Object. This will normally be 'before' and 'after', but could be
        //  anything.
        if (typeof listeners !== 'object') {
            return;
        }
        Object.keys(listeners).forEach(function(prop) {
            var listener = listeners[prop];
            if (typeof listener === 'function') {
                var eventType = eventTypeBase + '-' + prop;
                window.addEventListener(eventType, listener, true);
            }
        });
    }

    function watchSEFunction(seFunction, eventPrefix, listeners) {
        //Watch for in-page execution of a StackExchange method. This is done by wrapping the function.
        //  The wrapper then sends custom events before and after execution of the function.
        if (!isSEFunctionValid(seFunction)) {
            //The function is not valid
            return;
        }

        function inPageWatchSEFunction(seMethodText, eventTypeBase) {
            if (typeof unsafeWindow !== 'undefined') {
                //Prevent this running when not in the page context.
                return;
            }
            var split = seMethodText.split('.');
            var methodName = split.pop();
            var obj = split.reduce(function(sum, prop) {
                var type = typeof sum;
                if (type === 'object' || type === 'function') {
                    return sum[prop];
                }// else
                return void 0;
            }, StackExchange);
            var origSEFuction = obj[methodName];
            if (typeof origSEFuction !== 'function') {
                //If it's not a function, then we can't deal with it here.
                return;
            }
            obj[methodName] = function() {
                window.dispatchEvent(new Event(eventTypeBase + '-before', {
                    bubbles: true,
                    cancelable: true,
                }));
                var toReturn = origSEFuction.apply(this, arguments);
                //This fires when the function returns. If it returns a Promise, we don't do anything about that.
                window.dispatchEvent(new Event(eventTypeBase + '-after', {
                    bubbles: true,
                    cancelable: true,
                }));
                return toReturn;
            };
        }
        var eventTypeBase = eventPrefix + seFunction;
        executeInPage(inPageWatchSEFunction, true, 'sowhl-watchSEFunction-' + seFunction, seFunction, eventTypeBase);
        watchEvents(eventTypeBase, listeners);
    }

    var seFunctionsToWatch = [
        //A list of StackExchange functions to monitor. This is used to detect when the page has been
        //  updated with new information. It is less resource intensive than using a MutationObserver
        //  to listen to all DOM change events.
        //Times to check to see if the cv-pls is in the page. This will be due to DOM changes,
        // which could be because a different question is being shown, or we're back from an edit.
        /* beautify preserve:start */
        /* eslint-disable no-multi-spaces */
        {seFunction: 'question.init',                           listeners: {after: addHammerToDom}},
        {seFunction: 'question.initFull',                       listeners: {after: addHammerToDom}},
        {seFunction: 'beginEditEvent.cancel',                   listeners: {after: addHammerToDom}}, //Happens on edit cancel (then SE.using returns)
        {seFunction: 'using',                                   listeners: {after: addHammerToDom}},
        {seFunction: 'helpers.removeSpinner',                   listeners: {after: addHammerToDom}},
        {seFunction: 'question.getQuestionId',                  listeners: {after: addHammerToDom}},
        {seFunction: 'question.bindSuggestedEditPopupLinks',    listeners: {after: addHammerToDom}}, //Happens when getting a new question/answer version due to someone else editing (at least on answers)
        //Detect Close-Vote popup opening
        // {seFunction: 'helpers.bindMovablePopups',               listeners: {after: detectCloseVoteDialogOpen}},
        /* beautify preserve:end */
        /* eslint-enable no-multi-spaces */
    ];

    var postSEReadyTimeout = 0;

    function listenerForSEReady(e, extraTime) {
        //Watch the SE.ready function. That function is called, sometimes, when SE makes major changes within the page.
        //  The callback for it is called when the StackExchange Object has been updated with additional functionality. Many of the
        //  functions which we desire to watch don't exist until the callback function is called. Thus, if the watcher has not
        //  already been placed, we check for the existence of the function which we desire to watch and add the watcher
        //  if the SE function exists.
        addHammerToDom();
        var didPlace = false;
        var allPlaced = true;
        seFunctionsToWatch.forEach(function(watcher) {
            if (!watcher.placed) {
                allPlaced = false;
                if (isSEFunctionValid(watcher.seFunction)) {
                    watcher.placed = true;
                    didPlace = true;
                    watchSEFunction(watcher.seFunction, 'sowhl-SE-', watcher.listeners);
                }
            }
        });
        //In some instances, SE functions are added sometime after the SE.ready method is called (not when it calls it's callback).
        //  We thus delay 1s after it's called and try again for any functions we still need.
        //  This is repeated up to 10 times, if additional functions were placed.
        //  If the initial check indicates all functions were placed, then it's not called again
        //  after 1s.
        //Only have one timeout at a time.
        clearTimeout(postSEReadyTimeout);
        extraTime = typeof extraTime === 'number' ? extraTime : 0;
        if (!allPlaced && extraTime < 10000 && (!extraTime || didPlace)) {
            //Only keep looking if we have not looked once after a 1s delay, or we found something to place.
            extraTime += 1000;
            //Wait 1s and then try again.
            postSEReadyTimeout = setTimeout(listenerForSEReady, 1000, null, extraTime);
        }
    }
    watchSEFunction('ready', 'sowhl-SE-', {
        after: listenerForSEReady,
    });

    //Perform a check for the SE functions we're watching when the callback for SE.ifUsing is executed.
    //  Use SE.ifUsing in order not to change what's actually loaded on the page we're in.
    function inPageWatchSEUsing() {
        StackExchange.ready(function() {
            window.dispatchEvent(new CustomEvent('sowhl-SEActuallyReady', {
                bubbles: true,
                cancelable: true,
            }));
        });
        var types = [
            'adops',
            'anonymous',
            'autocomplete',
            'beginEditEvent',
            'editor',
            'eventCharts',
            'exploreQuestions',
            'externalEditor',
            'gps',
            'help',
            'inlineEditing',
            'inlineTagEditing',
            'keyboardShortcuts',
            'loggedIn',
            'mathjaxEditing',
            'mathjaxEditingBeta',
            'mobile',
            'mockups',
            'postValidation',
            'prettify',
            'pseudoModerator',
            'review',
            'revisions',
            'schematics',
            'snippets',
            'snippetsJsCodeMirror',
            'tagAutocomplete',
            'tagEditor',
            'tagSuggestions',
            'translation',
            'virtualKeyboard',
        ];
        types.forEach(function(type) {
            StackExchange.ifUsing(type, function() {
                window.dispatchEvent(new CustomEvent('sowhl-useSEifUsing', {
                    bubbles: true,
                    cancelable: true,
                    detail: type,
                }));
            });
        });
    }
    window.addEventListener('sowhl-useSEifUsing', listenerForSEReady, true);
    executeInPage(inPageWatchSEUsing, true, 'sowhl-useSEifUsing');

    //Watch for SE.ready. Various functions which we're interested in are available when SE.ready fires.
    function inPageGetSEReady() {
        StackExchange.ready(function() {
            window.dispatchEvent(new CustomEvent('sowhl-SEActuallyReady', {
                bubbles: true,
                cancelable: true,
            }));
        });
    }
    window.addEventListener('sowhl-SEActuallyReady', listenerForSEReady, true);
    executeInPage(inPageGetSEReady, true, 'sowhl-getSEReady');
})();
