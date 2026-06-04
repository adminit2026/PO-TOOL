from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends, Form
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from bson import ObjectId
import secrets
import pandas as pd
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment
import json
import shutil

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

# === Models ===
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: str
    name: str
    role: str

class SettingsModel(BaseModel):
    commission_fr: float = 24.0
    commission_es: float = 37.0
    commission_it: float = 26.0
    minimum_margin: float = 10.0
    operational_cost: float = 0.5
    shipping_cost: float = 1.0
    ups_cost_default: float = 1.0

class UploadResult(BaseModel):
    upload_id: str
    filename: str
    total_items: int
    needs_review: int
    approved: int
    timestamp: str
    summary: dict

# === Auth Helpers ===
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "default_secret_key_change_in_production")

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# === Helper Functions ===
def load_stock_data(file_path: str) -> dict:
    """Load stock data and return dict keyed by ASIN"""
    try:
        df = pd.read_excel(file_path, engine='openpyxl', header=1)
        stock_dict = {}
        for _, row in df.iterrows():
            asin = row.get('ASIN')
            if pd.notna(asin):
                stock_qty = row.get('Sellable On Hand Units', 0)
                stock_val = row.get('Sellable On Hand Inventory', 0)
                stock_dict[asin] = {
                    'stock_quantity': int(stock_qty) if pd.notna(stock_qty) and stock_qty else 0,
                    'stock_value': float(stock_val) if pd.notna(stock_val) and stock_val else 0.0
                }
        return stock_dict
    except Exception as e:
        logging.error(f"Error loading stock data: {e}")
        return {}

def load_sales_data(file_path: str) -> dict:
    """Load sales data and return dict keyed by ASIN"""
    try:
        df = pd.read_excel(file_path, engine='openpyxl', header=1)
        sales_dict = {}
        for _, row in df.iterrows():
            asin = row.get('ASIN')
            if pd.notna(asin):
                units = row.get('Dispatched units', 0)
                revenue = row.get('Dispatched revenue', 0)
                sales_dict[asin] = {
                    'sales_units': int(units) if pd.notna(units) and units else 0,
                    'sales_revenue': float(revenue) if pd.notna(revenue) and revenue else 0.0
                }
        return sales_dict
    except Exception as e:
        logging.error(f"Error loading sales data: {e}")
        return {}

# === Cost Calculation Logic ===
def calculate_order_costs(df: pd.DataFrame, settings: dict, stock_data: dict, sales_data: dict) -> pd.DataFrame:
    """
    Calculate production costs, margins, and approval status with stock/sales data.
    """
    results = []
    
    for idx, row in df.iterrows():
        asin = row.get('ASIN', '')
        quantity = row.get('Quantity Requested', 0) or row.get('Expected Quantity', 0) or 0
        unit_cost = row.get('Unit Cost', 0) or 0
        
        # Get stock and sales data
        stock_info = stock_data.get(asin, {})
        sales_info = sales_data.get(asin, {})
        
        # Simple production cost estimation (40% of unit cost)
        production_cost = unit_cost * 0.4
        
        # Calculate commission based on marketplace (default FR)
        commission_rate = settings['commission_fr'] / 100
        commission = unit_cost * commission_rate
        
        # UPS cost and operational cost per unit
        ups_cost = settings.get('ups_cost_default', 1.0)
        operational_cost = settings['operational_cost']
        
        # Total cost per unit
        total_cost_per_unit = production_cost + ups_cost + operational_cost + commission
        
        # Margin calculation
        margin_per_unit = unit_cost - total_cost_per_unit
        margin_percentage = (margin_per_unit / unit_cost * 100) if unit_cost > 0 else 0
        
        # Total values
        total_cost = total_cost_per_unit * quantity
        total_margin = margin_per_unit * quantity
        
        # Determine if needs review
        needs_review = margin_per_unit < 0 or margin_percentage < settings['minimum_margin']
        status = "NEEDS_REVIEW" if needs_review else "APPROVED"
        
        result = {
            'PO': row.get('PO', ''),
            'Vendor': row.get('Vendor', ''),
            'Ship to Location': row.get('Warehouse', ''),
            'ASIN': asin,
            'External ID': row.get('External ID', ''),
            'Model Number': row.get('Model Number', ''),
            'Title': row.get('Title', ''),
            'Quantity': quantity,
            'Unit Cost': round(unit_cost, 2),
            'Production Cost': round(production_cost, 2),
            'UPS Cost': round(ups_cost, 2),
            'Operational Cost': round(operational_cost, 2),
            'Commission': round(commission, 2),
            'Total Cost/Unit': round(total_cost_per_unit, 2),
            'Margin/Unit': round(margin_per_unit, 2),
            'Margin %': round(margin_percentage, 2),
            'Total Cost': round(total_cost, 2),
            'Total Margin': round(total_margin, 2),
            'Stock Quantity': int(stock_info.get('stock_quantity', 0)),
            'Sales Units (30d)': int(sales_info.get('sales_units', 0)),
            'Status': status,
            'Needs Review': needs_review
        }
        results.append(result)
    
    return pd.DataFrame(results)

