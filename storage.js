var Storage = (function() {

var DB;

/* nobble this char code and use it for command char when entered */
/* these chars should correspond to a single key */
var ENTER_CMD = '`';

var SEARCH_ENGINE = new fullproof.BooleanEngine();
var SEARCH_INDEX;
var SEARCH_READY = false;

var raise_db_error = function(msg) {
    return function(e) {
        console.log(msg);
        console.dir(e);
    }
}

var find_page = function(title_hint, add_result_cb, no_results_cb) {

    var tx = DB.transaction(["wiki"],"readonly");
    var wiki = tx.objectStore("wiki");

    console.log("Getting from index: "+title_hint);
    var index = wiki.index("first_line");

    var rq = index.get(title_hint);
    /* FIXME: what happens when the title hint matches several pages - this just returns the first one */

    rq.onerror = raise_db_error( "Error getting title "+title_hint+" from index" );

    rq.onsuccess = function(e) {
        if (e.target.result) {
            console.log("Found "+title_hint);
            add_result_cb(e.target.result, true);
        } else {
            console.log("No direct match for "+title_hint);
            console.dir(e);
            no_results_cb();
        }
        if (SEARCH_READY) {
            console.log("Searching for: "+title_hint);
            SEARCH_ENGINE.lookup(title_hint, function(results) {
                if (!results) {
                    console.log('Search engine returned null');
                } else {
                    console.log('Search engine returned '+results.getSize());

                    SEARCH_ENGINE.lookup('__ARCHIVED__', function(archived_results) {
                        if (archived_results) {
                            console.log(archived_results.getSize()+' archives');
                            results.substract( archived_results );
                        }

                        var detail_tx = DB.transaction(["wiki"],"readonly");
                        var detail_wiki = detail_tx.objectStore("wiki");
                        if (results) {
                            results.forEach(function(result) {
                                console.log("Getting details for search result "+result);
                                if (e.target.result && result != e.target.result.id) {
                                    var detail_rq = detail_wiki.get(result);
                                    detail_rq.onerror = raise_db_error("Failed to get search result "+result);
                                    detail_rq.onsuccess = function(e) {
                                        if (e.target.result.replaced_by) {
                                            console.log("Result "+e.target.result.id+" was an archive that snuck through");
                                        } else {
                                            add_result_cb(e.target.result, false);
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    };
};

/*  Check page_id to see if it needs to be saved, 
    and save if it does
*/
var check_and_save_page = function(textarea, page_id) {
    if (!page_id) {
        console.log("Not saving page as have nowhere to put it.");
        return null;
    } else if (textarea.value && textarea.value.endsWith('__EDIT_ME__')) {
        console.log("Text area had not been edited, not saving");
        return null;
    }

    /* further checks need the page to be retrieved */

    var tx = DB.transaction(["wiki"],"readonly");
    var wiki = tx.objectStore("wiki");
    var rq = wiki.get(page_id);
    rq.onerror = raise_db_error( "Error getting page "+page_id );
    rq.onsuccess = function(e) {
        var result = e.target.result;
        if (!result) {
            console.log("Couldn't find existing page "+page_id );
            save_page(textarea, page_id);
        } else if (result.replaced_by) {
            /* page marked as archived */
            console.log("Page was archived, so cannot be updated");
            return null;
        } else {
            save_page(textarea, page_id);
        }
    }
}
    

/*  Save the content of textarea belonging to page_id.
    - page_id is updated with a time stamp for archival and an empty first_line
      so that it will no longer be returned by the exact match index
    - '__ARCHIVED__' is injected into the search index for page_id (TODO)
    - if the textarea is not empty, a new page_id is generated and entered in the database
      with the textarea content

    In this way, the new page will take over from the old page, as it will be returned
    by the same searches that previously yielded the old page.

    A separate process may (doesn't yet) come round and archive the old page versions.
*/
var save_page = function(textarea, page_id) {
    var tx = DB.transaction(["wiki"],"readwrite");
    var wiki = tx.objectStore("wiki");

    if (textarea.value) {

        if (textarea.value.indexOf('\n') > -1) {
            var first_line = textarea.value.slice(0,textarea.value.indexOf('\n'));
        } else {
            var first_line = textarea.value;
        }

        var new_page_spec = {
            first_line: first_line,
            content: textarea.value,
            id: ''+new Date().getTime(),
            selection_start: textarea.selectionStart,
            selection_end: textarea.selectionEnd,
            replaced_by: null
        }

        var old_page_spec = {
            first_line: '__ARCHIVED__',
            content: textarea.value,
            id: page_id,
            selection_start: textarea.selectionStart,
            selection_end: textarea.selectionEnd,
            replaced_by: new_page_spec.id,
            replaced_date: new Date().getTime()
        };


    } else {

        var new_page_spec = null;

        var old_page_spec = {
            first_line: '__ARCHIVED__',
            content: textarea.value,
            id: page_id,
            selection_start: textarea.selectionStart,
            selection_end: textarea.selectionEnd,
            replaced_by: ''+new Date().getTime(),
            replaced_date: new Date().getTime()
        };

    }

    var rq = wiki.put(old_page_spec, page_id);
    rq.onerror = raise_db_error( "Error archiving page" );
    rq.onsuccess = function(e) {
        console.log("Archived "+old_page_spec.id);
        if (SEARCH_READY) {
            /* no need to inject the content again */
            SEARCH_ENGINE.injectDocument( '__ARCHIVED__', page_id,
                function() {
                    console.log("Injected archived flag for "+page_id);
                }
            );
        }
    }

    if (new_page_spec) {
        var rq = wiki.put(new_page_spec, new_page_spec.id);
        rq.onerror = raise_db_error( "Error saving page" );
        rq.onsuccess = function(e) {
            console.log("Saved "+new_page_spec.id+": "+new_page_spec.first_line);
            if (SEARCH_READY) {
                SEARCH_ENGINE.injectDocument( new_page_spec.content, new_page_spec.id,
                    function() {
                        console.log("Injected document "+new_page_spec+" "+new_page_spec.first_line);
                    }
                );
            }
        }
        return new_page_spec.id; /* just in case it's useful later */
    }

    return null;
}

var switch_page = function(textarea, from_page_id, to_page_id, title_hint) {
    console.log('Switching to page '+to_page_id+' with title hint "'+title_hint+'"');

    check_and_save_page(textarea, from_page_id);

    var tx = DB.transaction(["wiki"],"readonly");
    var wiki = tx.objectStore("wiki");

    var rq = wiki.get(to_page_id);
    rq.onerror = raise_db_error( "Error getting page "+to_page_id );
    rq.onsuccess = function(e) {
        if (e.target.result) {
            if (e.target.result.replaced_by) {
                /* this id is an archived page, find the next version */
                console.log( "id "+e.target.result.id+" was replaced by "+e.target.result.replaced_by);
                document.location.hash = e.target.result.replaced_by
            } else {
                console.log("Got page "+to_page_id+": "+e.target.result.first_line);
                textarea.value = e.target.result.content;
                textarea.selectionStart = e.target.result.selection_start;
                textarea.selectionEnd = e.target.result.selection_end;
            }
        } else {
            console.log("No page with id "+to_page_id);
            textarea.value = title_hint+'\n'+Array(title_hint.length+1).join('=')+'\n\n__EDIT_ME__';
            textarea.selectionStart = textarea.value.length;
            textarea.selectionEnd = textarea.value.length;
        }
    }
};

var init_db = function() {

    console.log('Opening DB...');
    var rq = indexedDB.open("wiki3",1);

    rq.onerror = raise_db_error( "Error opening wiki database" );
    rq.onupgradeneeded = function(e) {
        var wiki;

        console.log("Wiki database upgrade needed");
        DB = e.target.result;

        if (DB.objectStoreNames.contains("wiki")) {
            tx = DB.transaction(["wiki"],"readwrite");
            wiki = tx.objectStore("wiki");
        } else {
            wiki = DB.createObjectStore("wiki");
        }

        if (!wiki.indexNames.contains("first_line")) {
            wiki.createIndex("first_line", "first_line", {unique:false});
        }
    }
    rq.onsuccess = function(e) {
        console.log("Opened wiki database");
        DB = e.target.result;

        /* now the DB is ready we can fetch the first page */
        window.onhashchange();
    }
 

    SEARCH_INDEX = {
        name: "normalindex",

        analyzer: new fullproof.StandardAnalyzer(fullproof.normalizer.to_lowercase_nomark),

        capabilities: new fullproof.Capabilities().setUseScores(false).setDbName("wiki_search"),

        initializer: function(injector, cb) {
            var tx = DB.transaction(["wiki"],"readonly");
            var wiki = tx.objectStore("wiki");

            var rq = wiki.count();
            rq.onerror = raise_db_error( "Error counting object store" );
            rq.onsuccess = function(e) {
                var count = e.target.result;

                /* Not really sure why fullproof worries that injections will get reordered---
                   cf. http://reyesr.github.io/fullproof/tutorial.html
                   nevertheless I'll follow the example */

                var synchro = fullproof.make_synchro_point(cb, count);
                var cursor_rq = wiki.openCursor();
                cursor_rq.onsuccess = function(e) {
                    var result = e.target.result;
                    if (result) {
                        injector.inject(result.value.content, result.value.id, synchro);
                        result.continue();
                    }
                }
            }
        }
    };

    SEARCH_ENGINE.open([SEARCH_INDEX],
        function() {
            console.log( "Search engine is ready!" );
            SEARCH_READY = true;
        },
        function() { 
            console.log( "Search engine failed to initialize" );
            SEARCH_READY = false;
        }
    );

};

return { find_page: find_page,
         switch_page: switch_page,
         init_db: init_db };

})();
