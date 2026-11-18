#!/usr/bin/env python3
"""Herramienta CLI para restaurar desde S3 la cuenta y proyectos de un usuario en Supabase."""

import argparse
import gzip
import hashlib
import json
import os
import sys
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3_sigv4 import BACKUP_ROOT_PREFIX, S3Config, s3_get_object, user_backup_slug
from supabase_rest import SupabaseConfig, upsert_rows


def verify_and_gunzip_json(raw_gz: bytes, expected_sha256: str, label: str) -> Dict[str, Any]:
    actual_sha = hashlib.sha256(raw_gz).hexdigest()
    if expected_sha256 and actual_sha != expected_sha256:
        raise ValueError(f"Checksum inválido en {label}: esperado {expected_sha256}, recibido {actual_sha}")
    return json.loads(gzip.decompress(raw_gz).decode("utf-8"))


def topological_concept_levels(concepts: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Group catalogo_conceptos rows in parent->child levels so FK parent_id inserts succeed."""
    if not concepts:
        return []
    by_id = {c["id"]: c for c in concepts if c.get("id")}
    placed = set()
    levels: List[List[Dict[str, Any]]] = []
    remaining = list(concepts)

    while remaining:
        ready = []
        deferred = []
        for row in remaining:
            pid = row.get("parent_id")
            if not pid or pid not in by_id or pid in placed:
                ready.append(row)
            else:
                deferred.append(row)
        if not ready:
            levels.append(deferred)
            break
        levels.append(ready)
        for r in ready:
            if r.get("id"):
                placed.add(r["id"])
        remaining = deferred

    return levels


def restore_user_backup(
    email: str,
    date_str: str = "",
    project_id: str = "",
    clear_deleted: bool = False,
    restore_account: bool = False,
    apply: bool = False,
) -> Dict[str, Any]:
    s3_cfg = S3Config.from_env()
    sb_cfg = SupabaseConfig.from_env() if apply else None
    clean_email = str(email or "").strip().lower()
    if not clean_email:
        raise ValueError("Debes proporcionar --email.")

    slug = user_backup_slug(clean_email)
    user_prefix = f"{BACKUP_ROOT_PREFIX}/por_usuario/{slug}"
    manifest_key = f"{user_prefix}/{date_str}/manifiesto.json" if date_str else f"{user_prefix}/ultimo_manifiesto.json"
    manifest = json.loads(s3_get_object(s3_cfg, manifest_key).decode("utf-8"))

    restored_tables: Dict[str, int] = {}

    if restore_account:
        cuenta_raw = s3_get_object(s3_cfg, manifest["cuentaKey"])
        cuenta = verify_and_gunzip_json(cuenta_raw, manifest.get("cuentaSha256", ""), "cuenta.json.gz")
        if apply and sb_cfg is not None:
            if cuenta.get("empresa"):
                restored_tables["empresas"] = restored_tables.get("empresas", 0) + upsert_rows(
                    sb_cfg, "empresas", [cuenta["empresa"]], on_conflict="id"
                )
            if cuenta.get("perfil"):
                restored_tables["perfiles"] = restored_tables.get("perfiles", 0) + upsert_rows(
                    sb_cfg, "perfiles", [cuenta["perfil"]], on_conflict="id"
                )
            if cuenta.get("cubikarRegistro"):
                restored_tables["cubikar_registros"] = restored_tables.get("cubikar_registros", 0) + upsert_rows(
                    sb_cfg, "cubikar_registros", [cuenta["cubikarRegistro"]], on_conflict="email"
                )
            if cuenta.get("catalogosMaestros"):
                restored_tables["catalogos_maestros"] = restored_tables.get("catalogos_maestros", 0) + upsert_rows(
                    sb_cfg, "catalogos_maestros", cuenta["catalogosMaestros"], on_conflict="id"
                )
            if cuenta.get("archivosCuenta"):
                restored_tables["archivos_almacen"] = restored_tables.get("archivos_almacen", 0) + upsert_rows(
                    sb_cfg, "archivos_almacen", cuenta["archivosCuenta"], on_conflict="id"
                )

    target_projects = manifest.get("projects") or []
    if project_id:
        target_projects = [p for p in target_projects if str(p.get("id")) == str(project_id)]
        if not target_projects:
            raise ValueError(f"Proyecto '{project_id}' no encontrado en el manifiesto {manifest_key}.")

    for entry in target_projects:
        raw_proj = s3_get_object(s3_cfg, entry["s3Key"])
        bundle = verify_and_gunzip_json(raw_proj, entry.get("sha256", ""), entry["s3Key"])
        proj_row = dict(bundle["project"])
        if clear_deleted:
            proj_row["deleted_at"] = None
            proj_row["deleted_by_email"] = ""

        tables = bundle.get("tables") or {}
        if not apply or sb_cfg is None:
            restored_tables["proyectos"] = restored_tables.get("proyectos", 0) + 1
            for tbl, rows in tables.items():
                restored_tables[tbl] = restored_tables.get(tbl, 0) + len(rows)
            continue

        restored_tables["proyectos"] = restored_tables.get("proyectos", 0) + upsert_rows(
            sb_cfg, "proyectos", [proj_row], on_conflict="id"
        )

        for level_rows in topological_concept_levels(tables.get("catalogo_conceptos") or []):
            restored_tables["catalogo_conceptos"] = restored_tables.get("catalogo_conceptos", 0) + upsert_rows(
                sb_cfg, "catalogo_conceptos", level_rows, on_conflict="id"
            )

        ordered_steps = [
            ("insumos_apu", "id"),
            ("estimaciones", "id"),
            ("estimacion_detalles", "id"),
            ("cronograma_actividades", "id"),
            ("cronograma_config", "proyecto_id"),
            ("bitacora_config", "proyecto_id"),
            ("bitacora_notas", "id"),
            ("proveedores", "id"),
            ("compras_gastos", "id"),
            ("chat_mensajes", "id"),
            ("proyecto_colaboradores", "id"),
            ("archivos_almacen", "id"),
        ]
        for tbl, conflict_col in ordered_steps:
            rows = tables.get(tbl) or []
            if rows:
                if clear_deleted and tbl == "archivos_almacen":
                    rows = [{**r, "deleted_at": None} for r in rows]
                restored_tables[tbl] = restored_tables.get(tbl, 0) + upsert_rows(
                    sb_cfg, tbl, rows, on_conflict=conflict_col
                )

    return {
        "applied": apply,
        "email": clean_email,
        "backupDate": manifest.get("backupDate"),
        "projectsProcessed": len(target_projects),
        "rowsRestored": restored_tables,
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Restaurar respaldo de usuario Cubikar desde S3 a Supabase")
    parser.add_argument("--email", required=True, help="Correo del usuario a restaurar")
    parser.add_argument("--date", default="", help="Fecha YYYY-MM-DD (por defecto el último respaldo)")
    parser.add_argument("--project", default="", help="UUID de proyecto específico a restaurar")
    parser.add_argument("--clear-deleted", action="store_true", help="Quitar deleted_at para reactivar obras borradas")
    parser.add_argument("--restore-account", action="store_true", help="Incluir perfil/empresa/catálogos maestros")
    parser.add_argument("--apply", action="store_true", help="Escribir en Supabase (sin esta bandera solo verifica)")
    args = parser.parse_args(argv)

    result = restore_user_backup(
        email=args.email,
        date_str=args.date,
        project_id=args.project,
        clear_deleted=args.clear_deleted,
        restore_account=args.restore_account,
        apply=args.apply,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
