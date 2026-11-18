#!/usr/bin/env python3
"""Respaldo diario automático por usuario desde Supabase a AWS S3 (comprimido .json.gz)."""

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3_sigv4 import (
    BACKUP_ROOT_PREFIX,
    S3Config,
    s3_delete_objects_batch,
    s3_list_objects_v2,
    s3_put_object,
    user_backup_slug,
)
from supabase_rest import (
    SupabaseConfig,
    fetch_all_rows,
    fetch_rows_in,
    list_all_auth_users,
)


DATE_SEGMENT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SENSITIVE_AUTH_KEYS = {
    "encrypted_password",
    "confirmation_token",
    "recovery_token",
    "email_change_token_new",
    "email_change_token_current",
    "reauthentication_token",
}


def normalize_email(raw: Any) -> str:
    return str(raw or "").strip().lower()


def gzip_json_bytes(payload: Any) -> Tuple[bytes, str]:
    raw_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw_json, compresslevel=6, mtime=0)
    sha256 = hashlib.sha256(compressed).hexdigest()
    return compressed, sha256


def sanitize_auth_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        k: v
        for k, v in user.items()
        if k not in SENSITIVE_AUTH_KEYS and not k.endswith("_token")
    }


def fetch_optional_all_rows(
    sb_cfg: SupabaseConfig,
    table: str,
    select: str = "*",
    order: Optional[str] = "id.asc",
) -> List[Dict[str, Any]]:
    try:
        return fetch_all_rows(sb_cfg, table, select=select, order=order)
    except RuntimeError as err:
        msg = str(err)
        if "(404)" in msg or "PGRST205" in msg or "does not exist" in msg.lower():
            print(f"[Backup][WARN] Tabla opcional '{table}' omitida: {msg}", file=sys.stderr)
            return []
        raise


def select_dates_to_keep(date_strs: List[str], keep_daily: int = 7, keep_weekly: int = 4) -> Set[str]:
    """Keep the newest N daily dates plus the newest M Sunday (weekly) snapshots."""
    valid = sorted({d for d in date_strs if DATE_SEGMENT_RE.match(d)}, reverse=True)
    kept: Set[str] = set(valid[: max(0, keep_daily)])
    weekly_kept = 0
    for d in valid[max(0, keep_daily) :]:
        if weekly_kept >= max(0, keep_weekly):
            break
        dt = datetime.strptime(d, "%Y-%m-%d").date()
        if dt.weekday() == 6:  # Domingo
            kept.add(d)
            weekly_kept += 1
    return kept


def prune_prefix_by_date(
    s3_cfg: S3Config,
    prefix: str,
    date_extractor,
    keep_daily: int,
    keep_weekly: int,
    dry_run: bool = False,
) -> int:
    objects = s3_list_objects_v2(s3_cfg, prefix)
    by_date: Dict[str, List[str]] = {}
    for obj in objects:
        key = str(obj.get("key") or "")
        date_str = date_extractor(key)
        if date_str:
            by_date.setdefault(date_str, []).append(key)

    keep_dates = select_dates_to_keep(list(by_date.keys()), keep_daily=keep_daily, keep_weekly=keep_weekly)
    to_delete: List[str] = []
    for date_str, keys in by_date.items():
        if date_str not in keep_dates:
            to_delete.extend(keys)

    if dry_run or not to_delete:
        return len(to_delete) if not dry_run else 0
    return s3_delete_objects_batch(s3_cfg, to_delete)


def extract_user_date_from_key(key: str) -> Optional[str]:
    # _respaldos_servidor/por_usuario/<slug>/<YYYY-MM-DD>/...
    parts = key.split("/")
    if len(parts) >= 5 and DATE_SEGMENT_RE.match(parts[3]):
        return parts[3]
    return None


def extract_filename_date_from_key(key: str) -> Optional[str]:
    # _respaldos_servidor/db_completa/<YYYY-MM-DD>.sql.gz or resumen_diario/<YYYY-MM-DD>.json
    base = key.rsplit("/", 1)[-1]
    candidate = base.split(".", 1)[0]
    return candidate if DATE_SEGMENT_RE.match(candidate) else None


