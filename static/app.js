/* ═══════════════════════════════════════════════════════════
   FitTrack AI — Frontend Logic (Glassmorphism + Noto Emoji)
   ═══════════════════════════════════════════════════════════ */

const API = "/api";
let currentUser = null;
let currentSection = "dashboard";
let selectedWorkoutType = "running";
let selectedMood = "good";
let scanData = null;

/* ── Init ───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("fittrack_user");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showLoggedIn();
    } catch {
      localStorage.removeItem("fittrack_user");
    }
  }
  setupNavClicks();
  setupTypeChips();
  setupChipPickers();
  applyTheme();
});

/* ── Nav ────────────────────────────────────────────────── */
function setupNavClicks() {
  document.querySelectorAll(".pill, .dock-btn").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      if (section) switchSection(section);
    });
  });
}

function switchSection(name) {
  if (!currentUser && name !== "dashboard") return;
  const prev = document.getElementById("section" + cap(currentSection));
  const next = document.getElementById("section" + cap(name));
  if (!next) return;
  if (prev && prev !== next) {
    prev.classList.add("section-exit");
    setTimeout(() => {
      prev.classList.add("hidden");
      prev.classList.remove("section-exit", "section-enter");
    }, 150);
  }
  setTimeout(
    () => {
      next.classList.remove("hidden");
      next.classList.add("section-enter");
      currentSection = name;
      updateNavActive();
      onSectionEnter(name);
    },
    prev === next ? 0 : 160,
  );
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function updateNavActive() {
  document.querySelectorAll(".pill, .dock-btn").forEach((l) => {
    l.classList.toggle("active", l.dataset.section === currentSection);
  });
}

function onSectionEnter(name) {
  if (name === "dashboard") loadDashboard();
  if (name === "workouts") loadWorkouts();
  if (name === "nutrition") loadNutrition();
  if (name === "progress") loadProgress();
}

/* ── Theme ──────────────────────────────────────────────── */
function toggleTheme() {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  const isDark = root.getAttribute("data-theme") === "light";
  root.setAttribute("data-theme", isDark ? "" : "light");
  document.getElementById("themeIcon").textContent = isDark ? "🌙" : "☀️";
  localStorage.setItem("fittrack_theme", isDark ? "dark" : "light");
  // Re-enable transitions after one paint frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
  });
}

/* ── Chip Pickers ────────────────────────────────────────── */
function setupChipPickers() {
  document.querySelectorAll(".chip-picker").forEach((picker) => {
    // Expose .value getter/setter
    Object.defineProperty(picker, "value", {
      get() {
        return picker.dataset.value;
      },
      set(v) {
        picker.dataset.value = v;
        picker
          .querySelectorAll(".chip-opt")
          .forEach((b) => b.classList.toggle("active", b.dataset.val === v));
      },
    });
    picker.querySelectorAll(".chip-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        picker.value = btn.dataset.val;
      });
    });
  });
}
function applyTheme() {
  const t = localStorage.getItem("fittrack_theme");
  if (t === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    document.getElementById("themeIcon").textContent = "☀️";
  }
}

/* ── Auth ───────────────────────────────────────────────── */
function switchAuthTab(tab) {
  document
    .getElementById("tabLogin")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("tabRegister")
    .classList.toggle("active", tab === "register");
  document
    .getElementById("authLoginForm")
    .classList.toggle("hidden", tab !== "login");
  document
    .getElementById("authRegisterForm")
    .classList.toggle("hidden", tab !== "register");
  const title = document.querySelector(".auth-title");
  const tag = document.querySelector(".auth-welcome-tag");
  if (title && tag) {
    if (tab === "login") {
      tag.textContent = "Welcome back";
      title.textContent = "Sign in to continue";
    } else {
      tag.textContent = "Get started";
      title.textContent = "Create your account";
    }
  }
}

