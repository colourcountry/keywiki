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

- View list of all pages
- Char map tool
- Page colours
- Preferences mechanism
- Preferences option to disable/remap Ctrl-ENTER
- Export pages listed in side bar
- Possibly replace fullproof:
    it's not actively maintained and doesn't do stemming
    OTOH, unlike lunr.js it can use IndexedDB not just memory.