def fetch_project_bundle(sb_cfg: SupabaseConfig, project: Dict[str, Any]) -> Dict[str, Any]:
    pid = str(project.get("id") or "").strip()
    eq_pid = [("proyecto_id", f"eq.{pid}")]

    concepts = fetch_all_rows(sb_cfg, "catalogo_conceptos", order="orden.asc,id.asc", filters=eq_pid)
    concept_ids = [c["id"] for c in concepts if c.get("id")]
    insumos = fetch_rows_in(sb_cfg, "insumos_apu", "concepto_id", concept_ids, order="orden.asc,id.asc")

    estimaciones = fetch_all_rows(sb_cfg, "estimaciones", order="numero.asc,id.asc", filters=eq_pid)
    est_ids = [e["id"] for e in estimaciones if e.get("id")]
    estimacion_detalles = fetch_rows_in(sb_cfg, "estimacion_detalles", "estimacion_id", est_ids, order="id.asc")

    cronograma_actividades = fetch_all_rows(sb_cfg, "cronograma_actividades", order="id.asc", filters=eq_pid)
    cronograma_config = fetch_all_rows(sb_cfg, "cronograma_config", order="proyecto_id.asc", filters=eq_pid)
    bitacora_config = fetch_all_rows(sb_cfg, "bitacora_config", order="proyecto_id.asc", filters=eq_pid)
    bitacora_notas = fetch_all_rows(sb_cfg, "bitacora_notas", order="folio.asc,id.asc", filters=eq_pid)
    proveedores = fetch_all_rows(sb_cfg, "proveedores", order="id.asc", filters=eq_pid)
    compras_gastos = fetch_all_rows(sb_cfg, "compras_gastos", order="id.asc", filters=eq_pid)
    chat_mensajes = fetch_all_rows(sb_cfg, "chat_mensajes", order="created_at.asc,id.asc", filters=eq_pid)
    proyecto_colaboradores = fetch_all_rows(sb_cfg, "proyecto_colaboradores", order="id.asc", filters=eq_pid)
    archivos_almacen = fetch_all_rows(sb_cfg, "archivos_almacen", order="created_at.asc,id.asc", filters=eq_pid)

    return {
        "schemaVersion": 1,
        "project": project,
        "tables": {
            "catalogo_conceptos": concepts,
            "insumos_apu": insumos,
            "estimaciones": estimaciones,
            "estimacion_detalles": estimacion_detalles,
            "cronograma_actividades": cronograma_actividades,
            "cronograma_config": cronograma_config,
            "bitacora_config": bitacora_config,
            "bitacora_notas": bitacora_notas,
            "proveedores": proveedores,
            "compras_gastos": compras_gastos,
            "chat_mensajes": chat_mensajes,
            "proyecto_colaboradores": proyecto_colaboradores,
            "archivos_almacen": archivos_almacen,
        },
    }


