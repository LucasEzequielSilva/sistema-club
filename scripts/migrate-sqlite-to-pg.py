"""
Migra datos de dev.db (SQLite) a Supabase (PostgreSQL).
Orden de inserción respeta foreign keys.
"""

import sqlite3
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

SQLITE_PATH = "dev.db"
PG_DSN = "postgresql://postgres:Lacaverna10_$@db.nimyvmeywqbyfzzgjwfa.supabase.co:5432/postgres"


def sqlite_conn():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def pg_conn():
    return psycopg2.connect(PG_DSN)


def fetch_all(sqlite_cur, table):
    sqlite_cur.execute(f"SELECT * FROM {table}")
    rows = sqlite_cur.fetchall()
    if not rows:
        return [], []
    cols = [d[0] for d in sqlite_cur.description]
    return cols, [dict(r) for r in rows]


def parse_dt(val):
    """SQLite stores datetimes as strings; convert to Python datetime."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        # epoch ms
        return datetime.fromtimestamp(val / 1000)
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
    ):
        try:
            return datetime.strptime(str(val), fmt)
        except ValueError:
            continue
    return val  # pass through, let PG handle it


BOOLEAN_COLS = {
    "accounts": ["includeIvaInCost"],
    "branches": ["isActive"],
    "account_members": ["isActive"],
    "product_categories": ["isActive"],
    "cost_categories": ["isActive"],
    "payment_methods": ["isActive"],
    "suppliers": ["isActive"],
    "clients": ["isActive"],
    "products": ["isActive"],
    "price_lists": ["isDefault", "isActive"],
    "bank_accounts": ["isActive"],
    "afip_configs": ["isProduction"],
}

DATETIME_COLS = {
    "accounts": ["createdAt", "updatedAt"],
    "branches": ["createdAt"],
    "account_members": ["createdAt"],
    "product_categories": ["createdAt"],
    "cost_categories": ["createdAt"],
    "payment_methods": ["createdAt"],
    "suppliers": ["createdAt"],
    "clients": ["createdAt"],
    "products": ["createdAt", "updatedAt", "lastCostUpdate"],
    "price_lists": ["createdAt"],
    "price_list_items": ["createdAt", "updatedAt"],
    "sales": ["createdAt", "updatedAt", "saleDate", "dueDate"],
    "sale_payments": ["createdAt", "paymentDate", "accreditationDate"],
    "purchases": ["createdAt", "updatedAt", "invoiceDate", "dueDate"],
    "purchase_payments": ["createdAt", "paymentDate", "accreditationDate"],
    "stock_movements": ["createdAt", "movementDate"],
    "bank_accounts": ["createdAt", "balanceDate"],
    "cash_flow_entries": ["createdAt", "entryDate"],
    "projections": ["createdAt", "updatedAt"],
    "afip_configs": ["createdAt", "updatedAt"],
    "invoices": ["createdAt", "updatedAt", "invoiceDate", "caeExpiration"],
    "user_memories": ["createdAt", "updatedAt"],
}

# Tables in FK-dependency order
TABLES = [
    "accounts",
    "branches",
    "account_members",
    "product_categories",
    "cost_categories",
    "payment_methods",
    "suppliers",
    "clients",
    "products",
    "price_lists",
    "price_list_items",
    "sales",
    "sale_payments",
    "purchases",
    "purchase_payments",
    "stock_movements",
    "bank_accounts",
    "cash_flow_entries",
    "projections",
    "afip_configs",
    "invoices",
    "user_memories",
]


def migrate_table(sqlite_cur, pg_cur, table):
    cols, rows = fetch_all(sqlite_cur, table)
    if not rows:
        print(f"  {table}: sin datos, saltando.")
        return

    dt_cols = DATETIME_COLS.get(table, [])
    bool_cols = BOOLEAN_COLS.get(table, [])

    # Fix datetime and boolean columns
    for row in rows:
        for col in dt_cols:
            if col in row:
                row[col] = parse_dt(row[col])
        for col in bool_cols:
            if col in row and row[col] is not None:
                row[col] = bool(row[col])

    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))

    # Build values as tuples in column order
    values = [tuple(row[c] for c in cols) for row in rows]

    # Use INSERT ... ON CONFLICT DO NOTHING to allow re-runs
    sql = f'INSERT INTO "{table}" ({col_list}) VALUES %s ON CONFLICT DO NOTHING'

    execute_values(pg_cur, sql, values, template=f"({placeholders})")
    print(f"  {table}: {len(rows)} filas migradas.")


def main():
    print("Conectando a SQLite y PostgreSQL...")
    sc = sqlite_conn()
    sc_cur = sc.cursor()
    pg = pg_conn()
    pg_cur = pg.cursor()

    print("Migrando tablas...")
    for table in TABLES:
        try:
            migrate_table(sc_cur, pg_cur, table)
        except Exception as e:
            print(f"  ERROR en {table}: {e}")
            pg.rollback()
            # Continue with other tables
            pg_cur = pg.cursor()
            continue

    pg.commit()
    pg_cur.close()
    pg.close()
    sc.close()
    print("\nMigracion completada.")


if __name__ == "__main__":
    main()
