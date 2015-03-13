var Navigation = (function() {

var CONTAINER_ID;

var safe_html = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var clear = function() {
    var container = document.getElementById(CONTAINER_ID);
    container.innerHTML = '<ul id="'+CONTAINER_ID+'-priority"></ul><ul id="'+CONTAINER_ID+'-normal"></ul>';
}

var add = function(result, priority) {

    if (!result.first_line) {
        console.warn("Can't add page with empty first_line");
        return;
    }

    console.log('Adding '+result.first_line+' with priority '+priority);

    if (priority) {
        var ul = document.getElementById( CONTAINER_ID+'-priority' );
    } else {
        var ul = document.getElementById( CONTAINER_ID+'-normal' );
    }

    var new_id = 'nav_'+result.id;

    if ( document.getElementById(new_id) ) {
        console.log('Nav already had a button for '+new_id);
    } else {
        console.log('Adding button for '+new_id);

        var tmp = document.createElement( 'ul' );
        tmp.innerHTML = '<li id="'+new_id+
                   '"><button onclick="Navigation.handle_click(&quot;'+result.id+
                   '&quot;,&quot;'+result.first_line+
                   '&quot;)">'+result.first_line+'</button></li>';
        ul.appendChild( tmp.firstChild );
    }
}

var handle_click = function(page_id, title_hint) {
    /* get current page ID and maybe even its original title */
    var location = Location.from_hash();

    Location.set( page_id, title_hint, location.page_id, location.title_hint );
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