def backup_single_user(
    sb_cfg: SupabaseConfig,
    s3_cfg: Optional[S3Config],
    backup_date: str,
    generated_at: str,
    email: str,
    account_bundle: Dict[str, Any],
    owned_projects: List[Dict[str, Any]],
    keep_daily: int,
    keep_weekly: int,
    dry_run: bool,
) -> Dict[str, Any]:
    slug = user_backup_slug(email)
    user_prefix = f"{BACKUP_ROOT_PREFIX}/por_usuario/{slug}"
    day_prefix = f"{user_prefix}/{backup_date}"

    cuenta_key = f"{day_prefix}/cuenta.json.gz"
    cuenta_gz, cuenta_sha = gzip_json_bytes(account_bundle)
    uploaded_bytes = len(cuenta_gz)
    if not dry_run and s3_cfg is not None:
        s3_put_object(s3_cfg, cuenta_key, cuenta_gz, content_type="application/gzip")

    project_entries: List[Dict[str, Any]] = []
    for proj in owned_projects:
        pid = str(proj.get("id") or "").strip()
        if not pid:
            continue
        bundle = fetch_project_bundle(sb_cfg, proj)
        proj_key = f"{day_prefix}/proyectos/{pid}.json.gz"
        proj_gz, proj_sha = gzip_json_bytes(bundle)
        uploaded_bytes += len(proj_gz)
        if not dry_run and s3_cfg is not None:
            s3_put_object(s3_cfg, proj_key, proj_gz, content_type="application/gzip")

        counts = {tbl: len(rows) for tbl, rows in bundle["tables"].items()}
        project_entries.append(
            {
                "id": pid,
                "nombre": proj.get("nombre") or "Proyecto sin título",
                "deletedAt": proj.get("deleted_at"),
                "isTrashed": bool(proj.get("deleted_at")),
                "updatedAt": proj.get("updated_at"),
                "s3Key": proj_key,
                "sha256": proj_sha,
                "compressedBytes": len(proj_gz),
                "counts": counts,
            }
        )

    manifest = {
        "schemaVersion": 1,
        "backupDate": backup_date,
        "generatedAt": generated_at,
        "userEmail": email,
        "userSlug": slug,
        "cuentaKey": cuenta_key,
        "cuentaSha256": cuenta_sha,
        "cuentaBytes": len(cuenta_gz),
        "totalProjects": len(project_entries),
        "activeProjects": sum(1 for p in project_entries if not p["isTrashed"]),
        "trashedProjects": sum(1 for p in project_entries if p["isTrashed"]),
        "projects": project_entries,
    }
    manifest_bytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
    manifest_key = f"{day_prefix}/manifiesto.json"
    latest_key = f"{user_prefix}/ultimo_manifiesto.json"

    if not dry_run and s3_cfg is not None:
        s3_put_object(s3_cfg, manifest_key, manifest_bytes, content_type="application/json; charset=utf-8")
        s3_put_object(s3_cfg, latest_key, manifest_bytes, content_type="application/json; charset=utf-8")
        pruned = prune_prefix_by_date(
            s3_cfg,
            f"{user_prefix}/",
            extract_user_date_from_key,
            keep_daily=keep_daily,
            keep_weekly=keep_weekly,
            dry_run=dry_run,
        )
    else:
        pruned = 0

    return {
        "email": email,
        "slug": slug,
        "projects": len(project_entries),
        "bytes": uploaded_bytes + len(manifest_bytes),
        "prunedObjects": pruned,
        "manifestKey": manifest_key,
    }


