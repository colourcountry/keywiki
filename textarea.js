var Textarea = (function() {

var get_current_word = function(textarea) {
    if (textarea.selectionStart != textarea.selectionEnd) {
        var selection = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
        console.log('Returning selection: '+selection);
        return selection.replace(/_/g,' ');
    }

    console.log('Looking for non-space after "'+textarea.value.slice(textarea.selectionEnd)+'"');
    var space_match = /^([\w_]+)/.exec(textarea.value.slice(textarea.selectionEnd));
    if (space_match) {
        console.log('found '+space_match[1].length);
        var slice = textarea.value.slice(0,textarea.selectionEnd + space_match[1].length);
    } else {
        var slice = textarea.value.slice(0,textarea.selectionEnd);
    }

    var match = /([\w_]+)\s*$/.exec(slice);

    if (match) {
        console.log('Returning last word before cursor: '+match[1]);
        return match[1].replace(/_/g,' ');
    } else {
        console.log('No current word');
        return null;
    }
}

var insert_special_space = function(textarea) {
    insert_char(textarea, '_');
}

var insert_char = function(textarea, char, remove_count) {
    /* will actually insert any string */
    if (!remove_count) {
        remove_count = 0;
    }
    var spliceIdx = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0,spliceIdx-remove_count)+char+textarea.value.slice(spliceIdx);
    textarea.selectionStart = spliceIdx + char.length;
    textarea.selectionEnd = spliceIdx + char.length;
    return false;
}

return { get_current_word: get_current_word,
         insert_char: insert_char,
         insert_special_space: insert_special_space
       };

})();