async function loginUser() {
  const user_id = document.getElementById("loginUserId").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!user_id || !password) return toast("Fill in all fields", "error");
  const res = await api("/auth/login", { user_id, password });
  if (res.error) return toast(res.error, "error");
  currentUser = res;
  localStorage.setItem("fittrack_user", JSON.stringify(res));
  showLoggedIn();
  toast(`Welcome back, ${res.display_name}!`, "success");
}

async function registerUser() {
  const data = {
    user_id: document.getElementById("regUserId").value.trim(),
    display_name: document.getElementById("regDisplayName").value.trim(),
    password: document.getElementById("regPassword").value,
    age: parseInt(document.getElementById("regAge").value) || 25,
    weight_kg: parseFloat(document.getElementById("regWeight").value) || 70,
    height_cm: parseFloat(document.getElementById("regHeight").value) || 170,
  };
  if (!data.user_id || !data.display_name || !data.password)
    return toast("Fill in required fields", "error");
  if (data.password.length < 4)
    return toast("Password must be at least 4 characters", "error");
  const res = await api("/auth/register", data);
  if (res.error) return toast(res.error, "error");
  currentUser = res;
  localStorage.setItem("fittrack_user", JSON.stringify(res));
  showLoggedIn();
  toast(`Welcome, ${res.display_name}! Let's get started 💪`, "success");
}

function showLoggedIn() {
  document.getElementById("authOverlay").classList.add("hidden");
  document.getElementById("dashboardContent").classList.remove("hidden");
  document.getElementById("sectionDashboard").classList.remove("auth-page");
  document.getElementById("userBadge").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");
  document.getElementById("desktopNav").classList.remove("hidden");
  document.getElementById("mobileNav").classList.remove("hidden");
  document.getElementById("navAvatar").textContent =
    (currentUser.display_name || "?")[0].toUpperCase();
  document.getElementById("navUsername").textContent =
    currentUser.display_name || currentUser.user_id;
  loadDashboard();
}

