from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.contracts import Contract, Order
from app.services.contract_storage_service import contract_file_response, store_contract_file

router = APIRouter(tags=["contracts"])


class OrderCreate(BaseModel):
    client_name: str
    description: str
    value: float
    contract_id: int | None = None
    closed_at: date | None = None
    delivery_date: date | None = None
    notes: str | None = None


@router.get('/contracts')
def contracts(db: Session = Depends(get_db)):
    return db.query(Contract).order_by(Contract.created_at.desc()).all()


@router.post('/contracts')
def create_contract(
    client_name: str = Form(...),
    title: str = Form('Contrato'),
    asaas_customer_id: str | None = Form(None),
    value: float | None = Form(None),
    start_date: date | None = Form(None),
    end_date: date | None = Form(None),
    status: str = Form('ativo'),
    notes: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    name = path = None
    if file and file.filename:
        stored = store_contract_file(file, client_name)
        name = stored.file_name
        path = stored.file_path

    item = Contract(
        client_name=client_name,
        asaas_customer_id=asaas_customer_id,
        title=title or 'Contrato',
        status=status or 'ativo',
        value=value,
        start_date=start_date,
        end_date=end_date,
        notes=notes,
        file_name=name,
        file_path=path,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get('/contracts/{id}/file')
def contract_file(id: int, db: Session = Depends(get_db)):
    item = db.get(Contract, id)
    if not item or not item.file_path:
        raise HTTPException(404, 'Arquivo não encontrado.')
    return contract_file_response(item.file_path, item.file_name)


@router.get('/orders')
def orders(db: Session = Depends(get_db)):
    return db.query(Order).order_by(Order.created_at.desc()).all()


@router.post('/orders')
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    item = Order(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
