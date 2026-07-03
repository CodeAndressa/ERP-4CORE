from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


LEAD_COLUMNS = {
    'name': "VARCHAR(180) NOT NULL DEFAULT 'Sem nome'",
    'company': 'VARCHAR(180)',
    'email': 'VARCHAR(180)',
    'phone': 'VARCHAR(60)',
    'status': "VARCHAR(30) NOT NULL DEFAULT 'novo'",
    'stage': "VARCHAR(30) NOT NULL DEFAULT 'novo'",
    'origin': "VARCHAR(80) DEFAULT 'Manual'",
    'value_potential': 'FLOAT DEFAULT 0',
    'notes': 'TEXT',
    'next_action': 'VARCHAR(255)',
    'last_contact_date': 'DATE',
    'next_contact_date': 'DATE',
    'assigned_to_id': 'INTEGER',
    'assigned_to_name': 'VARCHAR(120)',
    'created_at': 'TIMESTAMPTZ DEFAULT NOW()',
    'updated_at': 'TIMESTAMPTZ DEFAULT NOW()',
}

# Colunas que o modelo atual trata como opcionais. Bancos de producao antigos
# podem ter sido criados com um schema anterior que marcava algumas dessas
# colunas como NOT NULL (ex.: email), o que quebra o INSERT atual.
LEAD_NULLABLE_COLUMNS = [
    'company', 'email', 'phone', 'origin', 'value_potential', 'notes',
    'next_action', 'last_contact_date', 'next_contact_date',
    'assigned_to_id', 'assigned_to_name',
]

PROPOSAL_COLUMNS = {
    'lead_id': 'UUID',
    'code': "VARCHAR(40) NOT NULL DEFAULT ''",
    'title': "VARCHAR(180) NOT NULL DEFAULT 'Proposta comercial'",
    'client': "VARCHAR(180) NOT NULL DEFAULT ''",
    'value_total': 'FLOAT DEFAULT 0',
    'status': "VARCHAR(30) NOT NULL DEFAULT 'elaboracao'",
    'next_action': 'VARCHAR(255)',
    'notes': 'TEXT',
    'created_at': 'TIMESTAMPTZ DEFAULT NOW()',
    'updated_at': 'TIMESTAMPTZ DEFAULT NOW()',
}


def _dialect(engine: Engine) -> str:
    return engine.dialect.name


def _is_sqlite(engine: Engine) -> bool:
    return _dialect(engine) == 'sqlite'


def _add_column_sql(table: str, column: str, definition: str, sqlite: bool) -> str:
    if sqlite:
        sqlite_definition = definition.replace('TIMESTAMPTZ DEFAULT NOW()', 'DATETIME')
        return f'ALTER TABLE {table} ADD COLUMN {column} {sqlite_definition}'
    return f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}'


def _ensure_columns(engine: Engine, table: str, required: dict[str, str]) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    existing = {column['name'] for column in inspector.get_columns(table)}
    sqlite = _is_sqlite(engine)
    with engine.begin() as conn:
        for column, definition in required.items():
            if column not in existing:
                conn.execute(text(_add_column_sql(table, column, definition, sqlite)))


def _relax_not_null(engine: Engine, table: str, columns: list[str]) -> None:
    if _is_sqlite(engine):
        return
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    not_nullable = {
        column['name']
        for column in inspector.get_columns(table)
        if column['name'] in columns and not column.get('nullable', True)
    }
    if not not_nullable:
        return
    with engine.begin() as conn:
        for column in not_nullable:
            conn.execute(text(f'ALTER TABLE {table} ALTER COLUMN {column} DROP NOT NULL'))


def _drop_legacy_commercial_tables(engine: Engine) -> None:
    sqlite = _is_sqlite(engine)
    with engine.begin() as conn:
        if sqlite:
            conn.execute(text('PRAGMA foreign_keys = OFF'))
            conn.execute(text('DROP TABLE IF EXISTS proposals'))
            conn.execute(text('DROP TABLE IF EXISTS leads'))
            conn.execute(text('PRAGMA foreign_keys = ON'))
        else:
            conn.execute(text('DROP TABLE IF EXISTS proposals CASCADE'))
            conn.execute(text('DROP TABLE IF EXISTS leads CASCADE'))


def ensure_runtime_schema(engine: Engine) -> bool:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    recreated_commercial = False

    # Garante coluna asaas_customer_id em contracts
    if 'contracts' in tables:
        columns = {column['name'] for column in inspector.get_columns('contracts')}
        with engine.begin() as conn:
            if 'asaas_customer_id' not in columns:
                conn.execute(text('ALTER TABLE contracts ADD COLUMN asaas_customer_id VARCHAR(80)'))

    # Se leads existir com id INTEGER (schema antigo), recria com UUID.
    if 'leads' in tables:
        id_col = next(
            (c for c in inspector.get_columns('leads') if c['name'] == 'id'),
            None,
        )
        if id_col and 'INT' in str(id_col['type']).upper():
            _drop_legacy_commercial_tables(engine)
            recreated_commercial = True

    if not recreated_commercial:
        _ensure_columns(engine, 'leads', LEAD_COLUMNS)
        _ensure_columns(engine, 'proposals', PROPOSAL_COLUMNS)
        _relax_not_null(engine, 'leads', LEAD_NULLABLE_COLUMNS)

    return recreated_commercial
