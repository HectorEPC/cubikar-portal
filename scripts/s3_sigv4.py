"""Pure-stdlib AWS S3 Signature Version 4 client for Cubikar server backups."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
import os
import re
import time
from typing import Dict, List, Optional, Tuple
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


BACKUP_ROOT_PREFIX = "_respaldos_servidor"


def rfc3986_encode(value: str) -> str:
    return urllib.parse.quote(str(value), safe="-._~")


def encode_s3_key(key: str) -> str:
    clean = str(key or "").lstrip("/")
    return "/".join(rfc3986_encode(seg) for seg in clean.split("/") if seg != "")


def user_backup_slug(email: str) -> str:
    """Return a deterministic, collision-free S3 folder slug for a user email."""
    clean = str(email or "").strip().lower()
    digest = hashlib.sha256(clean.encode("utf-8")).hexdigest()[:8]
    readable = re.sub(r"[^a-z0-9._-]+", "-", clean.replace("@", "_at_"))
    readable = re.sub(r"-{2,}", "-", readable).strip(".-")[:64] or "usuario"
    return f"{readable}__{digest}"


@dataclass(frozen=True)
class S3Config:
    bucket: str
    region: str
    access_key_id: str
    secret_access_key: str
    session_token: str = ""
    custom_endpoint: str = ""
    server_side_encryption: str = "AES256"

    @classmethod
    def from_env(cls, env: Optional[Dict[str, str]] = None) -> "S3Config":
        src = env if env is not None else os.environ
        bucket = (src.get("AWS_S3_BUCKET") or "").strip()
        region = (src.get("AWS_REGION") or src.get("AWS_DEFAULT_REGION") or "us-east-1").strip()
        access_key = (src.get("AWS_ACCESS_KEY_ID") or "").strip()
        secret_key = (src.get("AWS_SECRET_ACCESS_KEY") or "").strip()
        session_token = (src.get("AWS_SESSION_TOKEN") or "").strip()
        custom_endpoint = (src.get("AWS_S3_ENDPOINT") or "").strip().rstrip("/")
        sse = (src.get("AWS_S3_SSE") or "AES256").strip()
        missing = [
            name
            for name, val in (
                ("AWS_S3_BUCKET", bucket),
                ("AWS_REGION", region),
                ("AWS_ACCESS_KEY_ID", access_key),
                ("AWS_SECRET_ACCESS_KEY", secret_key),
            )
            if not val
        ]
        if missing:
            raise ValueError(f"Faltan variables AWS S3 requeridas: {', '.join(missing)}")
        return cls(
            bucket=bucket,
            region=region,
            access_key_id=access_key,
            secret_access_key=secret_key,
            session_token=session_token,
            custom_endpoint=custom_endpoint,
            server_side_encryption=sse,
        )


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret_key: str, date_stamp: str, region: str) -> bytes:
    k_date = _hmac_sha256(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _hmac_sha256(k_date, region)
    k_service = _hmac_sha256(k_region, "s3")
    return _hmac_sha256(k_service, "aws4_request")


def _resolve_target(cfg: S3Config, key: str = "") -> Tuple[str, str, str]:
    encoded_key = encode_s3_key(key) if key else ""
    if cfg.custom_endpoint:
        parsed = urllib.parse.urlparse(cfg.custom_endpoint)
        host = parsed.netloc
        base_path = parsed.path.rstrip("/")
        path_suffix = f"/{encoded_key}" if encoded_key else ""
        canonical_uri = f"{base_path}/{rfc3986_encode(cfg.bucket)}{path_suffix}"
        base_url = f"{parsed.scheme}://{host}{canonical_uri}"
        return host, canonical_uri, base_url

    host = f"{cfg.bucket}.s3.{cfg.region}.amazonaws.com"
    canonical_uri = f"/{encoded_key}" if encoded_key else "/"
    base_url = f"https://{host}{canonical_uri}"
    return host, canonical_uri, base_url


def _sign_headers_request(
    cfg: S3Config,
    method: str,
    key: str = "",
    query_params: Optional[Dict[str, str]] = None,
    payload: bytes = b"",
    extra_headers: Optional[Dict[str, str]] = None,
    now: Optional[datetime] = None,
) -> Tuple[str, Dict[str, str]]:
    dt = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    amz_date = dt.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = dt.strftime("%Y%m%d")
    host, canonical_uri, base_url = _resolve_target(cfg, key)
    payload_hash = hashlib.sha256(payload).hexdigest()

    headers: Dict[str, str] = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    if cfg.session_token:
        headers["x-amz-security-token"] = cfg.session_token
    if extra_headers:
        for hk, hv in extra_headers.items():
            if hv is not None and str(hv) != "":
                headers[hk.lower()] = str(hv).strip()

    q_items = sorted((rfc3986_encode(k), rfc3986_encode(v)) for k, v in (query_params or {}).items())
    canonical_query = "&".join(f"{k}={v}" for k, v in q_items)
    sorted_hdr_keys = sorted(headers.keys())
    canonical_headers = "".join(f"{k}:{headers[k]}\n" for k in sorted_hdr_keys)
    signed_headers = ";".join(sorted_hdr_keys)

    canonical_request = "\n".join(
        [method.upper(), canonical_uri, canonical_query, canonical_headers, signed_headers, payload_hash]
    )
    scope = f"{date_stamp}/{cfg.region}/s3/aws4_request"
    string_to_sign = "\n".join(
        ["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()]
    )
    sig = hmac.new(
        _signing_key(cfg.secret_access_key, date_stamp, cfg.region),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    headers["authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={cfg.access_key_id}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={sig}"
    )
    url = f"{base_url}?{canonical_query}" if canonical_query else base_url
    return url, headers


def _http_call_with_retry(
    method: str,
    url: str,
    headers: Dict[str, str],
    body: bytes = b"",
    timeout: int = 60,
    max_attempts: int = 4,
) -> Tuple[int, bytes]:
    last_err: Optional[Exception] = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(
            url,
            data=body if method.upper() in ("PUT", "POST") else None,
            headers=headers,
            method=method.upper(),
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as err:
            raw = err.read()
            if err.code in (429, 500, 502, 503, 504) and attempt < max_attempts - 1:
                last_err = err
                time.sleep(0.5 * (2 ** attempt))
                continue
            msg = raw.decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"S3 {method} {err.code}: {msg}") from err
        except urllib.error.URLError as err:
            last_err = err
            if attempt < max_attempts - 1:
                time.sleep(0.5 * (2 ** attempt))
                continue
            raise RuntimeError(f"Error de red S3 {method}: {err.reason}") from err
    raise RuntimeError(f"S3 {method} falló tras reintentos: {last_err}")


def s3_put_object(
    cfg: S3Config,
    key: str,
    body_bytes: bytes,
    content_type: str = "application/octet-stream",
    metadata: Optional[Dict[str, str]] = None,
) -> Dict[str, object]:
    extra: Dict[str, str] = {"content-type": content_type}
    if cfg.server_side_encryption:
        extra["x-amz-server-side-encryption"] = cfg.server_side_encryption
    if metadata:
        for mk, mv in metadata.items():
            clean_k = re.sub(r"[^a-z0-9_-]", "-", mk.lower())
            extra[f"x-amz-meta-{clean_k}"] = str(mv)
    url, headers = _sign_headers_request(cfg, "PUT", key=key, payload=body_bytes, extra_headers=extra)
    status, _ = _http_call_with_retry("PUT", url, headers, body=body_bytes)
    return {"ok": status in (200, 201, 204), "key": key, "bytes": len(body_bytes)}


def s3_get_object(cfg: S3Config, key: str) -> bytes:
    url, headers = _sign_headers_request(cfg, "GET", key=key)
    _, data = _http_call_with_retry("GET", url, headers)
    return data


def s3_delete_object(cfg: S3Config, key: str) -> None:
    url, headers = _sign_headers_request(cfg, "DELETE", key=key)
    _http_call_with_retry("DELETE", url, headers)


def s3_delete_objects_batch(cfg: S3Config, keys: List[str], max_workers: int = 6) -> int:
    clean_keys = [k for k in keys if k]
    if not clean_keys:
        return 0
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(lambda k: s3_delete_object(cfg, k), clean_keys))
    return len(clean_keys)


def _xml_text(parent: ET.Element, tag: str) -> str:
    for elem in parent:
        local = elem.tag.split("}", 1)[-1]
        if local == tag:
            return elem.text or ""
    return ""


def s3_list_objects_v2(cfg: S3Config, prefix: str) -> List[Dict[str, object]]:
    objects: List[Dict[str, object]] = []
    continuation_token = ""
    while True:
        params: Dict[str, str] = {"list-type": "2", "prefix": prefix}
        if continuation_token:
            params["continuation-token"] = continuation_token
        url, headers = _sign_headers_request(cfg, "GET", key="", query_params=params)
        _, xml_bytes = _http_call_with_retry("GET", url, headers)
        root = ET.fromstring(xml_bytes)
        for child in root:
            local = child.tag.split("}", 1)[-1]
            if local == "Contents":
                objects.append(
                    {
                        "key": _xml_text(child, "Key"),
                        "size": int(_xml_text(child, "Size") or 0),
                        "lastModified": _xml_text(child, "LastModified"),
                    }
                )
        is_truncated = _xml_text(root, "IsTruncated").lower() == "true"
        continuation_token = _xml_text(root, "NextContinuationToken")
        if not is_truncated or not continuation_token:
            break
    return objects
