"""Pure-stdlib Supabase Auth Admin & PostgREST paginated client."""

from dataclasses import dataclass
import json
import os
import time
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_SUPABASE_URL = "https://hxyzvxueoqvvjyehfpym.supabase.co"
DEFAULT_PAGE_SIZE = 1000


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    service_role_key: str

    @classmethod
    def from_env(cls, env: Optional[Dict[str, str]] = None) -> "SupabaseConfig":
        src = env if env is not None else os.environ
        url = (src.get("SUPABASE_URL") or src.get("VITE_SUPABASE_URL") or DEFAULT_SUPABASE_URL).strip().rstrip("/")
        key = (src.get("SUPABASE_SERVICE_ROLE_KEY") or src.get("SUPABASE_SECRET_KEY") or "").strip()
        if not key:
            raise ValueError("Falta SUPABASE_SERVICE_ROLE_KEY para ejecutar respaldo de servidor.")
        return cls(url=url, service_role_key=key)


def _auth_headers(cfg: SupabaseConfig, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    headers: Dict[str, str] = {"apikey": cfg.service_role_key}
    if not cfg.service_role_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {cfg.service_role_key}"
    if extra:
        headers.update(extra)
    return headers


def _request_json(
    cfg: SupabaseConfig,
    method: str,
    full_url: str,
    payload: Any = None,
    extra_headers: Optional[Dict[str, str]] = None,
    timeout: int = 60,
    max_attempts: int = 4,
) -> Any:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = _auth_headers(cfg, extra_headers)
    if body is not None:
        headers.setdefault("Content-Type", "application/json")

    last_err: Optional[Exception] = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(full_url, data=body, headers=headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                if not raw:
                    return None
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as err:
            raw = err.read()
            if err.code in (429, 500, 502, 503, 504) and attempt < max_attempts - 1:
                last_err = err
                time.sleep(0.6 * (2 ** attempt))
                continue
            msg = raw.decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"Supabase {method} {full_url} ({err.code}): {msg}") from err
        except urllib.error.URLError as err:
            last_err = err
            if attempt < max_attempts - 1:
                time.sleep(0.6 * (2 ** attempt))
                continue
            raise RuntimeError(f"Error de red Supabase {method}: {err.reason}") from err
    raise RuntimeError(f"Supabase {method} falló tras reintentos: {last_err}")


def list_all_auth_users(cfg: SupabaseConfig, per_page: int = 1000) -> List[Dict[str, Any]]:
    users: List[Dict[str, Any]] = []
    for page in range(1, 500):
        url = f"{cfg.url}/auth/v1/admin/users?page={page}&per_page={per_page}"
        data = _request_json(cfg, "GET", url)
        batch = data if isinstance(data, list) else (data.get("users") or [] if isinstance(data, dict) else [])
        users.extend(batch)
        if len(batch) < per_page:
            break
    return users


def fetch_all_rows(
    cfg: SupabaseConfig,
    table: str,
    select: str = "*",
    order: Optional[str] = "id.asc",
    filters: Optional[List[tuple]] = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        params: List[tuple] = [("select", select), ("limit", str(page_size)), ("offset", str(offset))]
        if order:
            params.append(("order", order))
        if filters:
            params.extend(filters)
        query = urllib.parse.urlencode(params, safe=".,*():")
        url = f"{cfg.url}/rest/v1/{urllib.parse.quote(table)}?{query}"
        batch = _request_json(cfg, "GET", url) or []
        if not isinstance(batch, list):
            raise RuntimeError(f"Respuesta inesperada de {table}: {type(batch).__name__}")
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def fetch_rows_in(
    cfg: SupabaseConfig,
    table: str,
    column: str,
    values: List[Any],
    select: str = "*",
    order: Optional[str] = "id.asc",
    batch_size: int = 120,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> List[Dict[str, Any]]:
    clean_vals = [v for v in values if v is not None and str(v) != ""]
    if not clean_vals:
        return []
    out: List[Dict[str, Any]] = []
    for i in range(0, len(clean_vals), batch_size):
        chunk = clean_vals[i : i + batch_size]
        in_expr = "in.(" + ",".join(f'"{str(v)}"' if any(c in str(v) for c in ',()"') else str(v) for v in chunk) + ")"
        out.extend(
            fetch_all_rows(
                cfg,
                table,
                select=select,
                order=order,
                filters=[(column, in_expr)],
                page_size=page_size,
            )
        )
    return out


def upsert_rows(
    cfg: SupabaseConfig,
    table: str,
    rows: List[Dict[str, Any]],
    on_conflict: str = "id",
    batch_size: int = 200,
) -> int:
    if not rows:
        return 0
    total = 0
    query = urllib.parse.urlencode({"on_conflict": on_conflict}) if on_conflict else ""
    url = f"{cfg.url}/rest/v1/{urllib.parse.quote(table)}" + (f"?{query}" if query else "")
    headers = {"Prefer": "resolution=merge-duplicates,return=minimal"}
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        _request_json(cfg, "POST", url, payload=chunk, extra_headers=headers)
        total += len(chunk)
    return total
