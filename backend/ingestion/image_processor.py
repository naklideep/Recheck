
"""OCR extraction for RECHECK marketing creatives."""

import os
from io import BytesIO
from typing import Any

import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError

from .text_processor import normalize_extracted_text


# --------------------------------------------------
# TESSERACT OCR CONFIGURATION
# --------------------------------------------------

# Windows local development:
# C:\Program Files\Tesseract-OCR\tesseract.exe
#
# Render Linux deployment:
# /usr/bin/tesseract
#
# If TESSERACT_CMD is not provided, pytesseract
# will use the system PATH.

TESSERACT_CMD = os.getenv("TESSERACT_CMD")

if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


# --------------------------------------------------
# IMAGE CONFIGURATION
# --------------------------------------------------

MAX_IMAGE_PIXELS = 30_000_000

SUPPORTED_IMAGE_FORMATS = {
    "PNG",
    "JPEG",
    "WEBP",
}


# --------------------------------------------------
# IMAGE OCR EXTRACTION
# --------------------------------------------------

def extract_image(
    file_bytes: bytes,
    filename: str = "uploaded-image"
) -> dict[str, Any]:

    if not file_bytes:
        raise ValueError("The uploaded image is empty.")

    try:
        image = Image.open(BytesIO(file_bytes))
        image.load()

    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError(
            "The uploaded file is not a valid image."
        ) from exc

    if image.format not in SUPPORTED_IMAGE_FORMATS:
        raise ValueError(
            "Supported formats are PNG, JPG, JPEG and WEBP."
        )

    width, height = image.size

    if width * height > MAX_IMAGE_PIXELS:
        raise ValueError(
            "Image dimensions are too large."
        )

    image = ImageOps.exif_transpose(image).convert("RGB")

    try:
        extracted_text = pytesseract.image_to_string(
            image,
            config="--psm 6"
        )

    except pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract OCR is not installed or unavailable."
        ) from exc

    except Exception as exc:
        raise RuntimeError(
            "Image OCR processing failed."
        ) from exc

    extracted_text = normalize_extracted_text(
        extracted_text
    )

    return {
        "text": extracted_text,
        "filename": filename,
        "width": width,
        "height": height,
        "ocr_found_text": bool(extracted_text),
    }