function logout() {
  currentUser = null;
  localStorage.removeItem("fittrack_user");
  document.getElementById("authOverlay").classList.remove("hidden");
  document.getElementById("dashboardContent").classList.add("hidden");
  document.getElementById("sectionDashboard").classList.add("auth-page");
  document.getElementById("userBadge").classList.add("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("desktopNav").classList.add("hidden");
  document.getElementById("mobileNav").classList.add("hidden");
  switchSection("dashboard");
  toast("Signed out", "info");
}

/* ── Dashboard ──────────────────────────────────────────── */
async function loadDashboard() {
  if (!currentUser) return;
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("dashGreeting").textContent =
    `${greet}, ${currentUser.display_name || "champ"}! 👋`;

  try {
    const dash = await api(`/dashboard/${currentUser.user_id}`, null, "GET");
    if (dash.error) return;

    const t = dash.today || {};
    const g = dash.goals || {};
    document.getElementById("streakCount").textContent = dash.streak || 0;
    document.getElementById("calEaten").textContent = t.calories_eaten || 0;
    document.getElementById("calGoal").textContent = g.calorie_goal || 2000;
    document.getElementById("waterAmt").textContent = t.water_ml || 0;
    document.getElementById("waterGoal").textContent = g.water_goal_ml || 2500;
    document.getElementById("calBurned").textContent = t.calories_burned || 0;

    // Animated stat bars
    const calPct = Math.min(
      ((t.calories_eaten || 0) / (g.calorie_goal || 2000)) * 100,
      100,
    );
    const waterPct = Math.min(
      ((t.water_ml || 0) / (g.water_goal_ml || 2500)) * 100,
      100,
    );
    const burnPct = Math.min(((t.calories_burned || 0) / 500) * 100, 100);
    setTimeout(() => {
      document.getElementById("barCal").style.width = calPct + "%";
      document.getElementById("barWater").style.width = waterPct + "%";
      document.getElementById("barBurn").style.width = burnPct + "%";
    }, 100);
  } catch (e) {
    console.error("Dashboard load error", e);
  }

  loadMotivation();
  loadSuggestions();
  loadRecentActivity();
}

async function loadMotivation() {
  if (!currentUser) return;
  try {
    const res = await api(`/ai/motivation/${currentUser.user_id}`, null, "GET");
    document.getElementById("motivationText").textContent =
      res.message || "Stay strong! Every step counts! 💪";
  } catch {
    document.getElementById("motivationText").textContent =
      "Stay strong! Every step counts! 💪";
  }
}

async function loadSuggestions() {
  if (!currentUser) return;
  try {
    const sug = await api(
      `/ai/suggestions/${currentUser.user_id}`,
      null,
      "GET",
    );
    const grid = document.getElementById("suggestionsGrid");
    if (Array.isArray(sug) && sug.length) {
      grid.innerHTML = sug
        .map(
          (s) => `
                <div class="sug-row">
                    <span class="sug-dot"></span>
                    <div><strong>${esc(s.title)}</strong><span>${esc(s.description || s.desc)}</span></div>
                </div>`,
        )
        .join("");
    }
  } catch {}
}

async function loadRecentActivity() {
  if (!currentUser) return;
  const feed = document.getElementById("recentActivity");
  try {
    const [workouts, meals] = await Promise.all([
      api(`/workouts/${currentUser.user_id}`, null, "GET"),
      api(`/meals/${currentUser.user_id}`, null, "GET"),
    ]);
    const items = [];
    if (Array.isArray(workouts))
      workouts.slice(0, 5).forEach((w) => {
        items.push({
          icon: typeIcon(w.type),
          text: `<strong>${cap(w.type)}</strong> — ${w.duration_min} min`,
          meta: `${w.calories_burned} cal burned · ${w.date}`,
          time: w.created_at,
        });
      });
    if (Array.isArray(meals))
      meals.slice(0, 5).forEach((m) => {
        items.push({
          icon: "🍽️",
          text: `<strong>${esc(m.name)}</strong>`,
          meta: `${m.calories} cal · ${m.meal_type} · ${m.date}`,
          time: m.created_at,
        });
      });
    items.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
    feed.innerHTML = items.length
      ? items
          .slice(0, 8)
          .map(
            (i) => `
            <div class="feed-item">
                <span class="feed-ico">${i.icon}</span>
                <div class="feed-info">${i.text}<div class="feed-meta">${i.meta}</div></div>
            </div>`,
          )
          .join("")
      : '<p class="muted">No activity yet. Start logging!</p>';
  } catch {
    feed.innerHTML = '<p class="muted">Unable to load activity</p>';
  }
}

/* ── Workouts ───────────────────────────────────────────── */
function setupTypeChips() {
  document.querySelectorAll("#workoutTypeChips .sport-btn").forEach((chip) => {
    chip.addEventListener("click", () => {
      document
        .querySelectorAll("#workoutTypeChips .sport-btn")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedWorkoutType = chip.dataset.type;
    });
  });
}

async function logWorkout() {
  if (!currentUser) return toast("Please sign in", "error");
  const data = {
    user_id: currentUser.user_id,
    type: selectedWorkoutType,
    duration_min:
      parseInt(document.getElementById("workoutDuration").value) || 30,
    intensity: document.getElementById("workoutIntensity").value,
    notes: document.getElementById("workoutNotes").value.trim(),
  };
  const res = await api("/workout", data);
  if (res.error) return toast(res.error, "error");
  toast(
    `${cap(data.type)} logged — ${res.calories_burned} cal burned! 🔥`,
    "success",
  );
  document.getElementById("workoutNotes").value = "";
  loadWorkouts();
}

const _loaderEmojis = ['🏃', '🏋️', '🚴', '🧘', '🏊'];
function fitLoader() {
    return `<div class="fit-loader">${_loaderEmojis.map((e, i) => `<span class="fit-loader-emoji" style="animation-delay:${i * 0.12}s">${e}</span>`).join('')}<span class="fit-loader-text">Loading...</span></div>`;
}

async function loadWorkouts() {
  if (!currentUser) return;
  document.getElementById('todayWorkouts').innerHTML = fitLoader();
  document.getElementById('workoutHistory').innerHTML = fitLoader();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [todayW, allW] = await Promise.all([
      api(`/workouts/${currentUser.user_id}?target_date=${today}`, null, "GET"),
      api(`/workouts/${currentUser.user_id}`, null, "GET"),
    ]);
    renderWorkoutList("todayWorkouts", Array.isArray(todayW) ? todayW : []);
    renderWorkoutList(
      "workoutHistory",
      Array.isArray(allW)
        ? allW.filter((w) => w.date !== today).slice(0, 20)
        : [],
    );
  } catch {}
}

