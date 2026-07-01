from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_runtime_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    # Garante coluna asaas_customer_id em contracts
    if 'contracts' in tables:
        columns = {column['name'] for column in inspector.get_columns('contracts')}
        with engine.begin() as conn:
            if 'asaas_customer_id' not in columns:
                conn.execute(text('ALTER TABLE contracts ADD COLUMN asaas_customer_id VARCHAR(80)'))

    # Se leads existir com id INTEGER (schema antigo), recria com UUID
    if 'leads' in tables:
        id_col = next(
            (c for c in inspector.get_columns('leads') if c['name'] == 'id'),
            None,
        )
        if id_col and 'INT' in str(id_col['type']).upper():
            with engine.begin() as conn:
                conn.execute(text('PRAGMA foreign_keys = OFF'))
                conn.execute(text('DROP TABLE IF EXISTS proposals'))
                conn.execute(text('DROP TABLE IF EXISTS leads'))
                conn.execute(text('PRAGMA foreign_keys = ON'))
