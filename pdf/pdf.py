""" pdfXBlock main Python class"""
from datetime import datetime
import logging
import os
import traceback

import pkg_resources
import pymupdf as fitz
import requests
from django.template import Context, Template

from xblock.core import XBlock
from xblock.fields import Scope, String, List, Boolean
from xblock.fragment import Fragment
from xblockutils.resources import ResourceLoader
from .utils import _, bool_from_str, DummyTranslationService, is_all_download_disabled

loader = ResourceLoader(__name__)
log = logging.getLogger(__name__)

FILE_TYPE_CONFIG = {
    'excel': {
        'extensions': ['.xlsx', '.xls', '.csv'],
        'max_size_mb': 50,
        'max_count': 3,
        'display_name': 'Таблицы'
    },
    'word': {
        'extensions': ['.docx', '.doc'],
        'max_size_mb': 50,
        'max_count': 3,
        'display_name': 'Word-документы'
    },
    'pptx': {
        'extensions': ['.pptx', '.ppt'],
        'max_size_mb': 50,
        'max_count': 3,
        'display_name': 'Презентации'
    }
}

@XBlock.needs('i18n')
class PdfBlock(XBlock):

    '''
    Icon of the XBlock. Values : [other (default), video, problem]
    '''
    icon_class = "other"

    '''
    Fields
    '''
    display_name = String(
        display_name=_("Display Name"),
        default=_("PDF"),
        scope=Scope.settings,
        help=_("This name appears in the horizontal navigation at the top of the page.")
    )

    url = String(
        display_name=_("PDF URL"),
        default=_(""),
        scope=Scope.content,
        help=_("The URL for your PDF.")
    )

    allow_download = Boolean(
        display_name=_("PDF Download Allowed"),
        default=True,
        scope=Scope.content,
        help=_("Display a download button for this PDF.")
    )

    source_text = String(
        display_name=_("Source document button text"),
        default="",
        scope=Scope.content,
        help=_(
            "Add a download link for the source file of your PDF. "
             "Use it for example to provide the PowerPoint file used to create this PDF."
        )
    )

    source_url = String(
        display_name=_("Source document URL"),
        default="",
        scope=Scope.content,
        help=_(
            "Add a download link for the source file of your PDF. "
             "Use it for example to provide the PowerPoint file used to create this PDF."
        )
    )

    handout_materials = List(
        display_name="Раздаточные материалы",
        help="Список дополнительных материалов к PDF (таблицы, Word, презентации)",
        scope=Scope.settings,
        default=[]
    )

    '''
    Util functions
    '''
    def get_file_type(self, filename):
        ext = os.path.splitext(filename)[1].lower()
        for file_type, config in FILE_TYPE_CONFIG.items():
            if ext in config['extensions']:
                return file_type
        return None

    def validate_file(self, filename, size):
        if not filename:
            return None, "Имя файла отсутствует"

        file_type = self.get_file_type(filename)
        if not file_type:
            return None, f"Неподдерживаемый тип файла: {filename}"

        config = FILE_TYPE_CONFIG[file_type]
        max_size_bytes = config['max_size_mb'] * 1024 * 1024

        if size > max_size_bytes:
            return None, f"Файл {filename} превышает максимальный размер {config['max_size_mb']} MB"

        current_count = sum(1 for m in self.handout_materials if m.get('type') == file_type)
        if current_count >= config['max_count']:
            return None, f"Максимальное количество файлов типа {config['display_name']}: {config['max_count']}"

        return file_type, None

    def load_resource(self, resource_path):
        """
        Gets the content of a resource
        """
        resource_content = pkg_resources.resource_string(__name__, resource_path)
        return resource_content.decode("utf8")

    def render_template(self, template_path, context={}):
        """
        Evaluate a template by resource path, applying the provided context
        """
        template_str = self.load_resource(template_path)
        return Template(template_str).render(Context(context))

    '''
    Main functions
    '''
    def student_view(self, context=None):
        """
        The primary view of the XBlock, shown to students
        when viewing courses.
        """
        materials_by_type = {ft: [] for ft in FILE_TYPE_CONFIG.keys()}
        for m in self.handout_materials:
            if m.get('type') in materials_by_type:
                mat = m.copy()
                mat['size_mb'] = round(float(m.get('size', 0)) / (1024 * 1024), 2)
                materials_by_type[m['type']].append(mat)

        context = {
            'display_name': self.display_name,
            'url': self.url,
            'allow_download': self.allow_download,
            'disable_all_download': is_all_download_disabled(),
            'source_text': self.source_text,
            'source_url': self.source_url,
            'handout_materials': self.handout_materials,
            'materials_by_type': materials_by_type,
            'file_type_config': FILE_TYPE_CONFIG,
            'block_id': self.scope_ids.usage_id,
        }
        html = loader.render_django_template(
            'templates/html/pdf_view.html',
            context=context,
            i18n_service=self.i18n_service,
        )

        event_type = 'edx.pdf.loaded'
        event_data = {
            'url': self.url,
            'source_url': self.source_url,
        }
        self.runtime.publish(self, event_type, event_data)
        frag = Fragment(html)
        frag.add_javascript(self.load_resource("static/js/pdf_view.js"))
        frag.initialize_js('pdfXBlockInitView')
        return frag

    def studio_view(self, context=None):
        """
        The secondary view of the XBlock, shown to teachers
        when editing the XBlock.
        """
        materials_by_type = {ft: [] for ft in FILE_TYPE_CONFIG.keys()}
        for material in self.handout_materials:
            file_type = material.get('type')
            if file_type in materials_by_type:
                mat = material.copy()
                mat['size_mb'] = round(float(material.get('size', 0)) / (1024 * 1024), 2)
                materials_by_type[file_type].append(mat)

        context = {
            'display_name': self.display_name,
            'url': self.url,
            'allow_download': self.allow_download,
            'source_text': self.source_text,
            'source_url': self.source_url,
            'handout_materials': self.handout_materials,
            'materials_by_type': materials_by_type,
            'file_type_config': FILE_TYPE_CONFIG,
            'block_id': self.scope_ids.usage_id,
        }
        html = loader.render_django_template(
            'templates/html/pdf_edit.html',
            context=context,
            i18n_service=self.i18n_service,
        )
        frag = Fragment(html)
        frag.add_javascript(self.load_resource("static/js/pdf_edit.js"))
        frag.initialize_js('pdfXBlockInitEdit')
        return frag

    @XBlock.json_handler
    def on_download(self, data, suffix=''):
        """
        The download file event handler
        """
        event_type = 'edx.pdf.downloaded'
        event_data = {
            'url': self.url,
            'source_url': self.source_url,
        }
        self.runtime.publish(self, event_type, event_data)

    @XBlock.json_handler
    def add_handout_file(self, data, suffix=''):
        """Добавление раздаточного материала"""
        file_name = data.get('file_name')
        file_url = data.get('file_url')
        file_size = data.get('file_size', 0)

        if not file_name or not file_url:
            return {'status': 'fail', 'error': 'Отсутствуют данные файла'}

        file_type, error = self.validate_file(file_name, file_size)

        if error:
            return {'status': 'fail', 'error': error}

        material = {
            'type': file_type,
            'name': file_name,
            'url': file_url,
            'size': file_size,
            'uploaded_at': datetime.utcnow().isoformat()
        }

        if not hasattr(self, 'handout_materials'):
            self.handout_materials = []

        self.handout_materials.append(material)

        return {
            'status': 'success',
            'material': material
        }

    @XBlock.json_handler
    def delete_handout_file(self, data, suffix=''):
        file_name = data.get('file_name')
        if not file_name:
            return {'status': 'fail', 'error': 'Не указано имя файла'}

        self.handout_materials = [m for m in self.handout_materials if m.get('name') != file_name]
        return {'status': 'success'}

    @XBlock.json_handler
    def save_pdf(self, data, suffix=''):
        """
        The saving handler.
        """
        self.display_name = data['display_name']
        self.url = data['url']

        if not is_all_download_disabled():
            self.allow_download = bool_from_str(data['allow_download'])
            self.source_text = data['source_text']
            self.source_url = data['source_url']

        if 'handout_materials' in data:
            self.handout_materials = data['handout_materials']

        return {
            'result': 'success',
        }

    @property
    def i18n_service(self):
        """ Obtains translation service """
        i18n_service = self.runtime.service(self, "i18n")
        if i18n_service:
            return i18n_service
        else:
            return DummyTranslationService()

    @XBlock.json_handler
    def get_svg_pages(self, data, suffix=''):
        if not self.url:
            log.error("Нет URL PDF в блоке")
            return {'error': 'Нет URL PDF в блоке'}

        try:
            resp = requests.get(self.url, timeout=15, headers={'User-Agent': 'Open edX XBlock'})
            resp.raise_for_status()
            pdf_bytes = resp.content

            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            first_page = doc[0]
            rect = first_page.rect
            page_width = rect.width
            page_height = rect.height

            target_width = 800
            zoom = target_width / page_width if page_width > 0 else 2.0
            zoom = max(0.5, min(3.0, zoom))

            svg_pages = []
            matrix = fitz.Matrix(zoom, zoom)

            for i in range(len(doc)):
                page = doc.load_page(i)
                svg = page.get_svg_image(matrix=matrix)
                svg_pages.append(svg)

            doc.close()

            return {
                'success': True,
                'pages': svg_pages,
                'total': len(svg_pages)
            }

        except Exception as e:
            error_msg = str(e)
            tb = traceback.format_exc()
            log.error("КРИТИЧЕСКАЯ ОШИБКА в get_svg_pages:\n%s\n%s", error_msg, tb)
            return {
                'error': error_msg,
                'traceback': tb[:1000]
            }

