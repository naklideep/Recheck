
"""PDF text extraction with stable page references."""

from typing import Any

import fitz  # PyMuPDF

from .text_processor import normalize_extracted_text


MAX_PDF_PAGES = 200


def extract_pdf(file_bytes: bytes) -> dict[str, Any]:
    """Extract text page-by-page. Page numbers are 1-based."""

    if not file_bytes:
        raise ValueError("The uploaded PDF is empty.")

    try:
        document = fitz.open(
            stream=file_bytes,
            filetype="pdf"
        )
    except Exception as exc:
        raise ValueError(
            "The file is not a valid readable PDF."
        ) from exc

    try:
        if document.is_encrypted:
            raise ValueError(
                "Password-protected PDFs are not supported yet."
            )

        if document.page_count == 0:
            raise ValueError("The PDF contains no pages.")

        if document.page_count > MAX_PDF_PAGES:
            raise ValueError(
                f"PDFs are limited to {MAX_PDF_PAGES} pages."
            )

        pages = []

        for index, page in enumerate(document):
            page_text = normalize_extracted_text(
                page.get_text("text")
            )

            if page_text:
                pages.append({
                    "page": index + 1,
                    "text": page_text,
                    "source": f"PDF page {index + 1}",
                })

        combined = "\n\n".join(
            f"[PDF page {item['page']}]\n{item['text']}"
            for item in pages
        )

        combined = normalize_extracted_text(combined)

        return {
            "text": combined,
            "pages": pages,
            "page_count": document.page_count,
            "pages_with_text": len(pages),
            "needs_ocr": not bool(combined),
        }

    finally:
        document.close()
