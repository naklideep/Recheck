
"""OCR extraction for RECHECK marketing creatives."""

from io import BytesIO
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError
import pytesseract

from .text_processor import normalize_extracted_text


# Configure Windows Tesseract OCR
pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

MAX_IMAGE_PIXELS = 30_000_000

SUPPORTED_IMAGE_FORMATS = {
    "PNG",
    "JPEG",
    "WEBP",
}


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
        raise ValueError("Image dimensions are too large.")

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
        raise RuntimeError("Image OCR processing failed.") from exc

    extracted_text = normalize_extracted_text(extracted_text)

    return {
        "text": extracted_text,
        "filename": filename,
        "width": width,
        "height": height,
        "ocr_found_text": bool(extracted_text),
    }