function renderWorkoutList(id, list) {
  const el = document.getElementById(id);
  el.innerHTML = list.length
    ? list
        .map(
          (w) => `
        <div class="list-row">
            <span class="li-icon">${typeIcon(w.type)}</span>
            <div class="li-info">
                <strong>${cap(w.type)}</strong>
                <div class="li-meta">${w.duration_min} min · ${cap(w.intensity)} · ${w.date}</div>
            </div>
            <span class="li-stat">${w.calories_burned} cal</span>
        </div>`,
        )
        .join("")
    : '<p class="muted">No workouts yet</p>';
}

function typeIcon(type) {
  const icons = {
    running: "🏃",
    cycling: "🚴",
    weightlifting: "🏋️",
    yoga: "🧘",
    swimming: "🏊",
    hiit: "⚡",
    walking: "🚶",
  };
  return icons[type] || "💪";
}

/* ── Nutrition ──────────────────────────────────────────── */
async function logMeal() {
  if (!currentUser) return toast("Please sign in", "error");
  const name = document.getElementById("mealName").value.trim();
  if (!name) return toast("Enter food name", "error");
  const data = {
    user_id: currentUser.user_id,
    name,
    calories: parseInt(document.getElementById("mealCalories").value) || 0,
    protein_g: parseFloat(document.getElementById("mealProtein").value) || 0,
    carbs_g: parseFloat(document.getElementById("mealCarbs").value) || 0,
    fat_g: parseFloat(document.getElementById("mealFat").value) || 0,
    meal_type: document.getElementById("mealType").value,
  };
  const res = await api("/meal", data);
  if (res.error) return toast(res.error, "error");
  toast(`${name} added — ${data.calories} cal`, "success");
  ["mealName", "mealCalories", "mealProtein", "mealCarbs", "mealFat"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  loadNutrition();
}

async function loadNutrition() {
  if (!currentUser) return;
  document.getElementById('todayMeals').innerHTML = fitLoader();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const meals = await api(
      `/meals/${currentUser.user_id}?target_date=${today}`,
      null,
      "GET",
    );
    if (!Array.isArray(meals)) return;
    const totals = { cal: 0, pro: 0, carb: 0, fat: 0 };
    meals.forEach((m) => {
      totals.cal += m.calories || 0;
      totals.pro += m.protein_g || 0;
      totals.carb += m.carbs_g || 0;
      totals.fat += m.fat_g || 0;
    });
    const goal = currentUser.daily_calorie_goal || 2000;
    document.getElementById("calBar").style.width =
      Math.min((totals.cal / goal) * 100, 100) + "%";
    document.getElementById("macroCalVal").textContent =
      `${totals.cal} / ${goal}`;
    document.getElementById("macroP").textContent = Math.round(totals.pro);
    document.getElementById("macroC").textContent = Math.round(totals.carb);
    document.getElementById("macroF").textContent = Math.round(totals.fat);

    const el = document.getElementById("todayMeals");
    el.innerHTML = meals.length
      ? meals
          .map(
            (m) => `
            <div class="list-row">
                <span class="li-icon">${mealIcon(m.meal_type)}</span>
                <div class="li-info">
                    <strong>${esc(m.name)}</strong>
                    <div class="li-meta">${cap(m.meal_type)} · P:${Math.round(m.protein_g || 0)}g C:${Math.round(m.carbs_g || 0)}g F:${Math.round(m.fat_g || 0)}g</div>
                </div>
                <span class="li-stat">${m.calories} cal</span>
            </div>`,
          )
          .join("")
      : '<p class="muted">No meals logged today</p>';
  } catch {}
}

