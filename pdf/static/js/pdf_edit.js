/* Javascript for pdfXBlock. */
function pdfXBlockInitEdit(runtime, element) {
    $(element).find('.action-cancel').bind('click', function () {
        runtime.notify('cancel', {});
    });

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
                    var baseUrl = window.location.origin;
                    baseUrl = baseUrl.replace(/\/\/studio\.([^\/]+)/, '//$1');
                    var fullUrl = new URL(response.asset.url, baseUrl).href;
                    $('#pdf_edit_url', element).val(fullUrl);
                    $dropzone.css('background-color', '#d4edda');
                    $dropzone.css('margin', '0');
                    $dropzoneText.text('Файл загружен! Перетащите новый или нажмите для выбора.');
                } else {
                    $dropzoneText.text('Не удалось загрузить файл: неизвестная ошибка');
                }
            },
            error: function(xhr, status, error) {
                $dropzone.css('background-color', '#f8d7da');
                $dropzoneText.text('Ошибка загрузки: ' + error);
            }
        });
    }

    const csrftoken = $.cookie('csrftoken');

    const FILE_TYPE_CONFIG = {
        excel: { extensions: ['.xlsx', '.xls', '.csv'], maxSize: 50*1024*1024, maxCount: 3, displayName: 'Таблицы (Excel)' },
        word:  { extensions: ['.docx', '.doc'],     maxSize: 50*1024*1024, maxCount: 3, displayName: 'Word-документы' },
        pptx:  { extensions: ['.pptx', '.ppt'],     maxSize: 50*1024*1024, maxCount: 3, displayName: 'Презентации' }
    };

    let uploadedHandouts = [];

    function formatSizeMB(sizeBytes) {
        const mb = sizeBytes / 1024 / 1024;
        return mb.toFixed(2).replace('.', ',');
    }

    function getFileType(filename) {
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        for (let type in FILE_TYPE_CONFIG) {
            if (FILE_TYPE_CONFIG[type].extensions.includes(ext)) {
                return type;
            }
        }
        return null;
    }

    function validateFile(file) {
        const type = getFileType(file.name);
        if (!type) {
            return { valid: false, error: `Неподдерживаемый формат: ${file.name}` };
        }

        const config = FILE_TYPE_CONFIG[type];

        if (file.size > config.maxSize) {
            return { valid: false, error: `Файл ${file.name} слишком большой (макс. ${config.maxSize/1024/1024} MB)` };
        }

        const currentCount = uploadedHandouts.filter(m => m.type === type).length;
        if (currentCount >= config.maxCount) {
            return { valid: false, error: `Максимум ${config.maxCount} файлов типа ${config.displayName}` };
        }

        return { valid: true, fileType: type };
    }

    function getCourseId() {
        const blockId = window.location.pathname.split('/')[2];
        const courseIdParts = blockId.split('+type@')[0].split(':');
        return 'course-v1:' + courseIdParts[1];
    }

    function uploadHandoutFile(file) {
        const validation = validateFile(file);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const courseId = getCourseId();

        $.ajax({
            url: '/assets/' + courseId + '/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: { 'X-CSRFToken': csrftoken },
            success: function(response) {
                if (response.asset && response.asset.url) {
                    const fullUrl = new URL(response.asset.url, window.location.origin).href;

                    $.ajax({
                        type: "POST",
                        url: runtime.handlerUrl(element, 'add_handout_file'),
                        headers: { "X-CSRFToken": csrftoken },
                        data: JSON.stringify({
                            file_name: file.name,
                            file_url: fullUrl,
                            file_size: file.size
                        }),
                        contentType: "application/json",
                        success: function(resp) {
                            if (resp.status === 'success') {
                                uploadedHandouts.push(resp.material);
                                addFileToUI(resp.material);
                            } else {
                                alert(resp.error || 'Ошибка сохранения');
                            }
                        }
                    });
                }
            },
            error: function() {
                alert('Ошибка загрузки файла в хранилище');
            }
        });
    }

    function addFileToUI(material) {
        const sizeStr = formatSizeMB(material.size);

        let $section = $(`#uploaded-handouts .file-type-section[data-file-type="${material.type}"]`, element);

        if ($section.length === 0) {
            const config = FILE_TYPE_CONFIG[material.type];
            const sectionHtml = `
                <div class="file-type-section" data-file-type="${material.type}" style="margin-top:15px;">
                    <h5 style="margin:8px 0 6px 0; color:#333;">${config ? config.displayName : material.type}</h5>
                    <div class="file-list"></div>
                </div>`;
            $('#uploaded-handouts', element).append(sectionHtml);
            $section = $(`#uploaded-handouts .file-type-section[data-file-type="${material.type}"]`, element);
        }

        const html = `
            <div class="handout-file-item"
                 data-file-name="${material.name}"
                 data-file-type="${material.type}"
                 style="padding:10px; margin:6px 0; background:#f8f9fa; border:1px solid #dee2e6; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${material.name}</strong>
                    <span style="color:#666; margin-left:10px;">(${sizeStr} MB)</span>
                </div>
                <button class="delete-handout-btn"
                        style="padding:5px 10px; background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer;">
                    Удалить
                </button>
            </div>`;

        $section.find('.file-list').append(html);
    }

    function deleteHandoutFile(fileName) {
        if (!confirm(`Удалить файл "${fileName}"?`)) return;

        $.ajax({
            type: "POST",
            url: runtime.handlerUrl(element, 'delete_handout_file'),
            headers: { "X-CSRFToken": csrftoken },
            data: JSON.stringify({ file_name: fileName }),
            contentType: "application/json",
            success: function(response) {
                if (response.status === 'success') {
                    $(`.handout-file-item[data-file-name="${fileName}"]`, element).remove();
                    uploadedHandouts = uploadedHandouts.filter(m => m.name !== fileName);
                } else {
                    alert(response.error || 'Ошибка удаления');
                }
            }
        });
    }

    function initExistingFiles() {
        uploadedHandouts = [];

        $('#uploaded-handouts .handout-file-item', element).each(function() {
            const $item = $(this);
            const fileName = $item.data('file-name');
            const fileType = $item.data('file-type') || getFileType(fileName);

            if (fileName) {
                uploadedHandouts.push({
                    name: fileName,
                    type: fileType
                });
            }
        });

        console.log('Загружено существующих файлов:', uploadedHandouts.length);
    }

    const $dropzone_handout = $('#handout_dropzone', element);

    $dropzone_handout.on('click', function(e) {
        e.preventDefault();
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = () => {
            Array.from(input.files).forEach(file => uploadHandoutFile(file));
        };
        input.click();
    });

    $dropzone_handout.on('dragover', e => { e.preventDefault(); $dropzone_handout.css('background-color', '#e6f3fa'); });
    $dropzone_handout.on('dragleave', e => { e.preventDefault(); $dropzone_handout.css('background-color', ''); });
    $dropzone_handout.on('drop', function(e) {
        e.preventDefault();
        $dropzone_handout.css('background-color', '');
        Array.from(e.originalEvent.dataTransfer.files).forEach(file => uploadHandoutFile(file));
    });

    $(element).on('click', '.delete-handout-btn', function() {
        const fileName = $(this).closest('.handout-file-item').data('file-name');
        deleteHandoutFile(fileName);
    });

    $(element).find('.action-save').on('click', function() {
        const data = {
            display_name: $('#pdf_edit_display_name', element).val(),
            url: $('#pdf_edit_url', element).val(),
            allow_download: $('#pdf_edit_allow_download', element).val() || 'True',
            source_text: $('#pdf_edit_source_text', element).val() || '',
            source_url: $('#pdf_edit_source_url', element).val() || '',
        };

        runtime.notify('save', { state: 'start' });

        $.post(runtime.handlerUrl(element, 'save_pdf'), JSON.stringify(data))
            .done(function(response) {
                if (response.result === 'success') {
                    runtime.notify('save', { state: 'end' });
                } else {
                    runtime.notify('error', { msg: 'Ошибка сохранения' });
                }
            });
    });

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

    initExistingFiles();
}