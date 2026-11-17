"""Shared text normalization utilities for RECHECK.""" 

import re


def normalize_extracted_text(text: str) -> str:
    """
    Normalize extracted text while preserving meaningful
    punctuation, numbers and paragraph boundaries.
    """

    if not isinstance(text, str):
        return ""

    # Remove null characters
    text = text.replace("\x00", " ")

    # Normalize Windows and Mac line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove excessive spaces and tabs
    text = re.sub(r"[ \t]+", " ", text)

    # Limit excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
