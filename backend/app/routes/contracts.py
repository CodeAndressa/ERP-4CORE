from datetime import date
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.contracts import Contract, Order
router=APIRouter(tags=["contracts"]); upload_dir=Path(__file__).resolve().parents[2]/"uploads"/"contracts"
class OrderCreate(BaseModel): client_name:str; description:str; value:float; contract_id:int|None=None; closed_at:date|None=None; delivery_date:date|None=None; notes:str|None=None
@router.get('/contracts')
def contracts(db:Session=Depends(get_db)): return db.query(Contract).order_by(Contract.created_at.desc()).all()
@router.post('/contracts')
def create_contract(client_name:str=Form(...),title:str=Form(...),value:float|None=Form(None),start_date:date|None=Form(None),end_date:date|None=Form(None),notes:str|None=Form(None),file:UploadFile|None=File(None),db:Session=Depends(get_db)):
    name=path=None
    if file and file.filename:
        suffix=Path(file.filename).suffix.lower()
        if suffix not in {'.pdf','.doc','.docx'}: raise HTTPException(400,'Envie PDF, DOC ou DOCX.')
        content=file.file.read()
        if len(content)>10*1024*1024: raise HTTPException(400,'Máximo de 10 MB.')
        upload_dir.mkdir(parents=True,exist_ok=True); target=upload_dir/f'{uuid4().hex}{suffix}'; target.write_bytes(content); name=file.filename; path=str(target)
    item=Contract(client_name=client_name,title=title,value=value,start_date=start_date,end_date=end_date,notes=notes,file_name=name,file_path=path); db.add(item);db.commit();db.refresh(item);return item
@router.get('/contracts/{id}/file')
def contract_file(id:int,db:Session=Depends(get_db)):
    item=db.get(Contract,id)
    if not item or not item.file_path or not Path(item.file_path).exists(): raise HTTPException(404,'Arquivo não encontrado.')
    return FileResponse(item.file_path,filename=item.file_name)
@router.get('/orders')
def orders(db:Session=Depends(get_db)): return db.query(Order).order_by(Order.created_at.desc()).all()
@router.post('/orders')
def create_order(payload:OrderCreate,db:Session=Depends(get_db)):
    item=Order(**payload.model_dump());db.add(item);db.commit();db.refresh(item);return item