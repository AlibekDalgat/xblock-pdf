/* Javascript for pdfXBlock. */
function pdfXBlockInitView(runtime, element) {
    var $element = $(element);
    var $pdfBlock = $element.find('.pdf_block').addBack('.pdf_block').first();
    var blockId = $pdfBlock.attr('data-block-id');

    if (!blockId) {
        console.error('[PDFX] Block ID not found');
        return;
    }

    function getCSRFToken() {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();
            if (cookie.startsWith('csrftoken=')) {
                return cookie.substring('csrftoken='.length, cookie.length);
            }
        }
        var metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    var container = document.getElementById('pdf-viewer-' + blockId);
    if (!container) return;

    var pagesDiv = container.querySelector('.pages-container');
    var loading = container.querySelector('.loading');
    var currentEl = container.querySelector('.current-page[data-block-id="' + blockId + '"]');
    var totalEl = container.querySelector('.total-pages[data-block-id="' + blockId + '"]');
    var prevBtn = container.querySelector('.prev-page[data-block-id="' + blockId + '"]');
    var nextBtn = container.querySelector('.next-page[data-block-id="' + blockId + '"]');

    if (!pagesDiv || !loading || !currentEl || !totalEl || !prevBtn || !nextBtn) return;

    var currentPage = 0;
    var svgPages = [];

    function showPage(idx) {
        if (idx < 0 || idx >= svgPages.length) return;
        currentPage = idx;
        currentEl.textContent = idx + 1;
        pagesDiv.innerHTML = svgPages[idx];
        prevBtn.disabled = (idx === 0);
        nextBtn.disabled = (idx === svgPages.length - 1);
    }

    var handlerUrl = runtime.handlerUrl(element, 'get_svg_pages');
    var fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({}),
        credentials: 'include'
    };

    fetch(handlerUrl, fetchOptions)
        .then(r => r.ok ? r.json() : Promise.reject('HTTP error ' + r.status))
        .then(data => {
            if (data.error) {
                loading.innerHTML = '<p style="color:red;">Error: ' + data.error + '</p>';
            } else if (data.success) {
                totalEl.textContent = data.total;
                svgPages = data.pages;
                loading.style.display = 'none';
                pagesDiv.style.display = 'block';
                showPage(0);
            }
        })
        .catch(err => {
            loading.innerHTML = '<p style="color:red;">Failed to load: ' + err + '</p>';
        });

    prevBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        showPage(currentPage - 1);
    };
    nextBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        showPage(currentPage + 1);
    };
}
