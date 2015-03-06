# keywiki v0.x

A stand-alone mini-wiki in an HTML5 page with no links!

Install
=======
Get fullproof from github and copy it to fullproof.js in this directory.
Then load up index.html in your browser.

Usage
=====

Enter your work in the text area.
This wiki has no explicit markup. What you see is what there is.
Of course you can type in markdown or similar if you like.

Pressing Shift-ENTER
- saves the current page;
- performs an instant search on the current word, displaying results to the left; and
- updates the text area with the first hit.

The current word is either
- the content of the selection, if there is one, or
- the contiguous word characters (including _) next to the caret.

Because the search pulls up all other mentions of the word as well as any pages with that name, it acts as both a link and an instant back link.

Pressing Ctrl-ENTER goes back to the previous page (actually duplicates the browser back button, so you can also use Alt+arrows)

Pressing ` enters a _ for convenience.

Backlog
=======

These features are not yet implemented!

For 1.0
-------

- Export everything
- Issue: IndexedDB index intermittently fails to return a page. Maybe I need to wait for an index updated event?

Later
-----

- Export pages listed in side bar
- Preferences mechanism
- Preferences option to disable/remap the _
- Preferences option to disable Ctrl-ENTER 
- Page colour picker
- Clean up old page versions from database
- Possibly replace fullproof:
    it's not actively maintained and doesn't do stemming
    OTOH, unlike lunr.js it can use IndexedDB not just memory.
    

Ideas
-----

Simple templates could be done by hooking a page to another 'template' page, so the 'template' page is just displayed to the 
side of the main page. This could be useful because a lot of the time you just want a set of common headings.

