### SO-hammer-with-list userscript

This userscript automates closing Stack Overflow questions as duplicates and editing the duplicate list. It is a follow up to [this Meta Stack Exchange question](https://meta.stackexchange.com/q/378558/797752). 
The premise is that several very common duplicates are repeatedly asked and all are closed against the same duplicate list. This script automates closing, opening to the originals page, editing the originals in and clicking "Save".

The code is an adaptation of `SECloseVoteRequestGenerator` userscript found at https://github.com/SO-Close-Vote-Reviewers/UserScripts.
Currently it is also meant to run strictly after that script in order to reuse some of CVRG's CSS. This script calls two internal endpoints in sequence:

- `/flags/questions/${questionId}/close/add` to close the question with one duplicate target
- `/questions/originals/${questionId}/save-originals` to edit the duplicate list with the other duplicate targets

Both calls need the user's `fkey` as a form parameter. The `fkey` is obtained with Stack Exchange's API `StackExchange.options.user.fkey`.

The first call needs a form parameter `duplicateOfQuestionId=${targetId}` to close as duplicate. 

The second call needs a form parameter `originalsIdsJson=${idList}`, where `idList` is a list with literal square brackets, as: `[123,456,678]`.

Additional details about how to use this userscript can be found in [this post on StackApps](https://stackapps.com/questions/9400/duplicate-manager-with-automatic-closure-and-duplicate-list-editing)

### Necessary privileges

You must run this script as a user with a gold tag badge in one of the question's tags.

### TODOs and improvements

- Clean up the code even more
- Import/export duplicate targets
