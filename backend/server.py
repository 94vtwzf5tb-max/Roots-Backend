"""ROOTS Ambala City Order Sheet — Backend API"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict

# ────────────────────────────────────────────────────────────
# Setup
# ────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roots")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ROOTS Order Sheet API")
api = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

ORDER_CYCLES = [f"O{i}" for i in range(1, 11)]

# ────────────────────────────────────────────────────────────
# Utilities
# ────────────────────────────────────────────────────────────

def to_str_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(to_str_id)]

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode(
        {"sub": user_id, "email": email, "type": "access",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=60)},
        JWT_SECRET, algorithm=JWT_ALGO,
    )

def create_refresh_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "type": "refresh",
         "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        JWT_SECRET, algorithm=JWT_ALGO,
    )

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False,
                        samesite="lax", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False,
                        samesite="lax", max_age=604800, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

# ────────────────────────────────────────────────────────────
# Pydantic Models
# ────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str = "operator"  # admin, cantt_outlet, city_outlet, operator

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class Settings(BaseModel):
    current_cycle: str = "O1"
    weeks_in_month: float = 5
    orders_per_week: float = 2
    total_cycles: int = 10
    default_buffer_pct: float = 0.02
    wastage_alert_pct: float = 0.05
    order_value_alert_pct: float = 0.5
    business_name: str = "ROOTS"

class Recipe(BaseModel):
    id: Optional[str] = None
    ingredient: str
    unit: str = "g/ml/pcs"
    sku_menu_item: str
    qty_per_sku: float = 0
    cost_per_unit: float = 0
    category: str = "Other"
    selling_price: float = 0

class SkuForecast(BaseModel):
    id: Optional[str] = None
    sku_menu_item: str
    category: str = "Other"
    selling_price: float = 0
    last_sales: Dict[str, float] = Field(default_factory=dict)
    forecast: Dict[str, float] = Field(default_factory=dict)

class IngredientMeta(BaseModel):
    id: Optional[str] = None
    ingredient: str
    unit: str = "g/ml/pcs"
    cost_per_unit: float = 0
    yield_pct: float = 1.0
    buffer_pct: float = 0.02
    stock_category: str = "DRY STOCK"  # FROZEN, DRY STOCK, MISE-EN, BREADS, DIARY
    inventory: Dict[str, float] = Field(default_factory=dict)
    wastage: Dict[str, float] = Field(default_factory=dict)
    delivered: Dict[str, float] = Field(default_factory=dict)
    received: Dict[str, float] = Field(default_factory=dict)

# ────────────────────────────────────────────────────────────
# Startup
# ────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.recipes.create_index([("ingredient", 1), ("sku_menu_item", 1)], unique=True)
    await db.forecasts.create_index("sku_menu_item", unique=True)
    await db.ingredients.create_index("ingredient", unique=True)

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@roots.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    # Ensure default settings exist
    settings = await db.settings.find_one({"_id": "singleton"})
    if not settings:
        default = Settings().model_dump()
        default["_id"] = "singleton"
        await db.settings.insert_one(default)

    logger.info("Startup complete")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ────────────────────────────────────────────────────────────
# Auth Endpoints
# ────────────────────────────────────────────────────────────

@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": data.name, "role": data.role}

@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": user["name"], "role": user["role"]}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}

# ────────────────────────────────────────────────────────────
# Settings
# ────────────────────────────────────────────────────────────

@api.get("/settings")
async def get_settings(_: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"_id": "singleton"})
    if not s:
        s = Settings().model_dump()
    s.pop("_id", None)
    return s

@api.put("/settings")
async def update_settings(data: Settings, _: dict = Depends(get_current_user)):
    doc = data.model_dump()
    doc["_id"] = "singleton"
    await db.settings.replace_one({"_id": "singleton"}, doc, upsert=True)
    return data

# ────────────────────────────────────────────────────────────
# Recipes CRUD
# ────────────────────────────────────────────────────────────

def _clean_doc(doc):
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc

@api.get("/recipes")
async def list_recipes(_: dict = Depends(get_current_user)):
    docs = await db.recipes.find().to_list(5000)
    return [_clean_doc(d) for d in docs]

@api.post("/recipes")
async def create_recipe(data: Recipe, _: dict = Depends(get_current_user)):
    doc = data.model_dump(exclude={"id"})
    try:
        res = await db.recipes.insert_one(doc)
    except Exception as e:
        raise HTTPException(400, f"Duplicate ingredient+SKU pair: {e}")
    # insert_one mutates doc to include ObjectId _id — strip it before returning
    doc.pop("_id", None)
    doc["id"] = str(res.inserted_id)
    # Auto-create/update ingredient metadata
    await _upsert_ingredient(data.ingredient, data.unit, data.cost_per_unit)
    # Auto-create/update SKU forecast entry
    await _upsert_forecast(data.sku_menu_item, data.category, data.selling_price)
    return doc

@api.put("/recipes/{rid}")
async def update_recipe(rid: str, data: Recipe, _: dict = Depends(get_current_user)):
    doc = data.model_dump(exclude={"id"})
    await db.recipes.update_one({"_id": ObjectId(rid)}, {"$set": doc})
    await _upsert_ingredient(data.ingredient, data.unit, data.cost_per_unit)
    await _upsert_forecast(data.sku_menu_item, data.category, data.selling_price)
    return {**doc, "id": rid}

@api.delete("/recipes/{rid}")
async def delete_recipe(rid: str, _: dict = Depends(get_current_user)):
    await db.recipes.delete_one({"_id": ObjectId(rid)})
    return {"ok": True}

async def _upsert_ingredient(name: str, unit: str, cost: float):
    existing = await db.ingredients.find_one({"ingredient": name})
    if not existing:
        await db.ingredients.insert_one({
            "ingredient": name, "unit": unit, "cost_per_unit": cost,
            "yield_pct": 1.0, "buffer_pct": 0.02, "stock_category": "DRY STOCK",
            "inventory": {}, "wastage": {}, "delivered": {}, "received": {},
        })
    else:
        # Update cost if changed
        if existing.get("cost_per_unit", 0) != cost and cost > 0:
            await db.ingredients.update_one(
                {"ingredient": name}, {"$set": {"cost_per_unit": cost, "unit": unit}}
            )

async def _upsert_forecast(sku: str, category: str, price: float):
    existing = await db.forecasts.find_one({"sku_menu_item": sku})
    if not existing:
        await db.forecasts.insert_one({
            "sku_menu_item": sku, "category": category, "selling_price": price,
            "last_sales": {}, "forecast": {},
        })
    else:
        await db.forecasts.update_one(
            {"sku_menu_item": sku},
            {"$set": {"category": category, "selling_price": price}}
        )

# ────────────────────────────────────────────────────────────
# SKU Forecast
# ────────────────────────────────────────────────────────────

@api.get("/forecasts")
async def list_forecasts(_: dict = Depends(get_current_user)):
    docs = await db.forecasts.find().to_list(5000)
    return [_clean_doc(d) for d in docs]

@api.put("/forecasts/{fid}")
async def update_forecast(fid: str, data: SkuForecast, _: dict = Depends(get_current_user)):
    doc = data.model_dump(exclude={"id"})
    await db.forecasts.update_one({"_id": ObjectId(fid)}, {"$set": doc})
    return {**doc, "id": fid}

# ────────────────────────────────────────────────────────────
# Ingredients
# ────────────────────────────────────────────────────────────

@api.get("/ingredients")
async def list_ingredients(_: dict = Depends(get_current_user)):
    docs = await db.ingredients.find().to_list(5000)
    return [_clean_doc(d) for d in docs]

@api.put("/ingredients/{iid}")
async def update_ingredient(iid: str, data: IngredientMeta, _: dict = Depends(get_current_user)):
    doc = data.model_dump(exclude={"id"})
    await db.ingredients.update_one({"_id": ObjectId(iid)}, {"$set": doc})
    return {**doc, "id": iid}

# ────────────────────────────────────────────────────────────
# Planning / Order Generation
# ────────────────────────────────────────────────────────────

async def _compute_planning():
    """Compute required, to_order, order_value per ingredient per cycle."""
    recipes = await db.recipes.find().to_list(5000)
    forecasts = await db.forecasts.find().to_list(5000)
    ingredients = await db.ingredients.find().to_list(5000)

    forecast_map = {f["sku_menu_item"]: f.get("forecast", {}) for f in forecasts}
    ing_map = {i["ingredient"]: i for i in ingredients}

    # Compute required per ingredient per cycle
    required: Dict[str, Dict[str, float]] = {}
    sku_count: Dict[str, int] = {}
    for r in recipes:
        ing = r["ingredient"]
        sku = r["sku_menu_item"]
        qty_per = float(r.get("qty_per_sku", 0) or 0)
        if ing not in required:
            required[ing] = {c: 0.0 for c in ORDER_CYCLES}
            sku_count[ing] = 0
        sku_count[ing] += 1
        fc = forecast_map.get(sku, {})
        for c in ORDER_CYCLES:
            required[ing][c] += qty_per * float(fc.get(c, 0) or 0)

    # Build result rows
    results = []
    for ing_name, req_map in required.items():
        meta = ing_map.get(ing_name, {})
        cost = float(meta.get("cost_per_unit", 0) or 0)
        yield_pct = float(meta.get("yield_pct", 1) or 1) or 1
        buffer_pct = float(meta.get("buffer_pct", 0.02) or 0.02)
        inventory = meta.get("inventory", {}) or {}
        wastage = meta.get("wastage", {}) or {}
        delivered = meta.get("delivered", {}) or {}
        received = meta.get("received", {}) or {}

        cycles_out = {}
        monthly_qty = 0.0
        monthly_value = 0.0
        for c in ORDER_CYCLES:
            req = req_map.get(c, 0.0)
            inv = float(inventory.get(c, 0) or 0)
            wast = float(wastage.get(c, 0) or 0)
            deficit = max(0.0, req - inv + wast)
            to_order = round(deficit * (1 + buffer_pct) / yield_pct, 2)
            order_value = round(to_order * cost, 2)
            cycles_out[c] = {
                "required": round(req, 2),
                "inventory": inv,
                "wastage": wast,
                "to_order": to_order,
                "order_value": order_value,
                "delivered": float(delivered.get(c, 0) or 0),
                "received": float(received.get(c, 0) or 0),
            }
            monthly_qty += to_order
            monthly_value += order_value

        results.append({
            "ingredient": ing_name,
            "id": str(meta.get("_id", "")),
            "unit": meta.get("unit", "g/ml/pcs"),
            "no_of_skus": sku_count[ing_name],
            "cost_per_unit": cost,
            "yield_pct": yield_pct,
            "buffer_pct": buffer_pct,
            "stock_category": meta.get("stock_category", "DRY STOCK"),
            "cycles": cycles_out,
            "monthly_qty": round(monthly_qty, 2),
            "monthly_value": round(monthly_value, 2),
        })
    return results

@api.get("/planning")
async def get_planning(_: dict = Depends(get_current_user)):
    return await _compute_planning()

@api.get("/order/{cycle}")
async def get_order(cycle: str, _: dict = Depends(get_current_user)):
    """Return the to-order list for a specific cycle, grouped by stock category."""
    if cycle not in ORDER_CYCLES:
        raise HTTPException(400, f"Invalid cycle: {cycle}")
    rows = await _compute_planning()
    result = []
    for r in rows:
        c = r["cycles"][cycle]
        result.append({
            "id": r["id"],
            "ingredient": r["ingredient"],
            "unit": r["unit"],
            "stock_category": r["stock_category"],
            "cost_per_unit": r["cost_per_unit"],
            "required": c["required"],
            "inventory": c["inventory"],
            "wastage": c["wastage"],
            "to_order": c["to_order"],
            "rounded_qty": round(c["to_order"]),
            "order_value": c["order_value"],
            "delivered": c["delivered"],
            "received": c["received"],
            "variance": round(c["delivered"] - c["received"], 2),
        })
    return result

# ────────────────────────────────────────────────────────────
# Owner Summary / KPIs
# ────────────────────────────────────────────────────────────

@api.get("/summary")
async def summary(_: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"_id": "singleton"}) or Settings().model_dump()
    settings.pop("_id", None)
    rows = await _compute_planning()
    forecasts = await db.forecasts.find().to_list(5000)

    # Per-cycle KPIs
    cycles_kpi = []
    for c in ORDER_CYCLES:
        order_value = sum(r["cycles"][c]["order_value"] for r in rows)
        wastage_total = sum(r["cycles"][c]["wastage"] * r["cost_per_unit"] for r in rows)
        inventory_val = sum(r["cycles"][c]["inventory"] * r["cost_per_unit"] for r in rows)
        forecast_sales = sum(
            float((f.get("forecast", {}) or {}).get(c, 0) or 0) * float(f.get("selling_price", 0) or 0)
            for f in forecasts
        )
        items_to_order = sum(1 for r in rows if r["cycles"][c]["to_order"] > 0)
        wastage_pct = (wastage_total / order_value * 100) if order_value > 0 else 0
        cycles_kpi.append({
            "cycle": c,
            "forecast_sales": round(forecast_sales, 2),
            "order_value": round(order_value, 2),
            "wastage_value": round(wastage_total, 2),
            "wastage_pct": round(wastage_pct, 2),
            "inventory_value": round(inventory_val, 2),
            "items_to_order": items_to_order,
        })

    total_forecast_sales = sum(k["forecast_sales"] for k in cycles_kpi)
    total_order_value = sum(k["order_value"] for k in cycles_kpi)
    total_wastage = sum(k["wastage_value"] for k in cycles_kpi)
    avg_wastage_pct = (total_wastage / total_order_value * 100) if total_order_value > 0 else 0
    order_to_sales_ratio = (total_order_value / total_forecast_sales * 100) if total_forecast_sales > 0 else 0

    # Health score (100 = perfect, penalize wastage & high order ratio)
    wastage_penalty = min(50, avg_wastage_pct * 5)
    ratio_penalty = min(30, max(0, order_to_sales_ratio - settings.get("order_value_alert_pct", 0.5) * 100))
    health_score = max(0, round(100 - wastage_penalty - ratio_penalty))

    return {
        "current_cycle": settings.get("current_cycle", "O1"),
        "business_name": settings.get("business_name", "ROOTS"),
        "total_ingredients": len(rows),
        "total_skus": len(forecasts),
        "monthly_forecast_sales": round(total_forecast_sales, 2),
        "monthly_order_value": round(total_order_value, 2),
        "monthly_wastage_value": round(total_wastage, 2),
        "avg_wastage_pct": round(avg_wastage_pct, 2),
        "order_to_sales_ratio_pct": round(order_to_sales_ratio, 2),
        "health_score": health_score,
        "cycles": cycles_kpi,
    }

# ────────────────────────────────────────────────────────────
# Variance Check
# ────────────────────────────────────────────────────────────

@api.get("/variance/{cycle}")
async def variance_check(cycle: str, _: dict = Depends(get_current_user)):
    if cycle not in ORDER_CYCLES:
        raise HTTPException(400, f"Invalid cycle: {cycle}")
    rows = await _compute_planning()
    forecasts = await db.forecasts.find().to_list(5000)
    recipes = await db.recipes.find().to_list(5000)

    # Sales consumption per ingredient = sum(recipes.qty_per_sku * forecast.forecast[cycle])
    forecast_map = {f["sku_menu_item"]: (f.get("forecast", {}) or {}).get(cycle, 0) for f in forecasts}
    consumption: Dict[str, float] = {}
    for r in recipes:
        ing = r["ingredient"]
        qty = float(r.get("qty_per_sku", 0) or 0)
        sold = float(forecast_map.get(r["sku_menu_item"], 0) or 0)
        consumption[ing] = consumption.get(ing, 0) + qty * sold

    result = []
    for r in rows:
        c = r["cycles"][cycle]
        sales_consumption = round(consumption.get(r["ingredient"], 0), 2)
        expected_balance = round(c["inventory"] + c["received"] - sales_consumption - c["wastage"], 2)
        variance_qty = round(c["received"] - c["delivered"], 2)
        variance_value = round(variance_qty * r["cost_per_unit"], 2)
        status_flag = "OK"
        if abs(variance_qty) > 0.01:
            status_flag = "CHECK"
        if c["delivered"] > 0 and c["received"] == 0:
            status_flag = "MISSING"
        result.append({
            "ingredient": r["ingredient"],
            "unit": r["unit"],
            "sales_consumption": sales_consumption,
            "expected_balance": expected_balance,
            "delivered": c["delivered"],
            "received": c["received"],
            "wastage": c["wastage"],
            "variance_qty": variance_qty,
            "variance_value": variance_value,
            "status": status_flag,
        })
    return result

# ────────────────────────────────────────────────────────────
# CORS & Mount
# ────────────────────────────────────────────────────────────

app.include_router(api)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@api.get("/")
async def root():
    return {"message": "ROOTS Order Sheet API"}
