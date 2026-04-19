"""Firestore operations for FitTrack AI — uses separate 'fittrack-db' database."""
from google.cloud import firestore
import datetime as dt
import hashlib

_db = None
def _get_db():
    global _db
    if _db is None:
        _db = firestore.Client(database="fittrack-db")
    return _db

# ── Helpers ──────────────────────────────────────────────────
def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _ts(val):
    return val.isoformat() if hasattr(val, "isoformat") else val

def _doc_dict(doc):
    d = doc.to_dict()
    d["id"] = doc.id
    for k in ("created_at", "updated_at"):
        if k in d:
            d[k] = _ts(d[k])
    return d

# ── Users ────────────────────────────────────────────────────
def create_user(user_id, display_name, password, age, weight_kg, height_cm, fitness_level):
    ref = _get_db().collection("ft_users").document(user_id)
    if ref.get().exists:
        return {"error": "Username already taken"}
    data = {
        "user_id": user_id, "display_name": display_name,
        "password_hash": _hash(password),
        "age": age, "weight_kg": weight_kg, "height_cm": height_cm,
        "fitness_level": fitness_level,
        "daily_calorie_goal": 2000, "daily_water_goal_ml": 2500,
        "weekly_workout_goal": 4, "target_weight_kg": weight_kg,
        "created_at": dt.datetime.utcnow(),
    }
    ref.set(data)
    out = {k: v for k, v in data.items() if k != "password_hash"}
    out["created_at"] = _ts(out["created_at"])
    return out

def login_user(user_id, password):
    doc = _get_db().collection("ft_users").document(user_id).get()
    if not doc.exists:
        return {"error": "User not found"}
    data = doc.to_dict()
    if data["password_hash"] != _hash(password):
        return {"error": "Invalid password"}
    data.pop("password_hash")
    data["created_at"] = _ts(data.get("created_at"))
    return data

def get_user(user_id):
    doc = _get_db().collection("ft_users").document(user_id).get()
    if not doc.exists:
        return {"error": "User not found"}
    data = doc.to_dict()
    data.pop("password_hash", None)
    data["created_at"] = _ts(data.get("created_at"))
    return data

def update_user(user_id, updates):
    ref = _get_db().collection("ft_users").document(user_id)
    if not ref.get().exists:
        return {"error": "User not found"}
    ref.update(updates)
    return get_user(user_id)

# ── Workouts ─────────────────────────────────────────────────
CALORIE_RATES = {
    "running": 10, "cycling": 8, "weightlifting": 6, "yoga": 4,
    "swimming": 11, "hiit": 12, "walking": 5, "other": 6,
}
INTENSITY_MULT = {"light": 0.7, "moderate": 1.0, "intense": 1.4}

def log_workout(user_id, workout_type, duration_min, intensity, notes=""):
    cal = int(CALORIE_RATES.get(workout_type, 6) * duration_min * INTENSITY_MULT.get(intensity, 1.0))
    data = {
        "user_id": user_id, "type": workout_type,
        "duration_min": duration_min, "intensity": intensity,
        "calories_burned": cal, "notes": notes,
        "date": dt.date.today().isoformat(),
        "created_at": dt.datetime.utcnow(),
    }
    _, ref = _get_db().collection("ft_workouts").add(data)
    data["id"] = ref.id
    data["created_at"] = _ts(data["created_at"])
    return data

def get_workouts(user_id, target_date=None, limit=50):
    q = _get_db().collection("ft_workouts").where("user_id", "==", user_id)
    if target_date:
        q = q.where("date", "==", target_date)
    q = q.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
    return [_doc_dict(d) for d in q.stream()]

# ── Meals ────────────────────────────────────────────────────
def log_meal(user_id, name, calories, protein_g, carbs_g, fat_g, meal_type):
    data = {
        "user_id": user_id, "name": name,
        "calories": calories, "protein_g": protein_g,
        "carbs_g": carbs_g, "fat_g": fat_g,
        "meal_type": meal_type,
        "date": dt.date.today().isoformat(),
        "created_at": dt.datetime.utcnow(),
    }
    _, ref = _get_db().collection("ft_meals").add(data)
    data["id"] = ref.id
    data["created_at"] = _ts(data["created_at"])
    return data

