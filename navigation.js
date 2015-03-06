var Navigation = (function() {

var CONTAINER_ID;

var safe_html = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var clear = function() {
    var container = document.getElementById(CONTAINER_ID);
    container.innerHTML = '<ul id="'+CONTAINER_ID+'_priority"></ul><ul id="'+CONTAINER_ID+'_normal"></ul>'
}

var add = function(result, priority) {
    console.log('Adding '+result.first_line+' with priority '+priority);
    if (priority) {
        var ul = document.getElementById(CONTAINER_ID+'_priority');
    } else {
        var ul = document.getElementById(CONTAINER_ID+'_normal');
    }
    if (result.id == LAST_PAGE_ID) {
        var selected = 'class="selected"';
    } else {
        var selected = '';
    }

    var tmp = document.createElement('body');
    tmp.innerHTML = '<li id="nav_'+result.id+'" onclick="Navigation.handle_click('+result.id+')" '+selected+'>'+result.first_line+'</li>';
    ul.appendChild(tmp.firstChild);
}

var handle_click = function(node, page_id) {
    var old_button = document.getElementById(CONTAINER_ID+'_'+LAST_PAGE_ID);
    if (old_button) {
        document.getElementById(CONTAINER_ID+'_'+LAST_PAGE_ID).className = '';
    }
    document.location.hash = page_id;
}

var init = function(container_id) {
    CONTAINER_ID = container_id;
}

return { init: init,
         clear: clear,
         add: add,
         handle_click: handle_click
       };

})();
