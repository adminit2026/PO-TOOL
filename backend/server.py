"""
Main FastAPI application for PO Review System
Refactored to use modular services and utilities
"""
from dotenv import load_dotenv
from pathlib import Path
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from datetime import datetime, timezone
import uuid
import pandas as pd
import json
import shutil

# Import local modules
from models import LoginRequest, SignupRequest, User, SettingsModel, UploadResult
from utils.auth import (
    hash_password, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    get_current_user
)
from services.file_processing import (
    load_stock_data,
    load_sales_data,
    calculate_order_costs
)
from services.smart_column_detector import load_excel_with_smart_detection
from services.excel_generators import (
    create_excel_with_approval,
    create_export_file,
    create_box_file,
    create_production_sheets,
    create_ean_list_csv_by_location,
    create_packing_list
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000'),
        "https://preview.emergentagent.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Auth Endpoints ===
@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    """User login endpoint"""
    email = request.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
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
    """Get current user info"""
    user = await get_current_user(request, db)
    return user


@api_router.post("/auth/logout")
async def logout(response: Response):
    """User logout endpoint"""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


@api_router.post("/auth/signup")
async def signup(request: SignupRequest, response: Response):
    """User signup with invite code"""
    invite_codes = {
        "IMAPPROVER1": "approver",
        "IMADMIN1": "admin"
    }
    
    if request.invite_code not in invite_codes:
        raise HTTPException(status_code=400, detail="Invalid invite code")
    
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    role = invite_codes[request.invite_code]
    hashed_password = hash_password(request.password)
    
    user_data = {
        "email": request.email,
        "password_hash": hashed_password,
        "name": request.name,
        "role": role,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(user_data)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, request.email)
    refresh_token = create_refresh_token(user_id)
    
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
        "email": request.email,
        "name": request.name,
        "role": role
    }


# === Settings Endpoints ===
@api_router.get("/settings")
async def get_settings(request: Request):
    """Get user settings"""
    user = await get_current_user(request, db)
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not settings:
        default_settings = SettingsModel().dict()
        return default_settings
    
    return settings


@api_router.post("/settings")
async def update_settings(settings: SettingsModel, request: Request):
    """Update user settings"""
    user = await get_current_user(request, db)
    settings_data = settings.dict()
    settings_data["user_id"] = user["id"]
    
    await db.settings.update_one(
        {"user_id": user["id"]},
        {"$set": settings_data},
        upsert=True
    )
    return {"message": "Settings updated successfully"}


