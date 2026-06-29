from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_runtime_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    if 'contracts' not in inspector.get_table_names():
        return

    columns = {column['name'] for column in inspector.get_columns('contracts')}
    with engine.begin() as conn:
        if 'asaas_customer_id' not in columns:
            conn.execute(text('ALTER TABLE contracts ADD COLUMN asaas_customer_id VARCHAR(80)'))
