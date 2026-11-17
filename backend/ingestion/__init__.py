"""RECHECK document and image ingestion package.""" 
from .pdf_processor import extract_pdf
from .image_processor import extract_image
from .text_processor import normalize_extracted_text

__all__ = [
    "extract_pdf",
    "extract_image",
    "normalize_extracted_text",
]