def get_meals(user_id, target_date=None, limit=50):
    q = _get_db().collection("ft_meals").where("user_id", "==", user_id)
    if target_date:
        q = q.where("date", "==", target_date)
    q = q.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
    return [_doc_dict(d) for d in q.stream()]

# ── Daily Logs ───────────────────────────────────────────────
def update_daily_log(user_id, water_ml=None, sleep_hours=None, steps=None, weight_kg=None, mood=None):
    today = dt.date.today().isoformat()
    doc_id = f"{user_id}_{today}"
    ref = _get_db().collection("ft_daily_logs").document(doc_id)
    doc = ref.get()
    data = doc.to_dict() if doc.exists else {
        "user_id": user_id, "date": today,
        "water_ml": 0, "sleep_hours": 0, "steps": 0,
        "weight_kg": None, "mood": "good",
    }
    if water_ml is not None: data["water_ml"] = water_ml
    if sleep_hours is not None: data["sleep_hours"] = sleep_hours
    if steps is not None: data["steps"] = steps
    if weight_kg is not None: data["weight_kg"] = weight_kg
    if mood is not None: data["mood"] = mood
    data["updated_at"] = dt.datetime.utcnow()
    ref.set(data)
    data["updated_at"] = _ts(data["updated_at"])
    return data

def get_daily_log(user_id, target_date=None):
    if not target_date:
        target_date = dt.date.today().isoformat()
    doc = _get_db().collection("ft_daily_logs").document(f"{user_id}_{target_date}").get()
    if not doc.exists:
        return {"user_id": user_id, "date": target_date, "water_ml": 0, "sleep_hours": 0, "steps": 0, "weight_kg": None, "mood": "good"}
    data = doc.to_dict()
    data["updated_at"] = _ts(data.get("updated_at"))
    return data

def get_weekly_logs(user_id):
    today = dt.date.today()
    return [get_daily_log(user_id, (today - dt.timedelta(days=6-i)).isoformat()) for i in range(7)]

# ── Streaks ──────────────────────────────────────────────────
def get_streak(user_id):
    today = dt.date.today()
    streak = 0
    for i in range(90):
        d = (today - dt.timedelta(days=i)).isoformat()
        if get_workouts(user_id, d, limit=1):
            streak += 1
        elif i > 0:
            break
    return {"current_streak": streak}

# ── Dashboard ────────────────────────────────────────────────
def get_dashboard(user_id):
    user = get_user(user_id)
    if "error" in user:
        return user
    today = dt.date.today().isoformat()
    workouts = get_workouts(user_id, today)
    meals = get_meals(user_id, today)
    daily = get_daily_log(user_id, today)
    streak = get_streak(user_id)
    return {
        "user": user,
        "today": {
            "date": today,
            "workouts_count": len(workouts),
            "calories_burned": sum(w.get("calories_burned", 0) for w in workouts),
            "calories_eaten": sum(m.get("calories", 0) for m in meals),
            "protein_g": round(sum(m.get("protein_g", 0) for m in meals), 1),
            "carbs_g": round(sum(m.get("carbs_g", 0) for m in meals), 1),
            "fat_g": round(sum(m.get("fat_g", 0) for m in meals), 1),
            "water_ml": daily.get("water_ml", 0),
            "sleep_hours": daily.get("sleep_hours", 0),
            "steps": daily.get("steps", 0),
            "mood": daily.get("mood", "good"),
        },
        "goals": {
            "calorie_goal": user.get("daily_calorie_goal", 2000),
            "water_goal_ml": user.get("daily_water_goal_ml", 2500),
            "weekly_workout_goal": user.get("weekly_workout_goal", 4),
            "target_weight_kg": user.get("target_weight_kg"),
        },
        "streak": streak["current_streak"],
        "workouts": workouts,
        "meals": meals,
    }
