"""Rebuild the single-file tenant SQL template. Does not connect to a database."""
from pathlib import Path
root = Path(__file__).resolve().parent
foundation = (root / "001_foundation.sql").read_text()
foundation = foundation.replace("SELECT 'tenant_foundation_schema_created_not_provisioned' AS result;", "-- Foundation section finished; service tables follow.")
foundation = foundation.replace("COMMENT 'Logical reference; account registry defined in next stage'", "COMMENT 'Stable radius_identities.id across PPPoE and hotspot'")
parts = [
    (root / "000_fresh_database_guard.sql").read_text(),
    "-- SECTION 1: Network, subscription, managers and customers.\n" + foundation,
    "-- SECTION 2: Official FreeRADIUS SQL schema (verbatim).\n" + (root / "vendor/freeradius-mysql-schema.sql").read_text(),
    "-- SECTION 3: PPPoE, hotspot, NAS and OpenVPN.\n" + (root / "002_services.sql").read_text(),
    "SELECT 'tenant_database_schema_created_not_activated' AS result;\n",
]
(root / "create_tenant_database.sql").write_text("\n".join(parts))
