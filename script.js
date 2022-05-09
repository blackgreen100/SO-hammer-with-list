// ==UserScript==
// @name           Stack Overflow Gold Tag Badge Hammer-with-list script
// @version        0.0.1
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
// @connect        raw.githubusercontent.com
// @grant          GM_openInTab
// @grant          GM_xmlhttpRequest
// @grant          GM.openInTab
// @grant          GM.xmlHttpRequest
// ==/UserScript==
/* jshint jquery:    true */
/* globals GM, StackExchange, $, makyenUtilities */ // eslint-disable-line no-unused-vars, no-redeclare

(function() {

    'use strict';
    const executeInPage = makyenUtilities.executeInPage;
    const isSuggestedEditReviewPage = /^\/review\/suggested-edits(?:\/|$)/i.test(window.location.pathname);

    const host = 'https://stackoverflow.com'

    // array of tuples
    // id, mnemonic, dupe targets
    const dupeLinks = [
        ['JSON Dynamic', [
            '28033277', // https://stackoverflow.com/questions/28033277/decoding-generic-json-objects-to-one-of-many-formats
            '30341588', // https://stackoverflow.com/questions/30341588/how-to-parse-a-complicated-json-with-go-unmarshal
            '45896930', // https://stackoverflow.com/questions/45896930/golang-unmarshalling-arbitrary-data
            '46536234', // https://stackoverflow.com/questions/46536234/how-to-parse-json-in-golang-without-unmarshaling-twice
            '29111777', // https://stackoverflow.com/questions/29111777/is-it-possible-to-partially-decode-and-update-json-go
        ]],
        ['JSON Exported', [
            '11126793', // https://stackoverflow.com/questions/11126793/json-and-dealing-with-unexported-fields
            '38093012', // https://stackoverflow.com/questions/38093012/printing-empty-json-as-a-result
            '25595096', // https://stackoverflow.com/questions/25595096/unmarshalling-json-golang-not-working
            '26327391', // https://stackoverflow.com/questions/26327391/json-marshalstruct-returns
            '28467302', // https://stackoverflow.com/questions/28467302/parsing-json-in-golang-doesnt-populate-object
        ]]
    ]

    function addSlinkClassToAllLinkChildren(el) {
        el.find('a').addClass('s-link');
    }

    var CVRGUI;
    CVRGUI = {
        /* jshint +W003 */
        questions: [],
        answers: [],
        reviews: [],
        //A reference to the currently visible GUI.
        //  Used to tell the currently visible GUI about any value changes that occur outside of the GUI
        //  (e.g. from option changes in other tabs).
        visibleGui: null,
        callInAllGuis: function(method, args) {
            //Call a method on each GUI
            this.callInAllQuestions(method, args);
            this.callInAllAnswers(method, args);
            this.callInAllReviews(method, args);
        },
        callInAllQuestions: function(method, args) {
            //Call a method on each GUI that is placed on a question
            this.questions.forEach(function(question) {
                question[method].apply(question, args);
            });
        },
        callInAllAnswers: function(method, args) {
            //Call a method on each GUI that is placed on an answer
            this.answers.forEach(function(answer) {
                answer[method].apply(answer, args);
            });
        },
        callInAllReviews: function(method, args) {
            //Call a method on each GUI that is placed on an review
            this.reviews.forEach(function(review) {
                review[method].apply(review, args);
            });
        },
        callInVisibleGui: function(method, args) {
            //Call a method in the currently visible GUI. Used to update changes in what's displayed in the GUI
            //  which result from actions external to the GUI. For instance, changes in the shortcut key, or
            //  options that are made in a different tab while the GUI is visible in this tab.
            if (this.visibleGui) {
                this.visibleGui[method].apply(this.visibleGui, args);
            }
        },
        //Call various functions in all GUIs.
        closeTarget: function() {
            this.callInAllGuis('closeTarget');
        },
        closeAllItems: function() {
            this.callInAllGuis('closeAllItems');
        },
        hideMenus: function() {
            this.callInAllGuis('hideMenu');
        },
        shortcutKeyWasSet: function() {
            this.callInVisibleGui('shortcutKeyWasSet', arguments);
        },
        configOptionsChanged: function() {
            this.callInVisibleGui('configOptionsChanged', arguments);
        },
        cleanGuiList: function(which, selector) {
            //Remove any GUIs which don't have an associated question/answer currently in the DOM
            this[which] = this[which].filter(function(gui) {
                if (!gui.wrapper.closest(selector).length) {
                    //It's not contained in an element matching the selector.
                    gui.destroy();
                    return false;
                } //else
                return true;
            });
        },
        cleanAnswers: function() {
            //Destroy/remove any answer GUIs which are not contained in a 'body .answer'.
            this.cleanGuiList('answers', 'body .answer');
        },
        cleanQuestions: function() {
            //Destroy/remove any question GUIs which are not contained in a 'body .answer'.
            this.cleanGuiList('questions', 'body .question');
        },
        cleanReviews: function() {
            //Destroy/remove any review GUIs which are not contained in a 'body'.
            this.cleanGuiList('reviews', 'body');
        },
        getGuiForId: function(postType, id) {
            //Get the GUI associated with a post ID of post type.
            //This searches the answerId/questionId property added to the GUI when it is inserted
            //  into a question/answer.
            var found;
            var idProp = postType + 'Id';
            this[postType + 's'].some(function(post) {
                if (post[idProp] == id) { // eslint-disable-line eqeqeq
                    found = post;
                    return true;
                }
                return false;
            });
            return found;
        },
        getGuiForEl: function(element) {
            //Get the GUI associated with the post which contains the element.
            var $el = (element instanceof jQuery) ? element : $(element);
            var post = $el.closest('.question,.answer');
            if (!post.length) {
                post = getQuestionContext(element);
                if (!post.length) {
                    return null;
                }
            }
            var postType = post.is('.question') ? 'question' : 'answer';
            return this.getGuiForId(postType, post.attr(`data-${postType}id`));
        },
    };

    //Send GUI Item
    function GuiItemSend(_gui, _guiType) {
        this.gui = _gui;
        this.guiType = _gui.guiType;
        this.item = $('' +
            '<dd>' +
            '    <div class="cvrgItemMainDiv" style="display:none">' +
            '        <form>' +
            '            <div class="cvrgRequestTypeAndCheckboxContainer">' +
            '                <label class="cvrgRequestType">' +
            '                    Request Type: ' +
            '                    <select name="requestType">' +
            '                        <option value="cv-pls" title="Close vote request">cv-pls</option>' + //Used only as the default. Replaced in populateSelectOptions
            '                    </select>' +
            '                </label>' +
            '            </div>' +
            '        </form>' +
            '    </div>' +
            '</dd>' +
            '');
        var item = this.item;
        var requestTypeInput = this.requestTypeInput = $('select[name="requestType"]', item);
        requestTypeInput.val('placeholder');
        this.populateSelectOptions();
        var thisGuiItem = this; // eslint-disable-line consistent-this
        this.requestTypeInput.on('change', function() {
            thisGuiItem.hammerQuestion();
        });
        _gui.requestTypeInput = this.requestTypeInput;
    }
    Object.assign(GuiItemSend.prototype, {
        onopen: function() {
            this.populateSelectOptions();
            this.post = null;
            this.postUser = null;
            this.currentUserInQuestion = null;
            this.questionTitleText = null;
            this.postLinkHref = null;
            this.titleMarkdown = null;
            this.userLink = null;
            this.userMarkdown = null;
            this.postTime = null;
            this.closedTimeMs = null;
            this.isQuestionLocked = null;
            this.isQuestionCommentLocked = null;
            this.postIsLocked = null;
            this.postIsCommentLocked = null;
            this.isQuestionBounty = null;
            this.questionRoombaInfo = null;
            this.questionRoombaDays = null;
            this.questionActiveTime = null;
            this.tag = null;
        },
        onclose: function() {},
        hammerQuestion: function() {
            var idx = this.requestTypeInput.val();
            const targets = dupeLinks[idx][1]
            const fkey = StackExchange.options.user.fkey

            const closeEndpoint = host + '/flags/questions/' + this.gui.questionId + '/close/add'
            const originalsEndpoint = host + '/questions/originals/' + this.gui.questionId + '/save-originals'

            const closePayload = '' +
                'closeReasonId=Duplicate' +
                '&' +
                'duplicateOfQuestionId=' + targets[0] +
                '&' +
                'siteSpecificOtherText=placeholder' +
                '&' +
                'originalSiteSpecificOtherText=placeholder' +
                '&' +
                'fkey=' + fkey

            const originalsPayload = '' +
                'originalsIdsJson=' + encodeURIComponent('[' + targets.join(',') + ']') +
                '&' +
                'fkey=' + fkey

            this.voteToClose(closeEndpoint, closePayload, () => {
                this.editDuplicateList(originalsEndpoint, originalsPayload)
            })

        },
        voteToClose: function(_endpoint, _payload, _callback) {
            GM.xmlHttpRequest({
                method: 'POST',
                url: _endpoint,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                data: _payload,
                onload: (newMessageResponse) => {
                    if (newMessageResponse.status !== 200) {
                        CVRGUI.hideMenus();
                        var responseText = newMessageResponse.responseText;
                        var shownResponseText = responseText.length < 100 ? ' ' + responseText : '';
                        handleError('Failed calling close API.' + shownResponseText, newMessageResponse);
                        return
                    }
                    CVRGUI.hideMenus();
                    _callback()
                },
                onerror: (error) => {
                    handleError('Got an error when calling close API.', error);
                },
            });
        },
        editDuplicateList: function(_endpoint, _payload) {
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
            var requestType = this.requestTypeInput.val();

            const selectHTML = dupeLinks.reduce((acc, entry, i) => {
                const [mnemonic, ] = entry
                return acc + `<option value="${i}" title="${mnemonic}">${mnemonic}</option>`
            }, '')

            this.item.find('select[name="requestType"]').first().html(selectHTML)
            //Restore the request type, which would have been cleared by reconstructing the <option> elements.
            this.requestTypeInput.val(requestType);
        },
        getBaseRequestType: function() {
            // This is used to make it such that we don't actually store separate requests
            // for types which differ from other types only in that they are delayed.
            // e.g. a 'del-pls' uses the same storage key as a 'del-pls (in n days)'.
            // Testing:
            var toReturn;
            try {
                toReturn = this.requestTypeInput.val();
                toReturn = toReturn ? toReturn : 'cv-pls';
                toReturn = toReturn.replace(delayableRequestRegex, '');
            } catch (e) {
                toReturn = 'cv-pls';
                console.trace();
                console.error('Got invalid data for requestTypeInput.val()');
                console.error(e);
            }
            toReturn = toReturn.replace(delayableRequestRegex, '');
            return toReturn;
            //*/ end testing. Uncomment next line when removing testing code.
            //return this.requestTypeInput.val().replace(delayableRequestRegex, '');
        },
    });

    var guiCount = 0;
    function Gui(_id, _reportVisible, _isPostMenuFlex) {
        //Construct a CVR GUI
        guiCount++;
        var gui = this; // eslint-disable-line consistent-this
        this.guiType = 'question'; // todo: probably not needed
        this.questionId = _id;
        this.reportVisible = _reportVisible;
        this.isPostMenuFlex = _isPostMenuFlex;
        //A <span> that contains the entire GUI.
        this.wrapper = $(`<${_isPostMenuFlex ? 'div' : 'span'} class="cvrgui${_isPostMenuFlex ? ' flex--item' : ''} hammer" data-gui-type="question" data-gui-id="${_id}"/>`);
        //The link used as the cv-pls/del-pls/etc. button on each post
        this.button = $('<a href="javascript:void(0)" class="cv-button"></a>');
        this.button.text('Hammer');
        this.button.attr('title', 'Hammer question');

        this.wrapper.append(this.button);
        //The <dl> which contains each list item in the GUI
        this.list = $('<dl class="cv-list" data-guicount="' + guiCount + '"/>');
        this.wrapper.append(this.list);
        //Items in the cv-pls dialog
        this.items = {
            send: new GuiItemSend(this, this.guiType),
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
            $('div.cvrgItemMainDiv', gui.list).hide();
            //Call the appropriate GUI open/close function for each item.
            var onWhat = gui.list.is(':visible') ? 'onguiclose' : 'onguiopen';
            Object.keys(gui.items).forEach(function(item) {
                var toCall = gui.items[item][onWhat];
                if (typeof toCall === 'function') {
                    toCall.call(gui.items[item]);
                }
            });
            gui.list.toggle();
            if (gui.list.is(':visible')) {
                gui.reportVisible.visibleGui = gui;
            }
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
            $('div.cvrgItemMainDiv', $item).hide();
            if (item.onclose) {
                item.onclose(item);
            }
        },
        openItem: function(itemKey) {
            //Open an item in the GUI
            this.closeAllItems();
            var item = this.items[itemKey];
            var $item = item.item;
            $('div.cvrgItemMainDiv', $item).show();
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
            var $divs = $('div.cvrgItemMainDiv', this.items[item].item);
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
            if (this.reportVisible.visibleGui === this) {
                this.reportVisible.visibleGui = null;
                CVRGUI.visibleGui = null;
            }
        },
        showMenu: function() {
            //Show the GUI
            this.closeAllItems();
            this.list.show();
            this.reportVisible.visibleGui = this;
        },
        isDefaultHidden: function() {
            //Is the default item currently open?
            return $('.cvrgItemMainDiv', this.defaultItem.item).is(':hidden');
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


    //Adding the hammer link to the question
    function addCvplsToDom() {
        //Adds the cv-pls link-button(s) and dialog to the DOM, if it does not already exist in the DOM.
        function addCvplsToDomForPostType(list, postType = 'question') {
            //Add a cv-pls GUIs to any post of the specified type when one does not already exist on the .post-menu .post-menu-container
            const origLength = list.length;
            //Putting the GUI in when the .post-menu is .preview-options messes up the page-UI interaction for
            //  editing. This should be further investigated, but just not putting it there is sufficient.
            const nonGridJSPostMenus = $('.js-post-menu:not(.post-menu)').filter(function() {
                //SE currently uses different HTML on review pages, where a .js-post-menu has buttons as its children.
                //  However, those are all display:none, but that doesn't prevent us from adding a request button.
                const $this = $(this);
                return $this.children('button').length && !$this.children('.grid').length;
            });
            $(`.${postType} .post-menu:not(.preview-options) .post-menu-container, .${postType} .post-menu:not(.preview-options), .${postType} .js-post-menu:not(.preview-options) > .d-flex`).add(nonGridJSPostMenus).filter(function() {
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
                if (!$this.closest('.question,.answer').is('.' + postType)) {
                    //The closest .question/.answer for this .post-menu .post-menu-container is not the type we're looking for.
                    return;
                }
                const qc = getQuestionContext($this);
                if( isQuestionClosed(qc) || isQuestionDeleted(qc) || isPostLocked(qc)) {
                    return;
                }

                if (!$('.cvrgui.hammer', this).length) {
                    //No cvrgui on this post yet
                    const newGui = new Gui($this.closest('.' + postType).attr(`data-${postType}id`), CVRGUI, $this.is('.js-post-menu > .d-flex'));
                    if ($this.is('.post-menu')) {
                        $this.append('<span class="lsep">|</span>'); //separator between each .post-menu .post-menu-container item
                    }
                    $this.append(newGui.wrapper);
                    list.push(newGui);
                }
            });
            if (origLength && origLength !== list.length) {
                //Not the first time through && at least 1 post was added.
                CVRGUI.cleanQuestions();
            }
        }
        addCvplsToDomForPostType(CVRGUI.questions);
    }

    addCvplsToDom();



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
        //If there's more than one question, the context is the closest .mainbar
        //This is different in
        //  Normal pages with a single question (#mainbar)
        //  Some review queues and the reopen queue with a question closed as duplicate (.mainbar)
        //  Other review queues for answers: (.review-content)
        //    In these cases (e.g. First Posts), the answer will find .mainbar, but it does not include the question, so we look for the next match further up the DOM.
        //  MagicTag: (#mainbar-full)
        //  Inside the Close Dialog within previewing a potential duplicate question. (.show-original)
        //  10k tools (NATO with NATO Enhancements): (body.tools-page #mainbar > table > tbody > tr > td)
        //  10k tools (NATO without NATO Enhancements): (.cvrgFakeQuestionContext is added to the DOM)
        const $el = (element instanceof jQuery) ? element : $(element);
        if (isSuggestedEditReviewPage && element.closest('.s-page-title').length) {
            return $('.js-review-task');
        }
        const context = $el.closest('#mainbar, .review-content, .mainbar, #mainbar-full, .show-original, .cvrgFakeQuestionContext, body.tools-page #mainbar > table.default-view-post-table > tbody > tr > td, .js-review-task, .makyen-flag-post-preview-container');
        if (!context.length) {
            //A containing element which we recognize as the context for the element's question wasn't found.
            return $(document);
        }
        if (context.is('.cvrgFakeQuestionContext') || context.find('.question').length) {
            return context;
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
        executeInPage(inPageWatchSEFunction, true, 'cvrg-watchSEFunction-' + seFunction, seFunction, eventTypeBase);
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
        {seFunction: 'question.init',                           listeners: {after: addCvplsToDom}},
        {seFunction: 'question.initFull',                       listeners: {after: addCvplsToDom}},
        {seFunction: 'beginEditEvent.cancel',                   listeners: {after: addCvplsToDom}}, //Happens on edit cancel (then SE.using returns)
        {seFunction: 'using',                                   listeners: {after: addCvplsToDom}},
        {seFunction: 'helpers.removeSpinner',                   listeners: {after: addCvplsToDom}},
        {seFunction: 'question.getQuestionId',                  listeners: {after: addCvplsToDom}},
        {seFunction: 'question.bindSuggestedEditPopupLinks',    listeners: {after: addCvplsToDom}}, //Happens when getting a new question/answer version due to someone else editing (at least on answers)
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
        addCvplsToDom();
        var didPlace = false;
        var allPlaced = true;
        seFunctionsToWatch.forEach(function(watcher) {
            if (!watcher.placed) {
                allPlaced = false;
                if (isSEFunctionValid(watcher.seFunction)) {
                    watcher.placed = true;
                    didPlace = true;
                    watchSEFunction(watcher.seFunction, 'cvrg-SE-', watcher.listeners);
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
    watchSEFunction('ready', 'cvrg-SE-', {
        after: listenerForSEReady,
    });

    //Perform a check for the SE functions we're watching when the callback for SE.ifUsing is executed.
    //  Use SE.ifUsing in order not to change what's actually loaded on the page we're in.
    function inPageWatchSEUsing() {
        StackExchange.ready(function() {
            window.dispatchEvent(new CustomEvent('cvrg-SEActuallyReady', {
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
                window.dispatchEvent(new CustomEvent('cvrg-useSEifUsing', {
                    bubbles: true,
                    cancelable: true,
                    detail: type,
                }));
            });
        });
    }
    window.addEventListener('cvrg-useSEifUsing', listenerForSEReady, true);
    executeInPage(inPageWatchSEUsing, true, 'cvrg-useSEifUsing');

    //Watch for SE.ready. Various functions which we're interested in are available when SE.ready fires.
    function inPageGetSEReady() {
        StackExchange.ready(function() {
            window.dispatchEvent(new CustomEvent('cvrg-SEActuallyReady', {
                bubbles: true,
                cancelable: true,
            }));
        });
    }
    window.addEventListener('cvrg-SEActuallyReady', listenerForSEReady, true);
    executeInPage(inPageGetSEReady, true, 'cvrg-getSEReady');
})();