# === File Upload Endpoint ===
@api_router.post("/upload")
async def upload_files(
    request: Request,
    po_file: UploadFile = File(...),
    stock_file: UploadFile = File(None),
    sales_file: UploadFile = File(None)
):
    """Process uploaded Excel files"""
    user = await get_current_user(request, db)
    upload_id = str(uuid.uuid4())[:8]
    upload_dir = Path(f"/tmp/po_uploads_{upload_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Save PO file
        po_path = upload_dir / f"po_{po_file.filename}"
        with open(po_path, "wb") as buffer:
            content = await po_file.read()
            buffer.write(content)
        
        # Load PO data with smart column detection
        import time
        start_time = time.time()
        df, column_mapping = load_excel_with_smart_detection(str(po_path))
        logging.info(f"Smart detection found columns: {column_mapping}")
        logging.info(f"Loaded {len(df)} rows from PO file in {time.time() - start_time:.2f}s")
        
        # Load optional files
        stock_data = {}
        sales_data = {}
        
        if stock_file:
            stock_path = upload_dir / f"stock_{stock_file.filename}"
            with open(stock_path, "wb") as buffer:
                content = await stock_file.read()
                buffer.write(content)
            stock_data = load_stock_data(str(stock_path))
        
        if sales_file:
            sales_path = upload_dir / f"sales_{sales_file.filename}"
            with open(sales_path, "wb") as buffer:
                content = await sales_file.read()
                buffer.write(content)
            sales_data = load_sales_data(str(sales_path))
        
        # Get user settings
        settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
        if not settings:
            settings = SettingsModel().dict()
        
        # Calculate costs and margins
        calc_start = time.time()
        results_df = calculate_order_costs(df, settings, stock_data, sales_data)
        logging.info(f"Calculated margins for {len(results_df)} items in {time.time() - calc_start:.2f}s")
        results_list = results_df.to_dict('records')
        
        # Add default approval status and box numbers
        for item in results_list:
            item['Approval Status'] = 'pending'
            item['Box Number'] = ''
        
        # Count items needing review
        needs_review_count = sum(1 for item in results_list if item.get('Needs Review', False))
        
        # Save to MongoDB
        upload_data = {
            "upload_id": upload_id,
            "user_id": user["id"],
            "user_email": user["email"],
            "filename": po_file.filename,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_items": len(results_list),
            "needs_review": needs_review_count,
            "approved": 0,
            "results": results_list
        }
        
        await db.uploads.insert_one(upload_data)
        
        return {
            "upload_id": upload_id,
            "filename": po_file.filename,
            "total_items": len(results_list),
            "needs_review": needs_review_count,
            "approved": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "results": results_list,
            "summary": {"message": "Upload processed successfully"}
        }
        
    except Exception as e:
        logging.error(f"Error processing upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing files: {str(e)}")
    finally:
        if upload_dir.exists():
            shutil.rmtree(upload_dir)


# === History Endpoints ===
@api_router.get("/history")
async def get_history(request: Request):
    """Get upload history for current user"""
    user = await get_current_user(request, db)
    uploads = await db.uploads.find(
        {"user_id": user["id"]},
        {"_id": 0, "results": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)
    return uploads


@api_router.get("/upload/{upload_id}")
async def get_upload(upload_id: str, request: Request):
    """Get specific upload data"""
    user = await get_current_user(request, db)
    upload = await db.uploads.find_one(
        {"upload_id": upload_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return upload


# === Download Endpoints ===
@api_router.post("/download/{upload_id}")
async def download_file(upload_id: str, request: Request):
    """Download Analysis Excel file"""
    user = await get_current_user(request, db)
    
    try:
        # Get results from request body
        body = await request.json()
        results_list = body.get('results', [])
        
        output_path = f"/tmp/analysis_{upload_id}.xlsx"
        create_excel_with_approval(results_list, output_path)
        
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"po_analysis_{upload_id}.xlsx"
        )
    except Exception as e:
        logging.error(f"Error creating analysis file: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating file")


@api_router.post("/download-export/{upload_id}")
async def download_export_file(upload_id: str, request: Request):
    """Download EXPORT Excel file"""
    user = await get_current_user(request, db)
    
    try:
        body = await request.json()
        results_list = body.get('results', [])
        approved_items = [item for item in results_list if item.get('Approval Status') == 'approved']
        
        output_path = f"/tmp/export_{upload_id}.xlsx"
        create_export_file(approved_items, output_path)
        
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="EXPORT.xlsx"
        )
    except Exception as e:
        logging.error(f"Error creating export file: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating file")


@api_router.post("/download-box/{upload_id}")
async def download_box_file(upload_id: str, request: Request):
    """Download BOX Excel file"""
    user = await get_current_user(request, db)
    
    try:
        body = await request.json()
        results_list = body.get('results', [])
        approved_items = [item for item in results_list if item.get('Approval Status') == 'approved']
        
        output_path = f"/tmp/box_{upload_id}.xlsx"
        create_box_file(approved_items, output_path)
        
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="BOX_FR.xlsx"
        )
    except Exception as e:
        logging.error(f"Error creating box file: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating file")


@api_router.post("/download-production-sheets/{upload_id}")
async def download_production_sheets(upload_id: str, request: Request):
    """Download Production Sheets Excel file"""
    user = await get_current_user(request, db)
    
    try:
        body = await request.json()
        results_list = body.get('results', [])
        approved_items = [item for item in results_list if item.get('Approval Status') == 'approved']
        
        output_path = f"/tmp/production_sheets_{upload_id}.xlsx"
        create_production_sheets(approved_items, output_path)
        
        date_str = datetime.now().strftime("%Y%m%d")
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{date_str}-ProductionSheets.xlsx"
        )
    except Exception as e:
        logging.error(f"Error creating production sheets: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating file")


@api_router.post("/download-ean-list/{upload_id}")
async def download_ean_list(upload_id: str, request: Request):
    """Download EAN List as ZIP file with separate CSVs per location"""
    user = await get_current_user(request, db)
    
    try:
        body = await request.json()
        results_list = body.get('results', [])
        approved_items = [item for item in results_list if item.get('Approval Status') == 'approved']
        
        output_dir = f"/tmp/ean_{upload_id}"
        zip_path = create_ean_list_csv_by_location(approved_items, output_dir)
        
        date_str = datetime.now().strftime("%Y%m%d")
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"{date_str}-EANLists.zip"
        )
    except Exception as e:
        logging.error(f"Error creating EAN list: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating file")


@api_router.post("/download-packing-list/{upload_id}")
async def download_packing_list(upload_id: str, request: Request):
    """Download Packing List Excel file"""
    user = await get_current_user(request, db)
    
    try:
        body = await request.json()
        results_list = body.get('results', [])
        approved_items = [item for item in results_list if item.get('Approval Status') == 'approved']
        
        output_path = f"/tmp/packing_list_{upload_id}.xlsx"
        create_packing_list(approved_items, output_path)
        
        date_str = datetime.now().strftime("%Y%m%d")
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{date_str}-PackingList.xlsx"
        )
    except Exception as e:
        logging.error(f"Error creating packing list: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating file")


@api_router.get("/results/{upload_id}")
async def get_results(upload_id: str, request: Request):
    """Get results for a specific upload"""
    user = await get_current_user(request, db)
    upload = await db.uploads.find_one(
        {"upload_id": upload_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return upload.get("results", [])


# === Startup & Shutdown Events ===
@app.on_event("startup")
async def startup_event():
    """Initialize database and create default admin"""
    try:
        # Check if admin exists
        admin = await db.users.find_one({"email": "admin@poreview.com"})
        if not admin:
            admin_data = {
                "email": "admin@poreview.com",
                "password_hash": hash_password("admin123"),
                "name": "Admin",
                "role": "admin",
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(admin_data)
            logging.info("Default admin user created")
    except Exception as e:
        logging.error(f"Startup error: {str(e)}")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Close database connection"""
    client.close()


# Mount API router
app.include_router(api_router)


# Health check endpoint
@app.get("/health")
async def health():
    return {"status": "healthy"}
