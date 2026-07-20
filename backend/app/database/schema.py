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

# Colunas que o modelo atual realmente exige. A tabela leads em producao
# carrega colunas de um schema bem mais antigo (ex.: email, source_page)
# que nao existem no modelo atual mas ainda tem NOT NULL herdado -- cada
# uma delas quebra o INSERT atual assim que aparece. Em vez de listar uma
# a uma conforme surgem, relaxamos tudo que nao esta nesse conjunto minimo.
LEAD_REQUIRED_COLUMNS = {'id', 'name', 'status', 'stage'}

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

# Adicionadas depois que dunning_log já existia em produção — sem isso,
# create_all() não altera tabela existente, só cria as que faltam.
DUNNING_LOG_COLUMNS = {
    'customer': "VARCHAR(200) NOT NULL DEFAULT ''",
    'value': 'FLOAT DEFAULT 0',
    'resolved_at': 'TIMESTAMPTZ',
    'resolved_status': "VARCHAR(40) NOT NULL DEFAULT ''",
    'resolved_payment_date': "VARCHAR(20) NOT NULL DEFAULT ''",
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


def _relax_not_null_except(engine: Engine, table: str, required: set[str]) -> None:
    if _is_sqlite(engine):
        return
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    not_nullable = {
        column['name']
        for column in inspector.get_columns(table)
        if column['name'] not in required and not column.get('nullable', True)
    }
    if not not_nullable:
        return
    with engine.begin() as conn:
        for column in not_nullable:
            conn.execute(text(f'ALTER TABLE {table} ALTER COLUMN {column} DROP NOT NULL'))


def _drop_check_constraints(engine: Engine, table: str) -> None:
    # A tabela leads em producao carrega CHECK constraints de um schema
    # antigo (ex.: leads_status_check restrito a um enum que nao bate mais
    # com os valores atuais do app). O app ja valida status/stage em
    # Python antes do INSERT, entao nenhuma CHECK constraint no banco e
    # necessaria aqui -- removemos todas para nao quebrar por herdar um
    # enum desatualizado.
    if _is_sqlite(engine):
        return
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    constraints = inspector.get_check_constraints(table)
    if not constraints:
        return
    with engine.begin() as conn:
        for constraint in constraints:
            name = constraint.get('name')
            if name:
                conn.execute(text(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS "{name}"'))


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
        _relax_not_null_except(engine, 'leads', LEAD_REQUIRED_COLUMNS)
        _drop_check_constraints(engine, 'leads')

    _ensure_columns(engine, 'dunning_log', DUNNING_LOG_COLUMNS)

    return recreated_commercial
