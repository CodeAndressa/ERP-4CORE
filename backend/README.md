# Backend 4Core

## Como rodar

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Observações
- O MVP usa SQLite local.
- O código está preparado para futura migração para PostgreSQL.
- A autenticação usa JWT simples.
