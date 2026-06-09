"""READ-ONLY diagnostico cargo/permissoes. NAO escreve nada.

Uso:
    python _diag_cargos.py "<DATABASE_URL>"
ou:
    $env:DB_URL="<DATABASE_URL>"; python _diag_cargos.py
"""

import os
import sys

import psycopg

URL = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DB_URL", "")).strip()
if not URL:
    sys.exit("Faltou a DATABASE_URL (argv[1] ou env DB_URL).")
if "connect_timeout" not in URL:
    URL += ("&" if "?" in URL else "?") + "connect_timeout=15"

TIPOS_LABELS = ["Administrador", "Advogado", "Estagiário"]


def q(cur, sql, args=None):
    cur.execute(sql, args or ())
    return cur.fetchall()


with psycopg.connect(URL, autocommit=True) as conn:
    conn.execute("SET default_transaction_read_only = on")
    cur = conn.cursor()

    print("=== COUNTS ===", flush=True)
    for tbl in ("usuarios_usuario", "auth_user", "auth_group"):
        sql = f"SELECT count(*) FROM {tbl}"  # nosec B608 - tbl from hardcoded literal tuple
        print(f"{tbl}: {q(cur, sql)[0][0]}")

    print("\n=== GROUPS (Cargo) + permission count ===")
    for gid, name, perms in q(
        cur,
        """
        SELECT g.id, g.name, count(gp.permission_id)
        FROM auth_group g
        LEFT JOIN auth_group_permissions gp ON gp.group_id = g.id
        GROUP BY g.id, g.name ORDER BY g.name
    """,
    ):
        flag = "" if name in TIPOS_LABELS else "  <-- nome NAO-padrao"
        warn = "  <-- ZERO PERMISSOES" if perms == 0 else ""
        print(f"  [{gid}] {name!r}: {perms} perms{flag}{warn}")

    print("\n=== valores distintos de usuarios_usuario.cargo ===")
    for cargo, n in q(
        cur,
        "SELECT cargo, count(*) FROM usuarios_usuario GROUP BY cargo ORDER BY cargo",
    ):
        flag = "" if cargo in TIPOS_LABELS else "  <-- valor legado/nao-normalizado"
        print(f"  {cargo!r}: {n} usuario(s){flag}")

    print("\n=== cadeia de permissao por usuario ===")
    for uid, email, cargo, auth_id in q(
        cur,
        """
        SELECT u.id, u.email, u.cargo, au.id
        FROM usuarios_usuario u
        LEFT JOIN auth_user au ON lower(au.username) = lower(u.email)
                               OR lower(au.email) = lower(u.email)
        ORDER BY u.email
    """,
    ):
        if auth_id is None:
            print(f"  {email} (cargo={cargo!r}): SEM auth_user  <-- QUEBRADO")
            continue
        grps = q(
            cur,
            """
            SELECT g.name, count(gp.permission_id)
            FROM auth_user_groups ug
            JOIN auth_group g ON g.id = ug.group_id
            LEFT JOIN auth_group_permissions gp ON gp.group_id = g.id
            WHERE ug.user_id = %s GROUP BY g.name
        """,
            (auth_id,),
        )
        if not grps:
            print(
                f"  {email} (cargo={cargo!r}): auth_user {auth_id} SEM grupos  <-- QUEBRADO"
            )
        else:
            gdesc = ", ".join(f"{n}({p}p)" for n, p in grps)
            names = [n for n, _ in grps]
            mismatch = "  <-- cargo!=grupo" if cargo not in names else ""
            zero = "  <-- grupo c/ 0 perms" if all(p == 0 for _, p in grps) else ""
            print(f"  {email} (cargo={cargo!r}): grupos=[{gdesc}]{mismatch}{zero}")

    print("\n=== auth_user duplicados por lower(email) ===")
    dups = q(
        cur,
        """
        SELECT lower(email), count(*) FROM auth_user
        WHERE email <> '' GROUP BY lower(email) HAVING count(*) > 1
    """,
    )
    print("  nenhum" if not dups else "")
    for e, n in dups:
        print(f"  {e}: {n} auth_users  <-- DUPLICADO")
