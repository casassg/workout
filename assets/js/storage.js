/**
 * Storage module for workout data persistence
 * All weights are stored internally in kg
 */

const STORAGE_KEYS = {
  WORKOUT_HISTORY: 'workout_history',
  EXERCISE_HISTORY: 'exercise_history',
  PREFERENCES: 'workout_preferences',
  WEEK_COUNTER: 'week_counter'
};

// User preferences
function getPreferences() {
  const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
  return stored ? JSON.parse(stored) : { 
    unit: 'kg',
    lastVisit: null
  };
}

function savePreferences(prefs) {
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
}

function getUnit() {
  return getPreferences().unit;
}

function setUnit(unit) {
  const prefs = getPreferences();
  prefs.unit = unit;
  savePreferences(prefs);
}

// Weight conversion utilities
function kgToLbs(kg) {
  return Math.round(kg * 2.205 * 10) / 10;
}

function lbsToKg(lbs) {
  return Math.round(lbs / 2.205 * 10) / 10;
}

function displayWeight(weightKg) {
  const unit = getUnit();
  if (unit === 'lbs') {
    return kgToLbs(weightKg);
  }
  return weightKg;
}

function toKg(weight, fromUnit) {
  if (fromUnit === 'lbs') {
    return lbsToKg(weight);
  }
  return weight;
}

function formatWeight(weightKg) {
  const unit = getUnit();
  const value = displayWeight(weightKg);
  return `${value} ${unit}`;
}

// Exercise history - stores weight/reps for each exercise
function getExerciseHistory(exerciseId) {
  const all = getAllExerciseHistory();
  return all[exerciseId] || [];
}

function getAllExerciseHistory() {
  const stored = localStorage.getItem(STORAGE_KEYS.EXERCISE_HISTORY);
  return stored ? JSON.parse(stored) : {};
}

function saveExerciseSet(exerciseId, data) {
  // data: { weight: number (in kg), reps: number, sets: number, date: string }
  const all = getAllExerciseHistory();
  if (!all[exerciseId]) {
    all[exerciseId] = [];
  }
  
  // Check if there's already an entry for today
  const today = new Date().toISOString().split('T')[0];
  const todayIndex = all[exerciseId].findIndex(e => e.date === today);
  
  if (todayIndex >= 0) {
    // Update today's entry
    all[exerciseId][todayIndex] = { ...data, date: today };
  } else {
    // Add new entry
    all[exerciseId].push({ ...data, date: today });
  }
  
  // Keep only last 90 days of history
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  all[exerciseId] = all[exerciseId].filter(e => new Date(e.date) >= cutoff);
  
  localStorage.setItem(STORAGE_KEYS.EXERCISE_HISTORY, JSON.stringify(all));
}

function getLastPerformance(exerciseId) {
  const history = getExerciseHistory(exerciseId);
  if (history.length === 0) return null;
  
  // Get most recent entry
  return history[history.length - 1];
}

function getSuggestedWeight(exerciseId, defaultSets, defaultReps) {
  const last = getLastPerformance(exerciseId);
  
  if (!last) {
    return {
      weight: null,
      reps: defaultReps,
      sets: defaultSets,
      isNew: true,
      message: "First time - start light!"
    };
  }
  
  // Parse target reps (handle ranges like "8-12")
  const targetReps = typeof defaultReps === 'string' 
    ? parseInt(defaultReps.split('-').pop()) 
    : defaultReps;
  
  // Progressive overload logic
  // If hit max reps last time, suggest weight increase
  if (last.reps >= targetReps) {
    const newWeight = last.weight + 2.5; // Standard progression
    return {
      weight: newWeight,
      reps: defaultReps,
      sets: defaultSets,
      isProgression: true,
      message: `Progress! +2.5kg from last time`
    };
  }
  
  // Otherwise, keep same weight, aim for more reps
  return {
    weight: last.weight,
    reps: defaultReps,
    sets: defaultSets,
    isProgression: false,
    message: `Same weight, aim for ${targetReps} reps`
  };
}

// Workout completion history
function getWorkoutHistory() {
  const stored = localStorage.getItem(STORAGE_KEYS.WORKOUT_HISTORY);
  return stored ? JSON.parse(stored) : [];
}

function saveWorkoutCompletion(workoutData) {
  // workoutData: { date: string, type: string, workout: string, exercises: array }
  const history = getWorkoutHistory();
  history.push(workoutData);
  
  // Keep last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const filtered = history.filter(w => new Date(w.date) >= cutoff);
  
  localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(filtered));
}

function getTodayWorkout() {
  const history = getWorkoutHistory();
  const today = new Date().toISOString().split('T')[0];
  return history.find(w => w.date === today);
}

function isWorkoutCompletedToday() {
  return getTodayWorkout() !== null;
}

function clearTodayWorkout() {
  const history = getWorkoutHistory();
  const today = new Date().toISOString().split('T')[0];
  const filtered = history.filter(w => w.date !== today);
  localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(filtered));
}

// Week counter for alternating workouts (e.g., Friday Push/Legs)
function getWeekCounter() {
  const stored = localStorage.getItem(STORAGE_KEYS.WEEK_COUNTER);
  if (!stored) return { week: 0, lastUpdated: null };
  return JSON.parse(stored);
}

function updateWeekCounter() {
  const counter = getWeekCounter();
  const today = new Date();
  const currentWeek = getWeekNumber(today);
  
  if (counter.lastUpdated !== currentWeek) {
    counter.week = (counter.week + 1) % 2; // Alternate 0/1
    counter.lastUpdated = currentWeek;
    localStorage.setItem(STORAGE_KEYS.WEEK_COUNTER, JSON.stringify(counter));
  }
  
  return counter.week;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Clear all data (for testing/reset)
function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

// Export functions for use in other modules
window.Storage = {
  getPreferences,
  savePreferences,
  getUnit,
  setUnit,
  displayWeight,
  toKg,
  formatWeight,
  kgToLbs,
  lbsToKg,
  getExerciseHistory,
  getAllExerciseHistory,
  saveExerciseSet,
  getLastPerformance,
  getSuggestedWeight,
  getWorkoutHistory,
  saveWorkoutCompletion,
  getTodayWorkout,
  isWorkoutCompletedToday,
  clearTodayWorkout,
  getWeekCounter,
  updateWeekCounter,
  clearAllData
};
