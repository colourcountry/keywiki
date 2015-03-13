var Storage = (function() {

var DB;

/* nobble this char code and use it for command char when entered */
/* these chars should correspond to a single key */
var ENTER_CMD = '`';

/* if page with id 0 does not exist (even as an archive) then this is
   a new install
*/
var NEW_INSTALL_MSG = '';

var SEARCH_ENGINE = new fullproof.BooleanEngine();
var SEARCH_INDEX;
var SEARCH_READY = false;

/* Sometimes the index lookup fails, so build a backup */
var INDEX_BACKUP = {};

/* Temporary store for IDs we know to be archives */
var ARCHIVED_IDS = {};

var raise_db_error = function(msg) {
    return function(e) {
        console.log(msg);
        console.dir(e);
    }
}

/* Look up a page by title, using the IndexedDB index and also the backup index
   we have been building.
   If an object can be associated with a title, adds this to the backup index
   and calls add_result_cb(obj, priority); calls no_results_cb() if not.
   The backup index only contains IDs: if title matches an ID but not an object,
   we try a straightforward get to obtain the object.

   Parameters:
    title_hint - the first line to look for
    add_result_cb - callback when a matching page is found
    no_results_cb - callback if there was no matching page
*/
var find_page = function(title_hint, add_result_cb, no_results_cb) {

    var tx = DB.transaction(["wiki"],"readonly");
    var wiki = tx.objectStore("wiki");

    console.log("Getting from index: "+title_hint);
    var index = wiki.index("first_line");

    var rq = index.get(title_hint.toLocaleLowerCase());
    /* FIXME: when the title hint matches several pages this just returns the first one (oldest one?) */

    rq.onerror = raise_db_error( "Error getting title "+title_hint+" from index" );

    rq.onsuccess = function(e) {
        if (e.target.result) {
            console.log("Found "+title_hint);
            /* Add/update index backup in case the same query fails later */
            INDEX_BACKUP[title_hint] = e.target.result.id;
            add_result_cb(e.target.result);
        } else if (INDEX_BACKUP[title_hint]) {
            console.log("Found "+title_hint+" in backup: "+INDEX_BACKUP[title_hint]);
            var detail_tx = DB.transaction(["wiki"],"readonly");
            var detail_wiki = detail_tx.objectStore("wiki");
            var detail_rq = detail_wiki.get(INDEX_BACKUP[title_hint]);
            detail_rq.onerror = raise_db_error("Failed to get object from backup ID "+INDEX_BACKUP[title_hint]);
            detail_rq.onsuccess = function(e) {
                if (e.target) {
                    console.warn("Page not in IDB index but found via backup: "+title_hint);
                    add_result_cb(e.target.result);
                } else {
                    console.log("No sign of "+title_hint+", removing from backup index");
                    delete INDEX_BACKUP[title_hint];
                }
            }
        } else {
            console.log("No direct match for "+title_hint);
            console.dir(e);
            no_results_cb();
        }
    };
};

var update_search = function(search_for, except_id, add_result_cb, no_results_cb) {

    if (!SEARCH_READY) {
        console.log("Not searching because search engine is not ready.");
        return;
    }

    console.log("Searching for: "+search_for);
    SEARCH_ENGINE.lookup(search_for, function(results) {
        if (!results) {
            console.log('Search engine returned null');
        } else {
            console.log('Search engine returned '+results.getSize());

            var detail_tx = DB.transaction(["wiki"],"readonly");
            var detail_wiki = detail_tx.objectStore("wiki");
            if (results) {
                results.forEach(function(result) {
                    if (ARCHIVED_IDS[result]) {
                        console.log("Skipping archive result "+result);
                    } else if (result != except_id) {
                        console.log("Getting details for search result "+result);
                        var detail_rq = detail_wiki.get(result);
                        detail_rq.onerror = raise_db_error("Failed to get search result "+result);
                        detail_rq.onsuccess = function(e) {
                            if (e.target.result) {
                                if (e.target.result.replaced_by) {
                                    console.log("Result "+e.target.result.id+" was an archive");
                                    ARCHIVED_IDS[e.target.result.id] = true;
                                } else {
                                    add_result_cb(e.target.result);
                                }
                            } else {
                                console.warn("Couldn't find search result, stale index?");
                            }
                        }
                    }
                });
            }
        }
    });
};

/*  Check page_id to see if it needs to be saved, 
    and save if it does
*/
var check_and_save_page = function(textarea, page_id) {
    /* freeze the content */
    var new_content = textarea.value;
    var selection_start = textarea.selectionStart;
    var selection_end = textarea.selectionEnd;

    if (new_content.indexOf('\n') > -1) {
        var first_line = new_content.slice(0,new_content.indexOf('\n')).toLocaleLowerCase();
    } else {
        var first_line = new_content.toLocaleLowerCase();
    }


    if (!page_id) {
        console.log("Not saving page as have nowhere to put it.");
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
            save_page(page_id, first_line, new_content, selection_start, selection_end);
        } else if (result.replaced_by) {
            /* page marked as archived */
            console.log("Page was archived, so cannot be updated");
            return null;
        } else if (result.content == new_content) {
            console.log("Page is unchanged from latest revision");
        } else {
            save_page(page_id, first_line, new_content, selection_start, selection_end);
        }
    }

    /* return the first_line we have derived,
       which is usable even if page is archived or unchanged.
       This will be used to provide a guaranteed nav button for
       the page we have just left */
    return first_line;
}
    

/*  Save the page referenced by page_id 
    - page_id is updated with a time stamp for archival and the first_line is changed
      so that it will no longer be returned by the exact match index
    - if the textarea is not empty, a new page_id is generated and entered in the database
      with the textarea content

    In this way, the new page will take over from the old page, as it will be returned
    by the same searches that previously yielded the old page.

    A separate process may (doesn't yet) come round and archive the old page versions.

    NB: in the context of page switching the 'new' page is the page we are switching from.
*/
var save_page = function(page_id, first_line, new_content, selection_start, selection_end) {
    var tx = DB.transaction(["wiki"],"readwrite");
    var wiki = tx.objectStore("wiki");

    if (new_content) {

        var new_page_spec = {
            first_line: first_line,
            content: new_content,
            id: ''+new Date().getTime(),
            selection_start: selection_start,
            selection_end: selection_end,
            replaced_by: null
        }

        var old_page_spec = {
            first_line: first_line+' @ '+page_id,
            content: new_content,
            id: page_id,
            selection_start: selection_start,
            selection_end: selection_end,
            replaced_by: new_page_spec.id,
            replaced_date: new Date().getTime()
        };


    } else {

        var new_page_spec = null;

        var old_page_spec = {
            first_line: first_line+' @ '+page_id,
            content: new_content,
            id: page_id,
            selection_start: selection_start,
            selection_end: selection_end,
            replaced_by: ''+new Date().getTime(),
            replaced_date: new Date().getTime()
        };

    }

    /* We can't save the new page until the old one is archived as it would violate unique key constraint */
    var rq = wiki.put(old_page_spec, page_id);
    rq.onerror = raise_db_error( "Error archiving page: "+old_page_spec.first_line );
    rq.onsuccess = function(e) {
        console.log("Archived "+old_page_spec.first_line);
        ARCHIVED_IDS[old_page_spec.id] = true;
        if (new_page_spec) {
            var rq = wiki.put(new_page_spec, new_page_spec.id);
            rq.onerror = raise_db_error( "Error saving page: "+new_page_spec.first_line );
            rq.onsuccess = function(e) {
                INDEX_BACKUP[new_page_spec.first_line] = new_page_spec.id;
                console.log("Saved "+new_page_spec.id+": "+new_page_spec.first_line);
                if (SEARCH_READY) {
                    SEARCH_ENGINE.injectDocument( new_page_spec.content, new_page_spec.id,
                        function() {
                            console.log("Injected document "+new_page_spec+" "+new_page_spec.first_line);
                        }
                    );
                }
            };
        }
    }
}


var switch_page = function(textarea, to_page_id, title_hint, from_page_id, from_title_hint, template, result_cb) {
    console.log('Switching to page '+to_page_id+' with title hint "'+title_hint+'"');

    /* Save the page we are leaving and remember what it was called */
    var from_title = check_and_save_page(textarea, from_page_id);

    if (!from_title) {
        from_title = from_title_hint;
    }

    /* Get the new page */
    var tx = DB.transaction(["wiki"],"readonly");
    var wiki = tx.objectStore("wiki");

    var rq = wiki.get(to_page_id);
    rq.onerror = raise_db_error( "Error getting page "+to_page_id );
    rq.onsuccess = function(e) {
        if (e.target.result) {
            INDEX_BACKUP[e.target.result.first_line] = e.target.result.id;
            if (e.target.result.replaced_by) {
                /* this id is an archived page, find the next version */
                console.log( "id "+e.target.result.id+" was replaced by "+e.target.result.replaced_by);
                Location.set( e.target.result.replaced_by, title_hint, from_page_id, from_title);
            } else {
                console.log("Got page "+to_page_id+": "+e.target.result.first_line);
                console.dir(e.target.result);
                textarea.value = e.target.result.content;
                textarea.selectionStart = e.target.result.selection_start;
                textarea.selectionEnd = e.target.result.selection_end;
                document.title = e.target.result.first_line;
                result_cb(e.target.result);
            }
        } else {
            console.log("No page with id "+to_page_id);
            textarea.value = template;
            textarea.selectionStart = textarea.value.length;
            textarea.selectionEnd = textarea.value.length;
            document.title = title_hint+' (new page)';
            /* not a real page yet, so don't supply anything to callback */
            result_cb();
        }
    }
};

var init_db = function(new_install_msg) {

    /* inject welcome message from page */
    NEW_INSTALL_MSG = new_install_msg;

    console.log('Opening DB...');
    var rq = indexedDB.open("keywiki",1);

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

        capabilities: new fullproof.Capabilities().setUseScores(false).setDbName("wiki2_search"),

        initializer: function(injector, cb) {
            var tx = DB.transaction(["wiki"],"readonly");
            var wiki = tx.objectStore("wiki");

            var rq = wiki.count();
            rq.onerror = raise_db_error( "Error counting object store" );
            rq.onsuccess = function(e) {
                var count = e.target.result;
                console.log("Counted "+count+" pages to index.");

                /* Not really sure why fullproof worries that injections will get reordered---
                   cf. http://reyesr.github.io/fullproof/tutorial.html
                   nevertheless I'll follow the example */

                var synchro = fullproof.make_synchro_point(cb, count);
                var cursor_rq = wiki.openCursor();
                cursor_rq.onsuccess = function(e) {
                    var result = e.target.result;
                    if (result) {
                        if (result.replaced_by) {
                            /* don't inject archived page */
                        } else {
                            injector.inject(result.value.content, result.value.id, synchro);
                        }
                        count--;
                        result.continue();
                    } else {
                        if (count > 0) {
                            console.log("Injected all results but still have "+count+" left according to count.");
                        }
                        cb();
                    }
                }
            }
        }
    };

    console.log("Opening search engine");
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

var delete_all_data = function() {
    console.log("Deleting all data");
    var tx = DB.transaction(["wiki"],"readwrite");
    var wiki = tx.objectStore("wiki");
    var rq = wiki.clear();
    rq.onsuccess = function(e) {
        console.log("All data deleted");
        clear_search_index();
    }
};

var delete_archives = function() {
    console.log("Deleting archives");
    var tx = DB.transaction(["wiki"],"readwrite");
    var wiki = tx.objectStore("wiki");
    var rq = wiki.openCursor();
    rq.onsuccess = function(e) {
        var result = e.target.result;
        if (result) {
            if (result.value.replaced_by) {
                var delete_rq = wiki.delete(result.value.id);
                delete_rq.onsuccess = function(e) {
                    console.log("Deleted archive "+result.value.first_line);
                }
            } else {
                console.log("Keeping "+result.value.first_line);
            }
            result.continue();
        }
    }
};

var export_pages = function(include_archives) {
    var tx = DB.transaction(["wiki"],"readonly");
    var wiki = tx.objectStore("wiki");
    var rq = wiki.openCursor();
    var pages = [];
    rq.onsuccess = function(e) {
        var result = e.target.result;
        if (result) {
            if (include_archives || !result.value.replaced_by) {
                pages.push(result.value);
            }
            result.continue();
        } else {
            var blob = new Blob([JSON.stringify(pages, null, 4)],
                                {'type':'application/json;charset=utf-8;'});
            var save_url = window.URL.createObjectURL(blob);

            var save_link = document.getElementById('save_link');
            save_link.setAttribute('href', save_url);
            save_link.setAttribute('download', 'keywiki.json');
            save_link.click();
        }
    }    
}

var clear_search_index = function() {
    if (!SEARCH_READY) {
        console.log("Can't clear search index as search is not ready.");
        return;
    }

    console.log("Clearing search index");
    SEARCH_ENGINE.clear(
        function() {
            console.log("Search index cleared");
        }
    );
};

return { find_page: find_page,
         switch_page: switch_page,
         update_search: update_search,
         clear_search_index: clear_search_index,
         delete_all_data: delete_all_data,
         delete_archives: delete_archives,
         export_pages: export_pages,
         init_db: init_db };

})();