def run_backup(
    only_email: str = "",
    keep_daily: int = 7,
    keep_weekly: int = 4,
    dry_run: bool = False,
    backup_date: Optional[str] = None,
) -> Dict[str, Any]:
    sb_cfg = SupabaseConfig.from_env()
    s3_cfg = None if dry_run and not os.environ.get("AWS_S3_BUCKET") else S3Config.from_env()

    now_dt = datetime.now(timezone.utc)
    date_str = backup_date or now_dt.strftime("%Y-%m-%d")
    generated_at = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    target_only = normalize_email(only_email)

    auth_users = list_all_auth_users(sb_cfg)
    perfiles = fetch_all_rows(sb_cfg, "perfiles", order="id.asc")
    empresas = fetch_all_rows(sb_cfg, "empresas", order="id.asc")
    registros = fetch_optional_all_rows(sb_cfg, "cubikar_registros", order="id.asc")
    consumo_ia = fetch_optional_all_rows(sb_cfg, "consumo_mensual_ia", order="user_id.asc,month_key.asc")
    invitaciones = fetch_optional_all_rows(sb_cfg, "invitaciones", order="id.asc")
    catalogos_maestros = fetch_optional_all_rows(sb_cfg, "catalogos_maestros", order="id.asc")
    archivos_all = fetch_optional_all_rows(sb_cfg, "archivos_almacen", order="created_at.asc,id.asc")
    colaboraciones_all = fetch_all_rows(sb_cfg, "proyecto_colaboradores", order="id.asc")
    proyectos = fetch_all_rows(sb_cfg, "proyectos", order="id.asc")

    auth_by_email = {normalize_email(u.get("email")): sanitize_auth_user(u) for u in auth_users if normalize_email(u.get("email"))}
    perfil_by_email = {normalize_email(p.get("email")): p for p in perfiles if normalize_email(p.get("email"))}
    perfil_by_uid = {str(p.get("id")): p for p in perfiles if p.get("id")}
    empresa_by_id = {str(e.get("id")): e for e in empresas if e.get("id")}
    registro_by_email = {normalize_email(r.get("email")): r for r in registros if normalize_email(r.get("email"))}

    ia_by_uid: Dict[str, List[Dict[str, Any]]] = {}
    for row in consumo_ia:
        uid = str(row.get("user_id") or "").strip()
        if uid:
            ia_by_uid.setdefault(uid, []).append(row)

    invs_by_email: Dict[str, List[Dict[str, Any]]] = {}
    for inv in invitaciones:
        owners = {normalize_email(inv.get("owner_email")), normalize_email(inv.get("invitee_email"))}
        for em in owners:
            if em:
                invs_by_email.setdefault(em, []).append(inv)

    maestros_by_email: Dict[str, List[Dict[str, Any]]] = {}
    for cm in catalogos_maestros:
        em = normalize_email(cm.get("owner_email"))
        if em:
            maestros_by_email.setdefault(em, []).append(cm)

    account_files_by_email: Dict[str, List[Dict[str, Any]]] = {}
    for af in archivos_all:
        if not af.get("proyecto_id"):
            em = normalize_email(af.get("owner_email"))
            if em:
                account_files_by_email.setdefault(em, []).append(af)

    collabs_by_email: Dict[str, List[Dict[str, Any]]] = {}
    for col in colaboraciones_all:
        em = normalize_email(col.get("email_colaborador"))
        if em:
            collabs_by_email.setdefault(em, []).append(col)

    projects_by_email: Dict[str, List[Dict[str, Any]]] = {}
    for proj in proyectos:
        owner = normalize_email(proj.get("owner_email"))
        if not owner and proj.get("creado_por"):
            owner = normalize_email((perfil_by_uid.get(str(proj.get("creado_por"))) or {}).get("email"))
        owner = owner or "sin-propietario@cubikar.local"
        projects_by_email.setdefault(owner, []).append(proj)

    all_emails = sorted(
        set(auth_by_email)
        | set(perfil_by_email)
        | set(registro_by_email)
        | set(projects_by_email)
        | set(maestros_by_email)
    )
    if target_only:
        all_emails = [em for em in all_emails if em == target_only]

    ok_users: List[Dict[str, Any]] = []
    failed_users: List[Dict[str, str]] = []
    total_bytes = 0
    total_pruned = 0

    for em in all_emails:
        auth_u = auth_by_email.get(em)
        perfil = perfil_by_email.get(em)
        emp_id = str((perfil or {}).get("empresa_id") or "").strip()
        empresa = empresa_by_id.get(emp_id) if emp_id else None
        uid = str((auth_u or {}).get("id") or (perfil or {}).get("id") or "").strip()

        account_bundle = {
            "schemaVersion": 1,
            "backupDate": date_str,
            "generatedAt": generated_at,
            "userEmail": em,
            "authUser": auth_u,
            "perfil": perfil,
            "empresa": empresa,
            "cubikarRegistro": registro_by_email.get(em),
            "consumoMensualIa": ia_by_uid.get(uid, []),
            "invitaciones": invs_by_email.get(em, []),
            "catalogosMaestros": maestros_by_email.get(em, []),
            "archivosCuenta": account_files_by_email.get(em, []),
            "colaboracionesEnProyectos": collabs_by_email.get(em, []),
        }
        try:
            res = backup_single_user(
                sb_cfg=sb_cfg,
                s3_cfg=s3_cfg,
                backup_date=date_str,
                generated_at=generated_at,
                email=em,
                account_bundle=account_bundle,
                owned_projects=projects_by_email.get(em, []),
                keep_daily=keep_daily,
                keep_weekly=keep_weekly,
                dry_run=dry_run,
            )
            ok_users.append(res)
            total_bytes += int(res["bytes"])
            total_pruned += int(res["prunedObjects"])
        except Exception as exc:
            failed_users.append({"email": em, "error": str(exc)})
            print(f"[Backup][ERROR] Usuario {em}: {exc}", file=sys.stderr)

    run_summary = {
        "schemaVersion": 1,
        "backupDate": date_str,
        "generatedAt": generated_at,
        "dryRun": dry_run,
        "totalUsersTargeted": len(all_emails),
        "usersSucceeded": len(ok_users),
        "usersFailed": len(failed_users),
        "totalProjectsBackedUp": sum(u["projects"] for u in ok_users),
        "totalUploadedBytes": total_bytes,
        "prunedObjects": total_pruned,
        "failures": failed_users,
    }

    if not dry_run and s3_cfg is not None:
        summary_key = f"{BACKUP_ROOT_PREFIX}/resumen_diario/{date_str}.json"
        s3_put_object(
            s3_cfg,
            summary_key,
            json.dumps(run_summary, ensure_ascii=False, indent=2).encode("utf-8"),
            content_type="application/json; charset=utf-8",
        )
        if not failed_users:
            prune_prefix_by_date(
                s3_cfg,
                f"{BACKUP_ROOT_PREFIX}/resumen_diario/",
                extract_filename_date_from_key,
                keep_daily=keep_daily,
                keep_weekly=keep_weekly,
                dry_run=dry_run,
            )

    return run_summary


