var Location = (function() {

var set = function(page_id, title_hint, from_page_id, from_title_hint, template) {
    var hash = page_id;
    if (title_hint) {
        hash += "&title_hint="+title_hint;
    }
    if (from_page_id) {
        hash += "&from_page_id="+from_page_id;
    }
    if (from_title_hint) {
        hash += "&from_title_hint="+from_title_hint;
    }
    if (template) {
        hash += "&template="+template;
    }
    document.location.hash = hash;
};

var from_hash = function(hash) {

    if (!hash) {
        hash = document.location.hash;
    }

    var id_match = /^#?([^&]+)/.exec(hash);
    if (id_match) {
        var page_id = decodeURIComponent(id_match[1]);
    } else {
        var page_id = '';
    }

    var title_hint_match = /&title_hint=([^&]+)/.exec(hash);
    if (title_hint_match) {
        var title_hint = decodeURIComponent(title_hint_match[1]);
    } else {
        var title_hint = '';
    }

    var from_page_id_match = /&from_page_id=([^&]+)/.exec(hash);
    if (from_page_id_match) {
        var from_page_id = decodeURIComponent(from_page_id_match[1]);
    } else {
        var from_page_id = '';
    }

    var from_title_hint_match = /&from_title_hint=([^&]+)/.exec(hash);
    if (from_title_hint_match) {
        var from_title_hint = decodeURIComponent(from_title_hint_match[1]);
    } else {
        var from_title_hint = '';
    }

    var template_match = /&template=([^&]+)/.exec(hash);
    if (template_match) {
        var template = decodeURIComponent(template_match[1]);
    } else {
        var template = '';
    }

    return { page_id: page_id,
             title_hint: title_hint,
             from_page_id: from_page_id,
             from_title_hint: from_title_hint,
             template: template };
}

return { set: set,
         from_hash: from_hash };

})();
