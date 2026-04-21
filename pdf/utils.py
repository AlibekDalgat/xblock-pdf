"""
Utility functions for PDF XBlock
"""
from django.template.defaultfilters import register
from django.conf import settings


def bool_from_str(str_value):
    """
    Converts string to boolean
    """
    return str_value.strip().lower() in [
        'true'
    ]


def is_all_download_disabled():
    """
    Check if all download is disabled or not
    """
    return getattr(settings, 'PDFXBLOCK_DISABLE_ALL_DOWNLOAD', False)


def _(text):
    """
    Dummy `gettext` replacement to make string extraction tools scrape strings marked for translation
    """
    return text


def ngettext_fallback(text_singular, text_plural, number):
    """
    Dummy `ngettext` replacement to make string extraction tools scrape strings marked for translation
    """
    if number == 1:
        return text_singular
    else:
        return text_plural

@register.filter
def get(dictionary, key):
    """Фильтр для получения значения из словаря по ключу"""
    return dictionary.get(key)

class DummyTranslationService(object):
    """
    Dummy drop-in replacement for i18n XBlock service
    """
    gettext = _
    ngettext = ngettext_fallback
