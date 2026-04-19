"""FitTrack AI — REST API Routes"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import datetime as dt

from db.firestore import (
    create_user, login_user, get_user, update_user,
    log_workout, get_workouts,
    log_meal, get_meals,
    update_daily_log, get_daily_log, get_weekly_logs,
    get_streak, get_dashboard,
)
from ai.gemini import scan_food, ai_coach_chat, get_motivation, get_suggestions

router = APIRouter()

# ── Models ───────────────────────────────────────────────────
class RegisterModel(BaseModel):
    user_id: str
    display_name: str
    password: str
    age: int
    weight_kg: float
    height_cm: float
    fitness_level: str = "beginner"

class LoginModel(BaseModel):
    user_id: str
    password: str

class WorkoutModel(BaseModel):
    user_id: str
    type: str
    duration_min: int
    intensity: str = "moderate"
    notes: str = ""

class MealModel(BaseModel):
    user_id: str
    name: str
    calories: int
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    meal_type: str = "snack"

class DailyLogModel(BaseModel):
    user_id: str
    water_ml: Optional[int] = None
    sleep_hours: Optional[float] = None
    steps: Optional[int] = None
    weight_kg: Optional[float] = None
    mood: Optional[str] = None

class GoalModel(BaseModel):
    daily_calorie_goal: Optional[int] = None
    daily_water_goal_ml: Optional[int] = None
    weekly_workout_goal: Optional[int] = None
    target_weight_kg: Optional[float] = None

class ChatModel(BaseModel):
    user_id: str
    message: str

class ScanModel(BaseModel):
    user_id: str
    image_base64: str

# ── Auth ─────────────────────────────────────────────────────
@router.post("/auth/register")
async def register(data: RegisterModel):
    return create_user(data.user_id, data.display_name, data.password, data.age, data.weight_kg, data.height_cm, data.fitness_level)

@router.post("/auth/login")
async def login(data: LoginModel):
    return login_user(data.user_id, data.password)

@router.get("/user/{user_id}")
async def user_profile(user_id: str):
    return get_user(user_id)

@router.put("/user/{user_id}/goals")
async def update_goals(user_id: str, data: GoalModel):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    return update_user(user_id, updates)

# ── Workouts ─────────────────────────────────────────────────
@router.post("/workout")
async def add_workout(data: WorkoutModel):
    return log_workout(data.user_id, data.type, data.duration_min, data.intensity, data.notes)

@router.get("/workouts/{user_id}")
async def user_workouts(user_id: str, target_date: Optional[str] = None):
    return get_workouts(user_id, target_date)

# ── Meals ────────────────────────────────────────────────────
@router.post("/meal")
async def add_meal(data: MealModel):
    return log_meal(data.user_id, data.name, data.calories, data.protein_g, data.carbs_g, data.fat_g, data.meal_type)

@router.get("/meals/{user_id}")
async def user_meals(user_id: str, target_date: Optional[str] = None):
    return get_meals(user_id, target_date)

@router.post("/meal/scan")
async def scan_meal(data: ScanModel):
    return await scan_food(data.image_base64)

# ── Daily Log ────────────────────────────────────────────────
@router.post("/daily-log")
async def add_daily_log(data: DailyLogModel):
    return update_daily_log(data.user_id, data.water_ml, data.sleep_hours, data.steps, data.weight_kg, data.mood)

@router.get("/daily-log/{user_id}")
async def user_daily_log(user_id: str, target_date: Optional[str] = None):
    return get_daily_log(user_id, target_date)

@router.get("/daily-log/{user_id}/week")
async def user_weekly(user_id: str):
    return get_weekly_logs(user_id)

# ── Dashboard ────────────────────────────────────────────────
@router.get("/dashboard/{user_id}")
async def dashboard(user_id: str):
    return get_dashboard(user_id)

# ── AI ───────────────────────────────────────────────────────
@router.post("/ai/chat")
async def chat(data: ChatModel):
    user = get_user(data.user_id)
    if "error" in user:
        return {"reply": "Please log in first."}
    today = dt.date.today().isoformat()
    workouts = get_workouts(data.user_id, today)
    meals = get_meals(data.user_id, today)
    daily = get_daily_log(data.user_id, today)
    streak = get_streak(data.user_id)
    ctx = {
        **user,
        "calories_eaten": sum(m.get("calories", 0) for m in meals),
        "calories_burned": sum(w.get("calories_burned", 0) for w in workouts),
        "workouts_count": len(workouts),
        "water_ml": daily.get("water_ml", 0),
        "streak": streak["current_streak"],
    }
    reply = await ai_coach_chat(data.message, ctx)
    return {"reply": reply}

@router.get("/ai/motivation/{user_id}")
async def motivation(user_id: str):
    user = get_user(user_id)
    if "error" in user:
        return {"message": "Every step counts! Keep pushing! 💪"}
    streak = get_streak(user_id)
    workouts = get_workouts(user_id, dt.date.today().isoformat())
    ctx = {**user, "streak": streak["current_streak"], "workouts_count": len(workouts)}
    return {"message": await get_motivation(ctx)}

@router.get("/ai/suggestions/{user_id}")
async def suggestions(user_id: str):
    user = get_user(user_id)
    if "error" in user:
        return []
    today = dt.date.today().isoformat()
    workouts = get_workouts(user_id, today)
    meals = get_meals(user_id, today)
    daily = get_daily_log(user_id, today)
    streak = get_streak(user_id)
    ctx = {
        **user,
        "calories_eaten": sum(m.get("calories", 0) for m in meals),
        "calories_burned": sum(w.get("calories_burned", 0) for w in workouts),
        "water_ml": daily.get("water_ml", 0),
        "streak": streak["current_streak"],
    }
    return await get_suggestions(ctx)