function mealIcon(type) {
  const icons = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍿" };
  return icons[type] || "🍽️";
}

/* ── Food Scanner ───────────────────────────────────────── */
function openScanner() {
  document.getElementById("scannerModal").classList.remove("hidden");
  document.getElementById("scanResult").classList.add("hidden");
  document.getElementById("scanPreview").classList.add("hidden");
  document.getElementById("scanLoading").classList.add("hidden");
  document.getElementById("scanArea").classList.remove("hidden");
  scanData = null;
}
function closeScanner() {
  document.getElementById("scannerModal").classList.add("hidden");
}

function handleFoodImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    document.getElementById("scanImage").src = dataUrl;
    document.getElementById("scanPreview").classList.remove("hidden");
    document.getElementById("scanArea").classList.add("hidden");
    document.getElementById("scanLoading").classList.remove("hidden");
    document.getElementById("scanResult").classList.add("hidden");

    const base64 = dataUrl.split(",")[1];
    try {
      const res = await api("/meal/scan", {
        user_id: currentUser.user_id,
        image_base64: base64,
      });
      document.getElementById("scanLoading").classList.add("hidden");
      if (res.error) return toast("Could not analyze image", "error");
      scanData = res;
      document.getElementById("scanFoodName").textContent =
        res.food_name || "Unknown food";
      document.getElementById("scanServing").textContent =
        res.serving_size || "";
      document.getElementById("scanCal").textContent = res.calories || 0;
      document.getElementById("scanPro").textContent = res.protein_g || 0;
      document.getElementById("scanCarb").textContent = res.carbs_g || 0;
      document.getElementById("scanFatV").textContent = res.fat_g || 0;
      document.getElementById("scanNotes").textContent = res.health_notes || "";
      document.getElementById("scanResult").classList.remove("hidden");
    } catch (err) {
      document.getElementById("scanLoading").classList.add("hidden");
      toast("Scan failed: " + err.message, "error");
    }
  };
  reader.readAsDataURL(file);
}

async function saveScanResult() {
  if (!scanData || !currentUser) return;
  const data = {
    user_id: currentUser.user_id,
    name: scanData.food_name || "Scanned food",
    calories: parseInt(scanData.calories) || 0,
    protein_g: parseFloat(scanData.protein_g) || 0,
    carbs_g: parseFloat(scanData.carbs_g) || 0,
    fat_g: parseFloat(scanData.fat_g) || 0,
    meal_type: "snack",
  };
  const res = await api("/meal", data);
  if (res.error) return toast(res.error, "error");
  toast(`${data.name} added to meals!`, "success");
  closeScanner();
  loadNutrition();
}

/* ── Progress ───────────────────────────────────────────── */
async function loadProgress() {
  if (!currentUser) return;
  const user = await api(`/user/${currentUser.user_id}`, null, "GET");
  if (user && !user.error) {
    document.getElementById("goalCalories").value =
      user.daily_calorie_goal || 2000;
    document.getElementById("goalWater").value =
      user.daily_water_goal_ml || 2500;
    document.getElementById("goalWorkouts").value =
      user.weekly_workout_goal || 4;
    document.getElementById("goalWeight").value = user.target_weight_kg || "";
  }
  loadWeekChart();
  loadDailyLog();
}

async function saveGoals() {
  if (!currentUser) return;
  const data = {
    daily_calorie_goal:
      parseInt(document.getElementById("goalCalories").value) || 2000,
    daily_water_goal_ml:
      parseInt(document.getElementById("goalWater").value) || 2500,
    weekly_workout_goal:
      parseInt(document.getElementById("goalWorkouts").value) || 4,
    target_weight_kg:
      parseFloat(document.getElementById("goalWeight").value) || null,
  };
  const res = await api(`/user/${currentUser.user_id}/goals`, data, "PUT");
  if (res.error) return toast(res.error, "error");
  currentUser = { ...currentUser, ...data };
  localStorage.setItem("fittrack_user", JSON.stringify(currentUser));
  toast("Goals saved! 🎯", "success");
}