def create_excel_with_formatting(results_df: pd.DataFrame, output_path: str):
    """
    Create Excel file with conditional formatting and all requested fields.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "PO Analysis"
    
    # Write headers
    headers = [
        'PO', 'Vendor', 'Ship to Location', 'ASIN', 'External ID', 'Model Number', 'Title',
        'Quantity', 'Unit Cost', 'Production Cost', 'UPS Cost', 'Operational Cost', 
        'Commission', 'Total Cost/Unit', 'Margin/Unit', 'Margin %', 
        'Total Cost', 'Total Margin', 'Stock Quantity', 'Sales Units (30d)', 'Status'
    ]
    
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = Font(bold=True, size=11)
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.fill = PatternFill(start_color="000000", end_color="000000", fill_type="solid")
        cell.font = Font(bold=True, size=11, color="FFFFFF")
    
    # Define fills
    red_fill = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
    red_font = Font(color="CC0000", bold=True)
    
    # Write data with formatting
    for row_idx, row_data in enumerate(results_df.itertuples(index=False), 2):
        needs_review = row_data[-1]  # Last column is 'Needs Review'
        
        # Write data (exclude 'Needs Review' column from output)
        for col_idx, value in enumerate(row_data[:-1], 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            
            # Apply red formatting for items needing review
            if needs_review:
                cell.fill = red_fill
                if col_idx == 21:  # Status column
                    cell.font = red_font
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    wb.save(output_path)

def create_excel_with_approval(results_list: list, output_path: str):
    """
    Create Excel file with separate sheets for Approved and Non-Approved orders.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet
    
    # Define headers
    headers = [
        'PO', 'Vendor', 'Ship to Location', 'ASIN', 'External ID', 'Model Number', 'Title',
        'Quantity', 'Unit Cost', 'Production Cost', 'UPS Cost', 'Operational Cost', 
        'Commission', 'Total Cost/Unit', 'Margin/Unit', 'Margin %', 
        'Total Cost', 'Total Margin', 'Stock Quantity', 'Sales Units (30d)', 'Status'
    ]
    
    # Separate data by approval status
    approved_items = [item for item in results_list if item.get('Approval Status') == 'approved']
    rejected_items = [item for item in results_list if item.get('Approval Status') == 'rejected']
    pending_items = [item for item in results_list if item.get('Approval Status', 'pending') == 'pending']
    
    # Define fills and fonts
    green_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    red_fill = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
    yellow_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
    header_fill = PatternFill(start_color="000000", end_color="000000", fill_type="solid")
    header_font = Font(bold=True, size=11, color="FFFFFF")
    
    def write_sheet(ws, data, fill_color=None):
        # Write headers
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.fill = header_fill
        
        # Write data
        for row_idx, item in enumerate(data, 2):
            needs_review = item.get('Needs Review', False)
            
            for col_idx, header in enumerate(headers, 1):
                value = item.get(header, '')
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                
                # Apply background color
                if fill_color:
                    cell.fill = fill_color
                elif needs_review:
                    cell.fill = red_fill
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
    
    # Create Approved Orders sheet
    if approved_items:
        ws_approved = wb.create_sheet("Approved Orders")
        write_sheet(ws_approved, approved_items, green_fill)
    
    # Create Rejected/Pending Orders sheet
    non_approved = rejected_items + pending_items
    if non_approved:
        ws_rejected = wb.create_sheet("Non-Approved Orders")
        write_sheet(ws_rejected, non_approved, yellow_fill)
    
    # Create All Orders sheet
    ws_all = wb.create_sheet("All Orders", 0)  # Insert at beginning
    write_sheet(ws_all, results_list)
    
    wb.save(output_path)

# === Auth Endpoints ===
@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    email = request.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Use secure cookies for production (HTTPS)
    is_production = "preview.emergentagent.com" in os.environ.get('FRONTEND_ORIGIN', '')
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=604800,
        path="/"
    )
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user.get("name", "Admin"),
        "role": user.get("role", "admin")
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

# === Settings Endpoints ===
@api_router.get("/settings")
async def get_settings(request: Request):
    await get_current_user(request)
    settings = await db.settings.find_one({"type": "po_thresholds"})
    if not settings:
        default_settings = SettingsModel().model_dump()
        await db.settings.insert_one({"type": "po_thresholds", **default_settings})
        return default_settings
    settings.pop("_id", None)
    settings.pop("type", None)
    return settings

@api_router.post("/settings")
async def update_settings(settings: SettingsModel, request: Request):
    await get_current_user(request)
    settings_dict = settings.model_dump()
    await db.settings.update_one(
        {"type": "po_thresholds"},
        {"$set": settings_dict},
        upsert=True
    )
    return {"message": "Settings updated successfully", "settings": settings_dict}

