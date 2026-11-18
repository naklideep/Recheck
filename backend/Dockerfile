
# --------------------------------------------------
# RECHECK BACKEND - DOCKER CONFIGURATION
# --------------------------------------------------

FROM python:3.12-slim

# Python runtime settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

# --------------------------------------------------
# SYSTEM DEPENDENCIES
# --------------------------------------------------

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# --------------------------------------------------
# WORKING DIRECTORY
# --------------------------------------------------

WORKDIR /app

# --------------------------------------------------
# PYTHON DEPENDENCIES
# --------------------------------------------------

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# --------------------------------------------------
# APPLICATION FILES
# --------------------------------------------------

COPY . .

# --------------------------------------------------
# RUNTIME CONFIGURATION
# --------------------------------------------------

ENV TESSERACT_CMD=/usr/bin/tesseract
ENV CHROMA_DB_PATH=/tmp/chroma_db
ENV EMBEDDING_MODEL=all-MiniLM-L6-v2

# Render provides PORT dynamically
EXPOSE 8000

# --------------------------------------------------
# START FASTAPI
# --------------------------------------------------

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