async function loadWeekChart() {
  if (!currentUser) return;
  try {
    const week = await api(
      `/daily-log/${currentUser.user_id}/week`,
      null,
      "GET",
    );
    if (!Array.isArray(week)) return;
    const chart = document.getElementById("weekChart");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const maxCal = Math.max(...week.map((d) => (d.water_ml || 0) + 1), 1);
    chart.innerHTML = week
      .map((d) => {
        const dayName = days[new Date(d.date + "T12:00:00").getDay()] || "—";
        const val = d.water_ml || 0;
        const pct = (val / maxCal) * 100;
        return `<div class="wbar">
                <div class="wbar-fill" style="height:${Math.max(pct, 3)}%"></div>
                <span class="wbar-val">${val}</span>
                <span class="wbar-day">${dayName}</span>
            </div>`;
      })
      .join("");
  } catch {}
}

async function loadDailyLog() {
  if (!currentUser) return;
  try {
    const log = await api(`/daily-log/${currentUser.user_id}`, null, "GET");
    if (log && !log.error) {
      document.getElementById("logWater").value = log.water_ml || "";
      document.getElementById("logSleep").value = log.sleep_hours || "";
      document.getElementById("logSteps").value = log.steps || "";
      document.getElementById("logWeightInput").value = log.weight_kg || "";
      if (log.mood) selectMood(log.mood);
    }
  } catch {}
}

function selectMood(mood) {
  selectedMood = mood;
  document.querySelectorAll(".mood-btn").forEach((c) => {
    c.classList.toggle("active", c.dataset.mood === mood);
  });
}

async function saveDailyLog() {
  if (!currentUser) return;
  const data = {
    user_id: currentUser.user_id,
    water_ml: parseInt(document.getElementById("logWater").value) || null,
    sleep_hours: parseFloat(document.getElementById("logSleep").value) || null,
    steps: parseInt(document.getElementById("logSteps").value) || null,
    weight_kg:
      parseFloat(document.getElementById("logWeightInput").value) || null,
    mood: selectedMood,
  };
  const res = await api("/daily-log", data);
  if (res.error) return toast(res.error, "error");
  toast("Daily check-in saved! ✅", "success");
  loadWeekChart();
}

/* ── AI Coach ───────────────────────────────────────────── */
async function sendAiChat() {
  if (!currentUser) return toast("Please sign in", "error");
  const input = document.getElementById("aiInput");
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";

  const msgs = document.getElementById("aiMessages");
  const avatar = (currentUser.display_name || "?")[0].toUpperCase();
  msgs.innerHTML += `<div class="bubble-row user"><div class="bubble-icon">${avatar}</div><div class="bubble glass-card">${esc(msg)}</div></div>`;

  const loadingId = "ai-load-" + Date.now();
  msgs.innerHTML += `<div class="bubble-row bot" id="${loadingId}"><div class="bubble-icon">🤖</div><div class="bubble glass-card"><div class="spinner-wrap"><div class="spinner"></div>Thinking...</div></div></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const res = await api("/ai/chat", {
      user_id: currentUser.user_id,
      message: msg,
    });
    const el = document.getElementById(loadingId);
    if (el) {
      el.querySelector(".bubble").innerHTML = formatAiResponse(
        res.reply || "Sorry, I had trouble responding. Try again!",
      );
    }
  } catch {
    const el = document.getElementById(loadingId);
    if (el)
      el.querySelector(".bubble").textContent =
        "Sorry, something went wrong. Try again!";
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function formatAiResponse(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

/* ── Helpers ────────────────────────────────────────────── */
async function api(path, body, method) {
  const opts = { headers: { "Content-Type": "application/json" } };
  if (!method) method = body ? "POST" : "GET";
  opts.method = method;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function toast(msg, type = "info") {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(16px)";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}