# === Upload & Processing Endpoints ===
@api_router.post("/upload")
async def upload_files(
    request: Request,
    po_file: UploadFile = File(...),
    stock_file: Optional[UploadFile] = File(None),
    sales_file: Optional[UploadFile] = File(None)
):
    user = await get_current_user(request)
    
    if not po_file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="PO file must be Excel format")
    
    # Get current settings
    settings = await db.settings.find_one({"type": "po_thresholds"})
    if not settings:
        settings = SettingsModel().model_dump()
    else:
        settings.pop("_id", None)
        settings.pop("type", None)
    
    # Save uploaded files
    upload_id = str(uuid.uuid4())
    po_path = f"/app/uploads/{upload_id}_po.xlsx"
    
    with open(po_path, "wb") as buffer:
        shutil.copyfileobj(po_file.file, buffer)
    
    # Load stock data if provided
    stock_data = {}
    if stock_file and stock_file.filename:
        stock_path = f"/app/uploads/{upload_id}_stock.xlsx"
        with open(stock_path, "wb") as buffer:
            shutil.copyfileobj(stock_file.file, buffer)
        stock_data = load_stock_data(stock_path)
    
    # Load sales data if provided
    sales_data = {}
    if sales_file and sales_file.filename:
        sales_path = f"/app/uploads/{upload_id}_sales.xlsx"
        with open(sales_path, "wb") as buffer:
            shutil.copyfileobj(sales_file.file, buffer)
        sales_data = load_sales_data(sales_path)
    
    try:
        # Read PO Excel file
        df = pd.read_excel(po_path, engine='openpyxl')
        
        # Process and calculate costs
        results_df = calculate_order_costs(df, settings, stock_data, sales_data)
        
        # Generate summary
        total_items = len(results_df)
        needs_review = results_df['Needs Review'].sum()
        approved = total_items - needs_review
        
        total_cost = results_df['Total Cost'].sum()
        total_margin = results_df['Total Margin'].sum()
        avg_margin_pct = results_df['Margin %'].mean()
        
        summary = {
            'total_cost': round(total_cost, 2),
            'total_margin': round(total_margin, 2),
            'avg_margin_pct': round(avg_margin_pct, 2),
            'with_stock_data': len(stock_data) > 0,
            'with_sales_data': len(sales_data) > 0
        }
        
        # Save results to Excel with formatting
        output_path = f"/app/uploads/{upload_id}_processed.xlsx"
        create_excel_with_formatting(results_df, output_path)
        
        # Convert numpy types to native Python (MongoDB can't encode np.int64/float64)
        results_records = json.loads(results_df.to_json(orient='records'))

        # Store in database
        upload_record = {
            "upload_id": upload_id,
            "filename": po_file.filename,
            "user_id": user.get('_id') or user.get('id'),
            "total_items": total_items,
            "needs_review": int(needs_review),
            "approved": int(approved),
            "summary": json.loads(json.dumps(summary, default=str)),
            "results": results_records,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "settings_used": settings,
            "has_stock_data": len(stock_data) > 0,
            "has_sales_data": len(sales_data) > 0
        }
        await db.uploads.insert_one(upload_record)
        
        return {
            "upload_id": upload_id,
            "filename": po_file.filename,
            "total_items": total_items,
            "needs_review": int(needs_review),
            "approved": int(approved),
            "timestamp": upload_record['timestamp'],
            "summary": summary,
            "results": results_records
        }
        
    except Exception as e:
        logging.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.get("/history")
async def get_history(request: Request):
    await get_current_user(request)
    
    uploads = await db.uploads.find(
        {},
        {"_id": 0, "upload_id": 1, "filename": 1, "total_items": 1, "needs_review": 1, "approved": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return uploads

@api_router.post("/download/{upload_id}")
async def download_file(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get the updated results from request body
    body = await request.json()
    updated_results = body.get('results', [])
    
    # Create Excel with approval status
    output_path = f"/app/uploads/{upload_id}_final.xlsx"
    create_excel_with_approval(updated_results, output_path)
    
    return FileResponse(
        path=output_path,
        filename=f"po_analysis_{upload_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@api_router.get("/results/{upload_id}")
async def get_results(upload_id: str, request: Request):
    await get_current_user(request)
    
    upload = await db.uploads.find_one({"upload_id": upload_id}, {"_id": 0})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return upload

# === Admin Seeding ===
@app.on_event("startup")
async def startup_event():
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@poreview.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logging.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logging.info(f"Admin password updated: {admin_email}")
    
    # Write test credentials
    with open('/app/memory/test_credentials.md', 'w') as f:
        f.write(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## API Endpoints
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
- GET /api/settings
- POST /api/settings
- POST /api/upload (supports multiple files: po_file, stock_file, sales_file)
- GET /api/history
- GET /api/download/{{upload_id}}
- GET /api/results/{{upload_id}}
""")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.uploads.create_index("upload_id")
    await db.uploads.create_index("timestamp")
    
    logging.info("Application startup complete")

# Include router
app.include_router(api_router)

# CORS - Must be after router inclusion
frontend_origin = os.environ.get('FRONTEND_ORIGIN', 'https://po-review-hub.preview.emergentagent.com')
allowed_origins = [frontend_origin, 'http://localhost:3000']

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
