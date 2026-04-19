"""Gemini AI integration for FitTrack AI — coaching, food scanning, motivation."""
from google import genai
from google.genai import types
import base64, json

_client = None
def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(vertexai=True, project="build-with-ai-fan", location="us-central1")
    return _client
MODEL = "gemini-2.5-flash"

def _clean_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)

async def scan_food(image_base64: str) -> dict:
    """Analyze food photo → nutritional info via Gemini Vision."""
    prompt = (
        "Analyze this food image. Return ONLY a JSON object:\n"
        '{"food_name":"...","serving_size":"...","calories":0,'
        '"protein_g":0,"carbs_g":0,"fat_g":0,"health_notes":"..."}\n'
        "Be realistic with portions. ONLY valid JSON, no markdown."
    )
    try:
        image_bytes = base64.b64decode(image_base64)
        response = _get_client().models.generate_content(
            model=MODEL,
            contents=[prompt, types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")],
        )
        return _clean_json(response.text)
    except json.JSONDecodeError:
        return {"error": "Could not parse AI response", "raw": response.text}
    except Exception as e:
        return {"error": str(e)}

async def ai_coach_chat(message: str, ctx: dict) -> str:
    """Chat with AI fitness coach."""
    system = (
        "You are FitTrack AI Coach, a friendly fitness assistant.\n"
        f"User: {ctx.get('display_name','User')}, {ctx.get('age','?')}yo, "
        f"{ctx.get('weight_kg','?')}kg, {ctx.get('height_cm','?')}cm, "
        f"level: {ctx.get('fitness_level','beginner')}\n"
        f"Goal: {ctx.get('daily_calorie_goal',2000)} cal/day, "
        f"target weight: {ctx.get('target_weight_kg','?')}kg\n"
        f"Today: {ctx.get('calories_eaten',0)} cal eaten, "
        f"{ctx.get('calories_burned',0)} cal burned, "
        f"{ctx.get('workouts_count',0)} workouts, "
        f"{ctx.get('water_ml',0)}ml water, "
        f"streak: {ctx.get('streak',0)} days\n"
        "Give personalized, actionable advice. Be encouraging. Keep it concise."
    )
    response = _get_client().models.generate_content(
        model=MODEL,
        contents=[f"{system}\n\nUser: {message}"],
    )
    return response.text

async def get_motivation(ctx: dict) -> str:
    prompt = (
        f"Short motivational fitness message (2-3 sentences) for "
        f"{ctx.get('display_name','Champion')}, "
        f"streak: {ctx.get('streak',0)} days, "
        f"level: {ctx.get('fitness_level','beginner')}, "
        f"workouts today: {ctx.get('workouts_count',0)}. "
        "Be specific, energetic. Max 2 emojis."
    )
    response = _get_client().models.generate_content(model=MODEL, contents=[prompt])
    return response.text

async def get_suggestions(ctx: dict) -> list:
    prompt = (
        "Give 3 personalized fitness suggestions as JSON array based on:\n"
        f"User: {ctx.get('display_name')}, {ctx.get('weight_kg')}kg → "
        f"{ctx.get('target_weight_kg')}kg target, level: {ctx.get('fitness_level')}\n"
        f"Today: {ctx.get('calories_eaten',0)} cal eaten, "
        f"{ctx.get('calories_burned',0)} burned, "
        f"water: {ctx.get('water_ml',0)}/{ctx.get('daily_water_goal_ml',2500)}ml, "
        f"streak: {ctx.get('streak',0)} days\n"
        'Return ONLY: [{"icon":"💪","title":"...","desc":"..."},...]'
    )
    try:
        response = _get_client().models.generate_content(model=MODEL, contents=[prompt])
        return _clean_json(response.text)
    except:
        return [{"icon": "💪", "title": "Keep Going!", "desc": "Log a workout to stay on track."}]
