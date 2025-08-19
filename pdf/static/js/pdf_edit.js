/* Javascript for pdfXBlock. */
function pdfXBlockInitEdit(runtime, element) {
    $(element).find('.action-cancel').bind('click', function () {
        runtime.notify('cancel', {});
    });

    // Настройка drag-and-drop зоны
    var $dropzone = $('#pdf_dropzone', element);
    var $dropzoneText = $dropzone.find('p');

    $dropzone.on('click', function(e) {
        e.preventDefault();
        console.log('Dropzone clicked');
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = function() {
            var file = this.files[0];
            if (file && file.type === 'application/pdf') {
                uploadFile(file);
            } else {
                $dropzoneText.text('Пожалуйста, выберите файл в формате PDF.');
            }
        };
        input.click();
    });

    $dropzone.on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).css('background-color', '#e6f3fa');
    });

    $dropzone.on('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).css('background-color', 'transparent');
    });

    $dropzone.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).css('background-color', 'transparent');
        var file = e.originalEvent.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            uploadFile(file);
        } else {
            $dropzoneText.text('Пожалуйста, выберите файл в формате PDF.');
        }
    });

    function uploadFile(file) {
        var formData = new FormData();
        formData.append('file', file);

        var blockId = window.location.pathname.split('/')[2];
        var courseIdParts = blockId.split('+type@')[0].split(':');
        var courseId = 'course-v1:' + courseIdParts[1];

        $dropzoneText.text('Загрузка файла...');

        $.ajax({
            url: '/assets/' + courseId + '/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': $.cookie('csrftoken')
            },
            success: function(response) {
                if (response.asset && response.asset.url) {
                    $('#pdf_edit_url', element).val(response.asset.url);
                    $dropzoneText.text('Файл загружен! Перетащите новый или нажмите для выбора.');
                } else {
                    $dropzoneText.text('Не удалось загрузить файл: неизвестная ошибка');
                }
            },
            error: function(xhr, status, error) {
                $dropzoneText.text('Ошибка загрузки: ' + error);
            }
        });
    }

    $(element).find('.action-save').bind('click', function () {
        var data = {
            'display_name': $('#pdf_edit_display_name').val(),
            'url': $('#pdf_edit_url').val(),
            'allow_download': $('#pdf_edit_allow_download').val() || '',
            'source_text': $('#pdf_edit_source_text').val() || '',
            'source_url': $('#pdf_edit_source_url').val() || ''
        };

        runtime.notify('save', { state: 'start' });

        var handlerUrl = runtime.handlerUrl(element, 'save_pdf');
        $.post(handlerUrl, JSON.stringify(data)).done(function (response) {
            if (response.result === 'success') {
                runtime.notify('save', { state: 'end' });
            }
            else {
                runtime.notify('error', { msg: response.message });
            }
        });
    });
}