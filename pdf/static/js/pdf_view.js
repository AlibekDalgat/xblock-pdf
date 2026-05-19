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

    var viewerMain = container.querySelector('.viewer-main');
    var pagesDiv = container.querySelector('.pages-container');
    var loading = container.querySelector('.loading');
    var currentEl = container.querySelector('.current-page[data-block-id="' + blockId + '"]');
    var totalEl = container.querySelector('.total-pages[data-block-id="' + blockId + '"]');
    
    var prevBtns = container.querySelectorAll('.prev-page, .prev-page-side');
    var nextBtns = container.querySelectorAll('.next-page, .next-page-side');

    if (!pagesDiv || !loading || !currentEl || !totalEl) return;

    var currentPage = 0;
    var svgPages = [];

    function updateNavButtons() {
        prevBtns.forEach(btn => btn.disabled = (currentPage === 0));
        nextBtns.forEach(btn => btn.disabled = (currentPage === svgPages.length - 1));
    }

    function showPage(idx) {
        if (idx < 0 || idx >= svgPages.length) return;
        currentPage = idx;
        currentEl.textContent = idx + 1;
        pagesDiv.innerHTML = svgPages[idx];
        updateNavButtons();
    }


    var touchStartX = 0;
    var touchEndX = 0;
    var isDragging = false;

    function handleSwipe() {
        var swipeThreshold = 50;
        if (touchEndX < touchStartX - swipeThreshold) {
            showPage(currentPage + 1);
        } else if (touchEndX > touchStartX + swipeThreshold) {
            showPage(currentPage - 1);
        }
    }

    pagesDiv.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    }, {passive: true});

    pagesDiv.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, {passive: true});


    pagesDiv.ondragstart = function() { return false; };

    window.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
    });

    window.addEventListener('mouseup', function(e) {
        if (!isDragging) return;
        touchEndX = e.screenX;
        isDragging = false;
        handleSwipe();
    });

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
                pagesDiv.style.display = 'flex';
                showPage(0);
            }
        })
        .catch(err => {
            loading.innerHTML = '<p style="color:red;">Failed to load: ' + err + '</p>';
        });

    prevBtns.forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            showPage(currentPage - 1);
        };
    });
    
    nextBtns.forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            showPage(currentPage + 1);
        };
    });
}
