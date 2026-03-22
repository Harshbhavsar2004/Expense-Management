"""
Embedding Service — generates 768-dim text embeddings via Gemini
and writes them back to Supabase for semantic search / similarity.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Optional

import requests
from google import genai

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_EMBED_MODEL = "gemini-embedding-2-preview"


def _genai_client() -> genai.Client:
    return genai.Client(api_key=os.getenv("GOOGLE_API_KEY", ""))


def _supabase_url() -> str:
    return os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")


def _supabase_headers() -> dict:
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


# ---------------------------------------------------------------------------
# Debug helper — prints a clearly visible block
# ---------------------------------------------------------------------------

def _debug(section: str, **kwargs) -> None:
    print(f"\n{'='*60}")
    print(f"[EmbeddingService] DEBUG — {section}")
    for k, v in kwargs.items():
        val_str = str(v)
        # Truncate very long values (e.g. full vectors)
        if len(val_str) > 300:
            val_str = val_str[:300] + f"... (truncated, total len={len(val_str)})"
        print(f"  {k}: {val_str}")
    print(f"{'='*60}\n")


def _check_env() -> None:
    """Print environment variable status — call once at startup."""
    google_key = os.getenv("GOOGLE_API_KEY", "")
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

    _debug(
        "Environment variables",
        GOOGLE_API_KEY=f"{'SET (' + str(len(google_key)) + ' chars)' if google_key else 'MISSING !!!'}",
        NEXT_PUBLIC_SUPABASE_URL=f"{'SET → ' + supabase_url if supabase_url else 'MISSING !!!'}",
        NEXT_PUBLIC_SUPABASE_ANON_KEY=f"{'SET (' + str(len(supabase_key)) + ' chars)' if supabase_key else 'MISSING !!!'}",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_embedding(text: str) -> Optional[list[float]]:
    if not text or not text.strip():
        return None

    from google.genai import types as genai_types
    import numpy as np

    client = _genai_client()
    last_err: Exception | None = None

    for attempt in range(3):
        try:
            response = client.models.embed_content(
                model=_EMBED_MODEL,
                contents=text,
                config=genai_types.EmbedContentConfig(
                    output_dimensionality=768,
                    task_type="RETRIEVAL_DOCUMENT",
                ),
            )
            values = response.embeddings[0].values

            # Normalize since we're using non-3072 dimensions (per docs)
            arr = np.array(values)
            normed = arr / np.linalg.norm(arr)
            return normed.tolist()

        except Exception as exc:
            last_err = exc
            if attempt < 2:
                time.sleep(1)

    print(f"[EmbeddingService] generate_embedding failed after 3 attempts: {last_err}")
    return None


def generate_query_embedding(text: str) -> Optional[list[float]]:
    """Use RETRIEVAL_QUERY task type for search queries (not documents)."""
    if not text or not text.strip():
        return None

    from google.genai import types as genai_types
    import numpy as np

    client = _genai_client()
    last_err: Exception | None = None

    for attempt in range(3):
        try:
            response = client.models.embed_content(
                model=_EMBED_MODEL,
                contents=text,
                config=genai_types.EmbedContentConfig(
                    output_dimensionality=768,
                    task_type="RETRIEVAL_QUERY",
                ),
            )
            arr = np.array(response.embeddings[0].values)
            return (arr / np.linalg.norm(arr)).tolist()
        except Exception as exc:
            last_err = exc
            if attempt < 2:
                time.sleep(1)

    print(f"[EmbeddingService] generate_query_embedding failed: {last_err}")
    return None


def build_expense_embedding_text(expense: dict) -> str:
    """Concatenate key expense fields into a single string for embedding."""
    parts: list[str] = []

    def _add(value) -> None:
        if value is None:
            return
        if isinstance(value, list):
            joined = " ".join(str(v) for v in value if v)
            if joined:
                parts.append(joined)
        else:
            s = str(value).strip()
            if s:
                parts.append(s)

    _add(expense.get("expense_type"))
    _add(expense.get("audit_explanation"))

    timeline = expense.get("audit_timeline")
    if isinstance(timeline, list):
        _add(timeline)
    elif timeline:
        _add(timeline)

    mismatches = expense.get("mismatches")
    if isinstance(mismatches, list):
        _add(mismatches)
    elif mismatches:
        _add(mismatches)

    _add(expense.get("city"))
    _add(expense.get("city_tier"))
    _add(expense.get("client_name"))

    names = expense.get("participant_names")
    if isinstance(names, list):
        _add(names)
    elif names:
        _add(names)

    result = " ".join(parts)

    _debug(
        "build_expense_embedding_text",
        expense_id=expense.get("id", "unknown"),
        expense_type=expense.get("expense_type"),
        has_audit_explanation=bool(expense.get("audit_explanation")),
        has_mismatches=bool(expense.get("mismatches")),
        output_length=len(result),
        output_preview=result[:120],
    )
    return result


def build_receipt_embedding_text(receipt: dict) -> str:
    """Concatenate key receipt fields into a single string for embedding."""
    parts: list[str] = []

    for field in ("raw_description", "merchant", "payment_method", "status"):
        value = receipt.get(field)
        if value and str(value).strip():
            parts.append(str(value).strip())

    result = " ".join(parts)
    _debug(
        "build_receipt_embedding_text",
        receipt_id=receipt.get("id", "unknown"),
        output_length=len(result),
        output_preview=result[:120],
    )
    return result


# ---------------------------------------------------------------------------
# Bulk back-fill
# ---------------------------------------------------------------------------

async def embed_all_existing_expenses() -> int:
    """
    Fetch every expense where *embedding* IS NULL, generate embeddings,
    and PATCH them back. Returns the count of rows successfully embedded.
    """
    _check_env()

    base = _supabase_url()
    headers = _supabase_headers()

    _debug("embed_all_existing_expenses — START", supabase_url=base)

    # ── 1. Fetch expenses without an embedding ──────────────────────────────
    _debug("embed_all_existing_expenses — fetching NULL-embedding rows")
    try:
        resp = requests.get(
            f"{base}/rest/v1/expenses",
            headers={**headers, "Prefer": "return=representation"},
            params={
                "select": "id,expense_type,audit_explanation,audit_timeline,"
                          "mismatches,city,city_tier,client_name,participant_names",
                "embedding": "is.null",
            },
            timeout=30,
        )
        _debug(
            "embed_all_existing_expenses — fetch response",
            status_code=resp.status_code,
            response_length=len(resp.text),
        )
        resp.raise_for_status()
    except requests.HTTPError as exc:
        _debug(
            "embed_all_existing_expenses — FETCH FAILED (HTTP error)",
            status_code=exc.response.status_code if exc.response else "N/A",
            response_body=exc.response.text[:500] if exc.response else "N/A",
            hint="Check Supabase URL and anon key. Also confirm the embedding column exists.",
        )
        return 0
    except Exception as exc:
        _debug(
            "embed_all_existing_expenses — FETCH FAILED (network error)",
            error_type=type(exc).__name__,
            error=str(exc),
        )
        return 0

    expenses: list[dict] = resp.json()
    total = len(expenses)
    _debug("embed_all_existing_expenses — rows to process", total=total)

    if total == 0:
        print("[EmbeddingService] No expenses need embedding — all already done.")
        return 0

    embedded = 0
    failed = 0

    for idx, expense in enumerate(expenses, start=1):
        expense_id = expense.get("id", "unknown")

        # ── 2. Build text ───────────────────────────────────────────────────
        text = build_expense_embedding_text(expense)

        if not text.strip():
            _debug(
                f"embed_all_existing_expenses — row {idx}/{total} SKIPPED",
                expense_id=expense_id,
                reason="Empty embedding text — no useful fields found",
            )
            failed += 1
            continue

        # ── 3. Generate embedding ───────────────────────────────────────────
        vector = generate_embedding(text)

        if vector is None:
            _debug(
                f"embed_all_existing_expenses — row {idx}/{total} EMBEDDING FAILED",
                expense_id=expense_id,
            )
            failed += 1
            continue

        # ── 4. PATCH back to Supabase ───────────────────────────────────────
        try:
            patch = requests.patch(
                f"{base}/rest/v1/expenses",
                headers=headers,
                params={"id": f"eq.{expense_id}"},
                json={"embedding": vector},
                timeout=15,
            )
            if patch.ok:
                embedded += 1
                if idx <= 3 or idx % 10 == 0:   # show first 3 + every 10th
                    _debug(
                        f"embed_all_existing_expenses — row {idx}/{total} OK",
                        expense_id=expense_id,
                        http_status=patch.status_code,
                    )
            else:
                failed += 1
                _debug(
                    f"embed_all_existing_expenses — row {idx}/{total} PATCH FAILED",
                    expense_id=expense_id,
                    http_status=patch.status_code,
                    response=patch.text[:300],
                    hint="403 = RLS blocking write. Use SERVICE_ROLE_KEY instead of ANON_KEY for the agent.",
                )
        except Exception as exc:
            failed += 1
            _debug(
                f"embed_all_existing_expenses — row {idx}/{total} PATCH EXCEPTION",
                expense_id=expense_id,
                error=str(exc),
            )

        if idx % 10 == 0:
            print(f"[EmbeddingService] Progress: {idx}/{total} processed "
                  f"({embedded} ok, {failed} failed)")

        await asyncio.sleep(0.1)

    _debug(
        "embed_all_existing_expenses — COMPLETE",
        total=total,
        embedded=embedded,
        failed=failed,
    )
    return embedded


# ---------------------------------------------------------------------------
# Bulk back-fill — receipts
# ---------------------------------------------------------------------------

async def embed_all_existing_receipts() -> int:
    """
    Fetch every receipt where *embedding* IS NULL, generate embeddings,
    and PATCH them back. Returns count of rows successfully embedded.
    """
    base = _supabase_url()
    headers = _supabase_headers()

    resp = requests.get(
        f"{base}/rest/v1/receipts",
        headers={**headers, "Prefer": "return=representation"},
        params={
            "select": "id,raw_description,merchant,payment_method,status",
            "embedding": "is.null",
        },
        timeout=30,
    )
    resp.raise_for_status()
    receipts: list[dict] = resp.json()

    total = len(receipts)
    embedded = 0

    print(f"[EmbeddingService] Receipts to embed: {total}")

    if total == 0:
        print("[EmbeddingService] No receipts need embedding.")
        return 0

    for idx, receipt in enumerate(receipts, start=1):
        text = build_receipt_embedding_text(receipt)

        if not text.strip():
            print(f"[EmbeddingService] Receipt {receipt['id']} — skipped (no text)")
            continue

        vector = generate_embedding(text)

        if vector is not None:
            patch = requests.patch(
                f"{base}/rest/v1/receipts",
                headers=headers,
                params={"id": f"eq.{receipt['id']}"},
                json={"embedding": vector},
                timeout=15,
            )
            if patch.ok:
                embedded += 1
            else:
                print(f"[EmbeddingService] Receipt PATCH failed "
                      f"{receipt['id']}: {patch.status_code} {patch.text[:200]}")

        if idx % 10 == 0:
            print(f"[EmbeddingService] Receipts: {idx}/{total} ({embedded} ok)")

        await asyncio.sleep(0.1)

    print(f"[EmbeddingService] Receipts done — {embedded}/{total} embedded.")
    return embedded


# ---------------------------------------------------------------------------
# Post-audit hook
# ---------------------------------------------------------------------------

def embed_expense_after_audit(expense_id: str) -> bool:
    """
    Fetch a single expense by ID, generate its embedding, and persist it.
    Returns True on success, False on any failure. Never raises.
    """
    _debug("embed_expense_after_audit — START", expense_id=expense_id)

    try:
        base = _supabase_url()
        headers = _supabase_headers()

        # ── 1. Fetch the expense ────────────────────────────────────────────
        resp = requests.get(
            f"{base}/rest/v1/expenses",
            headers={**headers, "Prefer": "return=representation"},
            params={
                "select": "id,expense_type,audit_explanation,audit_timeline,"
                          "mismatches,city,city_tier,client_name,participant_names",
                "id": f"eq.{expense_id}",
                "limit": "1",
            },
            timeout=15,
        )
        _debug(
            "embed_expense_after_audit — fetch response",
            expense_id=expense_id,
            status_code=resp.status_code,
        )

        if not resp.ok:
            _debug(
                "embed_expense_after_audit — FETCH FAILED",
                expense_id=expense_id,
                status_code=resp.status_code,
                response=resp.text[:300],
            )
            return False

        rows = resp.json()
        if not rows:
            _debug(
                "embed_expense_after_audit — NOT FOUND",
                expense_id=expense_id,
                hint="The expense ID doesn't exist or RLS is hiding it",
            )
            return False

        # ── 2. Build text + embed ───────────────────────────────────────────
        text = build_expense_embedding_text(rows[0])

        if not text.strip():
            _debug(
                "embed_expense_after_audit — SKIPPED",
                expense_id=expense_id,
                reason="Empty text — expense has no embeddable fields yet",
            )
            return False

        vector = generate_embedding(text)
        if vector is None:
            _debug(
                "embed_expense_after_audit — EMBEDDING FAILED",
                expense_id=expense_id,
            )
            return False

        # ── 3. PATCH back ───────────────────────────────────────────────────
        patch = requests.patch(
            f"{base}/rest/v1/expenses",
            headers=headers,
            params={"id": f"eq.{expense_id}"},
            json={"embedding": vector},
            timeout=15,
        )

        _debug(
            "embed_expense_after_audit — PATCH result",
            expense_id=expense_id,
            http_status=patch.status_code,
            ok=patch.ok,
            response=patch.text[:200] if not patch.ok else "(empty = success)",
        )

        if patch.ok:
            print(f"[EmbeddingService] Embedded expense {expense_id} ✓")
            return True

        _debug(
            "embed_expense_after_audit — PATCH FAILED",
            expense_id=expense_id,
            hint="403 = RLS blocking. Use SERVICE_ROLE_KEY. 400 = vector dimension mismatch.",
        )
        return False

    except Exception as exc:
        _debug(
            "embed_expense_after_audit — EXCEPTION",
            expense_id=expense_id,
            error_type=type(exc).__name__,
            error=str(exc),
        )
        return False


# ---------------------------------------------------------------------------
# Post-save hook — receipt
# ---------------------------------------------------------------------------

def embed_receipt_after_save(receipt_id: str) -> bool:
    """
    Fetch a single receipt by ID, generate its embedding, and persist it.
    Returns True on success, False on any failure. Never raises.
    """
    try:
        base = _supabase_url()
        headers = _supabase_headers()

        resp = requests.get(
            f"{base}/rest/v1/receipts",
            headers={**headers, "Prefer": "return=representation"},
            params={
                "select": "id,raw_description,merchant,payment_method,status",
                "id": f"eq.{receipt_id}",
                "limit": "1",
            },
            timeout=15,
        )

        if not resp.ok:
            print(f"[EmbeddingService] embed_receipt_after_save fetch failed "
                  f"{receipt_id}: {resp.status_code}")
            return False

        rows = resp.json()
        if not rows:
            print(f"[EmbeddingService] embed_receipt_after_save: receipt {receipt_id} not found")
            return False

        text = build_receipt_embedding_text(rows[0])
        if not text.strip():
            print(f"[EmbeddingService] embed_receipt_after_save: receipt {receipt_id} has no embeddable text")
            return False

        vector = generate_embedding(text)
        if vector is None:
            print(f"[EmbeddingService] embed_receipt_after_save: embedding failed for {receipt_id}")
            return False

        patch = requests.patch(
            f"{base}/rest/v1/receipts",
            headers=headers,
            params={"id": f"eq.{receipt_id}"},
            json={"embedding": vector},
            timeout=15,
        )

        if patch.ok:
            print(f"[EmbeddingService] Embedded receipt {receipt_id} ✓")
            return True

        print(f"[EmbeddingService] embed_receipt_after_save PATCH failed "
              f"{receipt_id}: {patch.status_code} {patch.text[:200]}")
        return False

    except Exception as exc:
        print(f"[EmbeddingService] embed_receipt_after_save exception for {receipt_id}: {exc}")
        return False


# ---------------------------------------------------------------------------
# Quick standalone test — run: python embedding_service.py
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Running embedding_service self-test...\n")

    _check_env()

    # Test 1: generate a single embedding
    print("TEST 1: generate_embedding with sample text")
    vec = generate_embedding("Travel expense for Redbus ticket Mumbai to Pune")
    if vec:
        print(f"  PASS — got {len(vec)}-dim vector, first value: {vec[0]:.6f}")
    else:
        print("  FAIL — returned None")

    # Test 2: empty text
    print("\nTEST 2: generate_embedding with empty text")
    vec2 = generate_embedding("")
    if vec2 is None:
        print("  PASS — correctly returned None for empty text")
    else:
        print(f"  UNEXPECTED — returned a vector for empty text: {vec2[:3]}")

    # Test 3: build embedding text from a fake expense
    print("\nTEST 3: build_expense_embedding_text")
    fake_expense = {
        "id": "test-123",
        "expense_type": "Dinner",
        "audit_explanation": "All checks passed. The expense claim is verified.",
        "mismatches": [],
        "city": "Mumbai",
        "city_tier": "Tier - I",
        "client_name": "ABC Client",
        "participant_names": ["Dev"],
    }
    text = build_expense_embedding_text(fake_expense)
    if text:
        print(f"  PASS — built text ({len(text)} chars): {text[:100]}")
    else:
        print("  FAIL — returned empty string")

    # Test 4: Supabase connectivity
    print("\nTEST 4: Supabase connectivity")
    try:
        r = requests.get(
            f"{_supabase_url()}/rest/v1/expenses",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            params={"select": "id", "limit": "1"},
            timeout=10,
        )
        if r.ok:
            print(f"  PASS — Supabase reachable, status {r.status_code}")
        else:
            print(f"  FAIL — status {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"  FAIL — {e}")

    print("\nSelf-test complete.")