def upload_pg_dump_file(file_path: str, backup_date: str, keep_daily: int, keep_weekly: int) -> Dict[str, Any]:
    s3_cfg = S3Config.from_env()
    with open(file_path, "rb") as fh:
        data = fh.read()
    sha256 = hashlib.sha256(data).hexdigest()
    key = f"{BACKUP_ROOT_PREFIX}/db_completa/{backup_date}.sql.gz"
    res = s3_put_object(
        s3_cfg,
        key,
        data,
        content_type="application/gzip",
        metadata={"sha256": sha256, "backup-date": backup_date},
    )
    pruned = prune_prefix_by_date(
        s3_cfg,
        f"{BACKUP_ROOT_PREFIX}/db_completa/",
        extract_filename_date_from_key,
        keep_daily=keep_daily,
        keep_weekly=keep_weekly,
    )
    return {**res, "sha256": sha256, "prunedObjects": pruned}


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Respaldo automático por usuario Cubikar en AWS S3")
    parser.add_argument("--only-email", default=os.environ.get("BACKUP_ONLY_EMAIL", ""), help="Respaldar solo un correo")
    parser.add_argument("--keep-daily", type=int, default=int(os.environ.get("BACKUP_KEEP_DAILY", "7") or "7"))
    parser.add_argument("--keep-weekly", type=int, default=int(os.environ.get("BACKUP_KEEP_WEEKLY", "4") or "4"))
    parser.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"), help="Fecha YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true", default=os.environ.get("BACKUP_DRY_RUN", "") == "1")
    parser.add_argument("--upload-pg-dump", default="", help="Sube un archivo pg_dump .sql.gz existente y aplica retención")
    args = parser.parse_args(argv)

    if args.upload_pg_dump:
        info = upload_pg_dump_file(args.upload_pg_dump, args.date, args.keep_daily, args.keep_weekly)
        print(json.dumps(info, ensure_ascii=False, indent=2))
        return 0

    summary = run_backup(
        only_email=args.only_email,
        keep_daily=args.keep_daily,
        keep_weekly=args.keep_weekly,
        dry_run=args.dry_run,
        backup_date=args.date,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if summary["usersFailed"] > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
