"""ROOTS Order Sheet – Backend API pytest suite."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://excel-app-builder-32.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@roots.com"
ADMIN_PASSWORD = "admin123"

TEST_PREFIX = f"TEST_{uuid.uuid4().hex[:6]}_"


# ────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def created_recipes(admin_session):
    """Create the recipe fixtures needed for end-to-end tests. Returns list of ids."""
    recipes = [
        {
            "ingredient": f"{TEST_PREFIX}Iceberg Lettuce",
            "unit": "g",
            "sku_menu_item": f"{TEST_PREFIX}Veg Grilled Sandwich",
            "category": "Sandwich & Burgers",
            "qty_per_sku": 20,
            "cost_per_unit": 0.5,
            "selling_price": 150,
        },
        {
            "ingredient": f"{TEST_PREFIX}White Bread",
            "unit": "pcs",
            "sku_menu_item": f"{TEST_PREFIX}Veg Grilled Sandwich",
            "category": "Sandwich & Burgers",
            "qty_per_sku": 2,
            "cost_per_unit": 3,
            "selling_price": 150,
        },
    ]
    ids = []
    for rec in recipes:
        r = admin_session.post(f"{API}/recipes", json=rec, timeout=10)
        assert r.status_code == 200, f"create recipe failed: {r.text}"
        ids.append(r.json()["id"])
    yield ids
    # Teardown
    for rid in ids:
        admin_session.delete(f"{API}/recipes/{rid}")


# ────────────────────────────────────────────────────────────
# Auth
# ────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_admin_success(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "access_token" in s.cookies

    def test_login_invalid_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_returns_user(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_register_and_autologin(self):
        s = requests.Session()
        email = f"{TEST_PREFIX}user_{uuid.uuid4().hex[:6]}@test.com".lower()
        payload = {"email": email, "password": "pass1234", "name": "Test User", "role": "operator"}
        r = s.post(f"{API}/auth/register", json=payload, timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == email
        # Cookie set → /auth/me should work
        r2 = s.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["email"] == email

    def test_register_duplicate_email(self):
        s = requests.Session()
        email = f"{TEST_PREFIX}dup_{uuid.uuid4().hex[:6]}@test.com".lower()
        payload = {"email": email, "password": "pass1234", "name": "Dup", "role": "operator"}
        r1 = s.post(f"{API}/auth/register", json=payload, timeout=10)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/auth/register", json=payload, timeout=10)
        assert r2.status_code == 400

    def test_logout_clears_cookie(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        assert s.get(f"{API}/auth/me", timeout=10).status_code == 200
        r = s.post(f"{API}/auth/logout", timeout=10)
        assert r.status_code == 200
        # Session cookies should be gone → me returns 401
        s2 = requests.Session()
        r2 = s2.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 401


# ────────────────────────────────────────────────────────────
# Settings
# ────────────────────────────────────────────────────────────

class TestSettings:
    def test_get_settings(self, admin_session):
        r = admin_session.get(f"{API}/settings", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "current_cycle" in data
        assert "business_name" in data
        assert "_id" not in data  # ObjectId excluded

    def test_update_settings_persists(self, admin_session):
        r = admin_session.get(f"{API}/settings", timeout=10)
        original = r.json()
        new_name = f"{TEST_PREFIX}RootsTest"
        payload = {**original, "business_name": new_name, "current_cycle": "O2"}
        r2 = admin_session.put(f"{API}/settings", json=payload, timeout=10)
        assert r2.status_code == 200
        r3 = admin_session.get(f"{API}/settings", timeout=10)
        assert r3.json()["business_name"] == new_name
        assert r3.json()["current_cycle"] == "O2"
        # Restore
        admin_session.put(f"{API}/settings", json=original)


# ────────────────────────────────────────────────────────────
# Recipes CRUD + auto-population
# ────────────────────────────────────────────────────────────

class TestRecipes:
    def test_recipes_requires_auth(self):
        r = requests.get(f"{API}/recipes", timeout=10)
        assert r.status_code == 401

    def test_create_recipe_creates_ingredient_and_forecast(self, admin_session):
        payload = {
            "ingredient": f"{TEST_PREFIX}TestIng_{uuid.uuid4().hex[:4]}",
            "unit": "g",
            "sku_menu_item": f"{TEST_PREFIX}TestSku_{uuid.uuid4().hex[:4]}",
            "category": "Pizza",
            "qty_per_sku": 5,
            "cost_per_unit": 2.5,
            "selling_price": 100,
        }
        r = admin_session.post(f"{API}/recipes", json=payload, timeout=10)
        assert r.status_code == 200
        created = r.json()
        assert created["ingredient"] == payload["ingredient"]
        rid = created["id"]

        # GET recipe list contains it
        recs = admin_session.get(f"{API}/recipes").json()
        assert any(r["id"] == rid for r in recs)

        # Ingredient auto-created
        ings = admin_session.get(f"{API}/ingredients").json()
        assert any(i["ingredient"] == payload["ingredient"] for i in ings)

        # Forecast auto-created
        fcs = admin_session.get(f"{API}/forecasts").json()
        assert any(f["sku_menu_item"] == payload["sku_menu_item"] for f in fcs)

        # Cleanup
        admin_session.delete(f"{API}/recipes/{rid}")

    def test_update_recipe(self, admin_session):
        payload = {
            "ingredient": f"{TEST_PREFIX}UpdIng_{uuid.uuid4().hex[:4]}",
            "unit": "g", "sku_menu_item": f"{TEST_PREFIX}UpdSku_{uuid.uuid4().hex[:4]}",
            "category": "Other", "qty_per_sku": 1, "cost_per_unit": 1, "selling_price": 10,
        }
        r = admin_session.post(f"{API}/recipes", json=payload)
        rid = r.json()["id"]
        upd = {**payload, "qty_per_sku": 99, "cost_per_unit": 5}
        r2 = admin_session.put(f"{API}/recipes/{rid}", json=upd)
        assert r2.status_code == 200
        recs = admin_session.get(f"{API}/recipes").json()
        target = [x for x in recs if x["id"] == rid][0]
        assert target["qty_per_sku"] == 99
        assert target["cost_per_unit"] == 5
        admin_session.delete(f"{API}/recipes/{rid}")

    def test_delete_recipe(self, admin_session):
        payload = {
            "ingredient": f"{TEST_PREFIX}DelIng_{uuid.uuid4().hex[:4]}",
            "unit": "g", "sku_menu_item": f"{TEST_PREFIX}DelSku_{uuid.uuid4().hex[:4]}",
            "category": "Other", "qty_per_sku": 1, "cost_per_unit": 1, "selling_price": 10,
        }
        rid = admin_session.post(f"{API}/recipes", json=payload).json()["id"]
        r = admin_session.delete(f"{API}/recipes/{rid}")
        assert r.status_code == 200
        recs = admin_session.get(f"{API}/recipes").json()
        assert not any(x["id"] == rid for x in recs)


# ────────────────────────────────────────────────────────────
# End-to-end order generation flow
# ────────────────────────────────────────────────────────────

class TestOrderFlow:
    def test_forecasts_endpoint(self, admin_session, created_recipes):
        r = admin_session.get(f"{API}/forecasts")
        assert r.status_code == 200
        skus = [f["sku_menu_item"] for f in r.json()]
        assert f"{TEST_PREFIX}Veg Grilled Sandwich" in skus

    def test_update_forecast_o1_and_planning(self, admin_session, created_recipes):
        fcs = admin_session.get(f"{API}/forecasts").json()
        fc = [f for f in fcs if f["sku_menu_item"] == f"{TEST_PREFIX}Veg Grilled Sandwich"][0]
        fid = fc["id"]
        payload = {**fc, "forecast": {**fc.get("forecast", {}), "O1": 20}}
        payload.pop("id", None)
        r = admin_session.put(f"{API}/forecasts/{fid}", json=payload)
        assert r.status_code == 200

        # Verify persistence
        fc2 = [f for f in admin_session.get(f"{API}/forecasts").json() if f["id"] == fid][0]
        assert fc2["forecast"].get("O1") == 20

        # Planning: iceberg lettuce required O1 = 20 * 20 = 400
        planning = admin_session.get(f"{API}/planning").json()
        ice = [p for p in planning if p["ingredient"] == f"{TEST_PREFIX}Iceberg Lettuce"][0]
        assert ice["cycles"]["O1"]["required"] == 400
        # White Bread required = 20 * 2 = 40
        bread = [p for p in planning if p["ingredient"] == f"{TEST_PREFIX}White Bread"][0]
        assert bread["cycles"]["O1"]["required"] == 40

    def test_planning_inventory_and_to_order(self, admin_session, created_recipes):
        ings = admin_session.get(f"{API}/ingredients").json()
        ice = [i for i in ings if i["ingredient"] == f"{TEST_PREFIX}Iceberg Lettuce"][0]
        iid = ice["id"]
        payload = {**ice, "inventory": {**ice.get("inventory", {}), "O1": 100}}
        payload.pop("id", None)
        r = admin_session.put(f"{API}/ingredients/{iid}", json=payload)
        assert r.status_code == 200

        # to_order for iceberg O1 = max(0, 400 - 100 + 0) * (1 + 0.02) / 1 = 306.0
        planning = admin_session.get(f"{API}/planning").json()
        ice_p = [p for p in planning if p["ingredient"] == f"{TEST_PREFIX}Iceberg Lettuce"][0]
        to_order = ice_p["cycles"]["O1"]["to_order"]
        assert abs(to_order - 306.0) < 0.01, f"expected 306 got {to_order}"

    def test_order_endpoint_and_variance(self, admin_session, created_recipes):
        # Get order for O1
        r = admin_session.get(f"{API}/order/O1")
        assert r.status_code == 200
        rows = r.json()
        ice = [x for x in rows if x["ingredient"] == f"{TEST_PREFIX}Iceberg Lettuce"][0]
        assert ice["to_order"] == 306.0
        assert ice["rounded_qty"] == 306

        # Update delivered/received on iceberg lettuce
        ings = admin_session.get(f"{API}/ingredients").json()
        ice_i = [i for i in ings if i["ingredient"] == f"{TEST_PREFIX}Iceberg Lettuce"][0]
        iid = ice_i["id"]
        payload = {
            **ice_i,
            "delivered": {**ice_i.get("delivered", {}), "O1": 310},
            "received": {**ice_i.get("received", {}), "O1": 305},
        }
        payload.pop("id", None)
        r2 = admin_session.put(f"{API}/ingredients/{iid}", json=payload)
        assert r2.status_code == 200

        # Order endpoint variance = delivered - received = 5
        order = admin_session.get(f"{API}/order/O1").json()
        ice_o = [x for x in order if x["ingredient"] == f"{TEST_PREFIX}Iceberg Lettuce"][0]
        assert ice_o["delivered"] == 310
        assert ice_o["received"] == 305
        assert ice_o["variance"] == 5.0

        # Variance endpoint (variance_qty = received - delivered = -5, status = CHECK)
        var = admin_session.get(f"{API}/variance/O1").json()
        ice_v = [x for x in var if x["ingredient"] == f"{TEST_PREFIX}Iceberg Lettuce"][0]
        assert ice_v["variance_qty"] == -5.0
        assert ice_v["status"] == "CHECK"

    def test_order_invalid_cycle(self, admin_session):
        r = admin_session.get(f"{API}/order/O99")
        assert r.status_code == 400

    def test_variance_invalid_cycle(self, admin_session):
        r = admin_session.get(f"{API}/variance/O99")
        assert r.status_code == 400


# ────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────

class TestSummary:
    def test_summary_returns_10_cycles(self, admin_session):
        r = admin_session.get(f"{API}/summary")
        assert r.status_code == 200
        data = r.json()
        assert len(data["cycles"]) == 10
        assert all(c["cycle"] in [f"O{i}" for i in range(1, 11)] for c in data["cycles"])
        assert "health_score" in data
        assert 0 <= data["health_score"] <= 100


# ────────────────────────────────────────────────────────────
# Cleanup (session teardown)
# ────────────────────────────────────────────────────────────

def teardown_module(module):
    """Delete any leftover TEST_ data."""
    try:
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        # Delete test recipes
        for rec in s.get(f"{API}/recipes").json():
            if TEST_PREFIX in rec.get("ingredient", "") or TEST_PREFIX in rec.get("sku_menu_item", ""):
                s.delete(f"{API}/recipes/{rec['id']}")
    except Exception as e:
        print(f"cleanup error: {e}")
