"""Authenticated upload auditing routes for RECHECK.

Register these routes from main.py after the existing helpers and run_audit()
function have been defined:

    from routes.uploads import register_upload_routes
    register_upload_routes(
        app=app,
        db=db,
        me=me,
        need=need,
        run_audit=run_audit,
        uid=uid,
        now=now,
        log=log,
    )

This module intentionally reuses the existing audit engine and MongoDB schema.
"""

from typing import Any, Callable

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ingestion.pdf_processor import extract_pdf
from ingestion.image_processor import extract_image


MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/octet-stream",  # Some browsers send this for local files.
}


def _page_for_span(span: str, pages: list[dict[str, Any]]) -> int | None:
    """Return the first PDF page containing a finding's exact span."""
    if not span:
        return None
    for page in pages:
        if span.casefold() in page.get("text", "").casefold():
            return page.get("page")
    return None


def register_upload_routes(
    *,
    app: Any,
    db: Any,
    me: Callable,
    need: Callable,
    run_audit: Callable,
    uid: Callable,
    now: Callable,
    log: Callable,
) -> None:
    """Attach upload routes to the existing FastAPI app."""

    router = APIRouter(prefix="/uploads", tags=["uploads"])

    @router.post("/audit")
    async def audit_uploaded_file(
        file: UploadFile = File(...),
        title: str = Form(""),
        u=Depends(need("creator", "brand_manager", "admin")),
    ):
        filename = (file.filename or "upload").strip()
        suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail="Unsupported file type. Upload PDF, PNG, JPG, JPEG or WEBP.",
            )

        content_type = (file.content_type or "").lower()
        if content_type and content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=415,
                detail="The uploaded file's content type is not supported.",
            )

        raw = await file.read(MAX_UPLOAD_BYTES + 1)
        await file.close()

        if not raw:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Files must be 15 MB or smaller.",
            )

        source_type = ALLOWED_EXTENSIONS[suffix]

        try:
            if source_type == "pdf":
                extracted = extract_pdf(raw)
                if extracted["needs_ocr"]:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            "No selectable text was found in this PDF. "
                            "Scanned-PDF OCR is not enabled yet."
                        ),
                    )
                audit_text = extracted["text"]
                pages = extracted["pages"]
                extraction_summary = {
                    "pageCount": extracted["page_count"],
                    "pagesWithText": extracted["pages_with_text"],
                    "ocrUsed": False,
                }
            else:
                extracted = extract_image(raw, filename=filename)
                audit_text = extracted["text"]
                pages = []
                extraction_summary = {
                    "width": extracted["width"],
                    "height": extracted["height"],
                    "ocrFoundText": extracted["ocr_found_text"],
                }

        except HTTPException:
            raise
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        if not audit_text.strip():
            raise HTTPException(
                status_code=422,
                detail=(
                    "No readable text was extracted from this file. "
                    "Image OCR did not find text; visual brand analysis is not "
                    "enabled in this ingestion version."
                ),
            )

        safe_title = title.strip() or filename
        content_id = uid()
        version_id = uid()

        # Reuse the exact existing audit pipeline; do not duplicate its logic.
        findings, ai_note = await run_audit(audit_text)

        # Preserve the existing content/version/findings document structure.
        version_doc = {
            "_id": version_id,
            "contentId": content_id,
            "number": 1,
            "body": audit_text,
            "createdBy": u["sub"],
            "createdAt": now(),
            "aiNote": ai_note,
            "sourceType": source_type,
            "originalFilename": filename,
            "extraction": extraction_summary,
            "sourcePages": pages if source_type == "pdf" else [],
        }

        finding_docs = []
        for finding in findings:
            finding_doc = {
                **finding,
                "_id": uid(),
                "versionId": version_id,
                "contentId": content_id,
                "status": "open",
            }
            if source_type == "pdf":
                page_number = _page_for_span(finding.get("span", ""), pages)
                if page_number is not None:
                    finding_doc["sourceLocation"] = {
                        "type": "pdf_page",
                        "page": page_number,
                    }
            else:
                finding_doc["sourceLocation"] = {
                    "type": "image",
                    "filename": filename,
                }
            finding_docs.append(finding_doc)

        await db.versions.insert_one(version_doc)

        if finding_docs:
            await db.findings.insert_many(finding_docs)

        await db.content.insert_one({
            "_id": content_id,
            "title": safe_title,
            "status": "audited",
            "currentVersionId": version_id,
            "versionCount": 1,
            "createdBy": u["sub"],
            "createdByName": u["name"],
            "createdAt": now(),
            "sourceType": source_type,
            "originalFilename": filename,
        })

        await log(u, "content.upload_audit", content_id)

        return {
            "id": content_id,
            "title": safe_title,
            "sourceType": source_type,
            "filename": filename,
            "extraction": extraction_summary,
            "findingsCount": len(finding_docs),
            "aiNote": ai_note,
            "status": "audited",
        }

    app.include_router(router)
