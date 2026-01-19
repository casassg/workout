/**
 * Main application logic for Workout Companion
 */

// Global storage for current workout data
let currentWorkoutData = null;
let currentExercises = [];

document.addEventListener('DOMContentLoaded', function() {
  // Load exercise data from Hugo (set as window.EXERCISE_DATA)
  const exerciseData = window.EXERCISE_DATA;
  if (!exerciseData) {
    console.error('Exercise data not found');
    return;
  }
  
  // Store globally for swap functionality
  currentWorkoutData = exerciseData;
  
  // Initialize the app
  initUnitToggle();
  initTodayWorkout(exerciseData);
  initStreakDisplay();
});

/**
 * Initialize unit toggle (kg/lbs)
 */
function initUnitToggle() {
  const toggle = document.getElementById('unit-toggle');
  const label = document.getElementById('unit-label');
  
  if (!toggle || !label) return;
  
  // Set initial state
  const unit = Storage.getUnit();
  updateToggleUI(unit === 'lbs');
  
  toggle.addEventListener('click', function() {
    const currentUnit = Storage.getUnit();
    const newUnit = currentUnit === 'kg' ? 'lbs' : 'kg';
    Storage.setUnit(newUnit);
    updateToggleUI(newUnit === 'lbs');
    
    // Refresh displayed weights
    refreshWeightDisplays();
  });
  
  function updateToggleUI(isLbs) {
    if (isLbs) {
      toggle.classList.remove('toggle-switch-off');
      toggle.classList.add('toggle-switch-on');
      toggle.querySelector('.toggle-knob').classList.remove('translate-x-1');
      toggle.querySelector('.toggle-knob').classList.add('translate-x-6');
      label.textContent = 'lbs';
    } else {
      toggle.classList.remove('toggle-switch-on');
      toggle.classList.add('toggle-switch-off');
      toggle.querySelector('.toggle-knob').classList.remove('translate-x-6');
      toggle.querySelector('.toggle-knob').classList.add('translate-x-1');
      label.textContent = 'kg';
    }
  }
}

/**
 * Refresh all weight displays when unit changes
 */
function refreshWeightDisplays() {
  document.querySelectorAll('[data-weight-kg]').forEach(el => {
    const weightKg = parseFloat(el.dataset.weightKg);
    el.textContent = Storage.formatWeight(weightKg);
  });
  
  document.querySelectorAll('.weight-input').forEach(input => {
    const weightKg = parseFloat(input.dataset.weightKg || 0);
    if (weightKg > 0) {
      input.value = Storage.displayWeight(weightKg);
    }
  });
}

/**
 * Initialize today's workout view
 */
function initTodayWorkout(data) {
  const today = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[today.getDay()];
  
  // Update date display
  const dateEl = document.getElementById('today-date');
  if (dateEl) {
    dateEl.textContent = today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  // Get today's schedule
  const schedule = data.schedule?.week?.[dayName];
  if (!schedule) {
    showError('No schedule found for today');
    return;
  }
  
  // Update workout type display
  const typeEl = document.getElementById('workout-type');
  const descEl = document.getElementById('workout-description');
  const durationEl = document.getElementById('workout-duration');
  const badgeEl = document.getElementById('workout-badge');
  
  if (typeEl) {
    if (schedule.type === 'rest') {
      typeEl.textContent = 'Rest Day';
    } else if (schedule.type === 'run') {
      typeEl.textContent = getRunWorkoutName(data.running, schedule.workout);
    } else if (schedule.type === 'gym') {
      let workoutName = schedule.workout;
      // Handle Friday alternation
      if (schedule.alternateWeekly) {
        const weekNum = Storage.updateWeekCounter();
        workoutName = weekNum === 0 ? schedule.workout : schedule.alternateWeekly;
      }
      typeEl.textContent = capitalizeFirst(workoutName) + ' Day';
    } else if (schedule.type === 'flexible') {
      typeEl.textContent = 'Flexible Day';
    }
  }
  
  if (descEl) descEl.textContent = schedule.description || '';
  if (durationEl) durationEl.textContent = schedule.duration + ' min';
  
  if (badgeEl) {
    const badgeClass = schedule.type === 'run' ? 'badge-run' : 
                       schedule.type === 'rest' ? 'badge-rest' : 'badge-muscle';
    badgeEl.innerHTML = `<span class="badge ${badgeClass}">${schedule.icon || '💪'}</span>`;
  }
  
  // Render appropriate content
  if (schedule.type === 'rest') {
    showRestDay();
  } else if (schedule.type === 'run') {
    showRunWorkout(data.running, schedule.workout, schedule, data);
  } else if (schedule.type === 'gym') {
    let workoutType = schedule.workout;
    if (schedule.alternateWeekly) {
      const weekNum = Storage.updateWeekCounter();
      workoutType = weekNum === 0 ? schedule.workout : schedule.alternateWeekly;
    }
    showGymWorkout(data, workoutType, schedule.includeAbs, schedule);
  } else if (schedule.type === 'flexible') {
    showFlexibleDay(data, schedule);
  }
}

/**
 * Show rest day content
 */
function showRestDay() {
  hideElement('exercise-list');
  hideElement('running-section');
  hideElement('progress-section');
  hideElement('complete-section');
  showElement('rest-section');
}

/**
 * Show running workout
 */
function showRunWorkout(runningData, workoutId, schedule, allData) {
  hideElement('exercise-list');
  hideElement('rest-section');
  hideElement('progress-section');
  showElement('running-section');
  showElement('complete-section');
  
  const workout = runningData?.workouts?.find(w => w.id === workoutId);
  if (!workout) return;
  
  document.getElementById('run-type').textContent = workout.name;
  document.getElementById('run-description').textContent = workout.description;
  document.getElementById('run-duration').textContent = workout.duration;
  document.getElementById('run-intensity').textContent = workout.intensity;
  
  // Show a random tip
  const tips = workout.tips || [];
  const tipEl = document.getElementById('run-tip');
  if (tipEl && tips.length > 0) {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    tipEl.innerHTML = `<strong>Tip:</strong> ${randomTip}`;
  }
  
  // Show extra workout option if available
  if (schedule && allData) {
    showExtraWorkout(allData, schedule);
  }
  
  // Setup complete button
  setupCompleteButton('run', workoutId, []);
}

/**
 * Show gym workout with exercises
 */
function showGymWorkout(data, workoutType, includeAbs, schedule) {
  hideElement('rest-section');
  hideElement('running-section');
  showElement('exercise-list');
  showElement('progress-section');
  showElement('complete-section');
  
  const workoutData = data[workoutType];
  if (!workoutData) return;
  
  let exercises = [...workoutData.exercises];
  
  // Add abs if specified
  if (includeAbs && data.abs) {
    // Add 2-3 ab exercises
    const absExercises = data.abs.exercises.slice(0, 3);
    exercises = exercises.concat(absExercises);
  }
  
  // Store exercises globally for swap functionality
  currentExercises = exercises;
  
  // Update exercise count
  const countEl = document.getElementById('exercise-count');
  if (countEl) countEl.textContent = exercises.length;
  
  // Render exercises
  const listEl = document.getElementById('exercise-list');
  listEl.innerHTML = '';
  
  exercises.forEach((exercise, index) => {
    const card = createExerciseCard(exercise, index);
    listEl.appendChild(card);
  });
  
  // Restore completion state if workout was already completed today
  const todayWorkout = Storage.getTodayWorkout();
  if (todayWorkout && todayWorkout.exercises) {
    restoreExerciseState(todayWorkout.exercises);
  }
  
  // Initialize progress tracking
  updateProgress();
  
  // Setup complete button
  setupCompleteButton('gym', workoutType, exercises);
  
  // Show next run preview if it's a gym day
  showNextRunPreview(data);
  
  // Show extra workout option if available
  if (schedule) {
    showExtraWorkout(data, schedule);
  }
}

/**
 * Show flexible day options
 */
function showFlexibleDay(data, schedule) {
  hideElement('rest-section');
  hideElement('running-section');
  showElement('exercise-list');
  showElement('complete-section');
  
  const listEl = document.getElementById('exercise-list');
  listEl.innerHTML = `
    <div class="mb-4">
      <p class="text-dark-muted mb-4">Choose your workout for today:</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${schedule.options.map((opt, i) => `
          <button class="exercise-card text-left hover:border-accent-primary cursor-pointer" 
                  onclick="selectFlexibleOption(${i})">
            <h3 class="card-title mb-2">${opt.description}</h3>
            <p class="text-dark-muted text-sm">Duration: ${opt.duration} min</p>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  // Store options for later use
  window.flexibleOptions = { data, schedule };
}

// Handle flexible day option selection
window.selectFlexibleOption = function(index) {
  const { data, schedule } = window.flexibleOptions;
  const option = schedule.options[index];
  
  if (option.type === 'run') {
    showRunWorkout(data.running, option.workout);
  } else if (option.type === 'combo') {
    showGymWorkout(data, option.morning, false);
    // Could expand to show both later
  }
};

/**
 * Create an exercise card element
 */
function createExerciseCard(exercise, index) {
  const card = document.createElement('div');
  card.className = 'exercise-card';
  card.id = `exercise-${exercise.id}`;
  card.dataset.exerciseId = exercise.id;
  
  // Get suggested weight based on history, or use starting weight for new exercises
  const suggestion = Storage.getSuggestedWeight(exercise.id, exercise.sets, exercise.reps);
  const lastPerf = Storage.getLastPerformance(exercise.id);
  
  // Determine which weight to show: suggestion from history, or starting weight for beginners
  let displayWeight = '';
  let weightKg = '';
  let weightMessage = '';
  let isProgression = false;
  
  if (suggestion.weight) {
    // User has history, show suggested weight
    displayWeight = Storage.displayWeight(suggestion.weight);
    weightKg = suggestion.weight;
    weightMessage = suggestion.message;
    isProgression = suggestion.isProgression;
  } else if (exercise.startingWeight && exercise.startingWeight > 0) {
    // No history, show starting weight for practice
    displayWeight = Storage.displayWeight(exercise.startingWeight);
    weightKg = exercise.startingWeight;
    weightMessage = `Start light at ${Storage.formatWeight(exercise.startingWeight)} to practice form`;
  }
  
  // Format description for display (convert newlines to HTML)
  const formattedDescription = exercise.description 
    ? exercise.description.trim().split('\n').map(line => {
        if (line.trim().startsWith('Setup:') || line.trim().startsWith('Execution:') || line.trim().startsWith('Key points:')) {
          return `<strong class="text-dark-text">${line.trim()}</strong>`;
        }
        return line;
      }).join('<br>')
    : '';
  
  card.innerHTML = `
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1">
        <h3 class="card-title">${exercise.name}</h3>
        <div class="flex flex-wrap gap-2 mt-1">
          <span class="badge badge-muscle">${exercise.muscle}</span>
          <span class="badge badge-equipment">${exercise.equipment}</span>
        </div>
      </div>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" class="exercise-complete-check w-5 h-5 rounded" 
               data-exercise-id="${exercise.id}">
        <span class="text-sm text-dark-muted">Done</span>
      </label>
    </div>
    
    ${exercise.notes ? `<p class="text-sm text-dark-muted mb-3">${exercise.notes}</p>` : ''}
    
    ${formattedDescription ? `
      <div class="mb-3">
        <button class="text-sm text-accent-primary hover:underline flex items-center gap-1" 
                onclick="toggleDescription('${exercise.id}')">
          <span id="desc-icon-${exercise.id}">▶</span> How to perform
        </button>
        <div id="description-${exercise.id}" class="hidden mt-2 p-3 bg-dark-bg rounded-lg text-sm text-dark-muted leading-relaxed">
          ${formattedDescription}
        </div>
      </div>
    ` : ''}
    
    <div class="grid grid-cols-3 gap-3 mb-3">
      <div>
        <label class="text-xs text-dark-muted block mb-1">Sets</label>
        <input type="number" class="input-small sets-input" value="${exercise.sets}" 
               data-exercise-id="${exercise.id}" min="1" max="10">
      </div>
      <div>
        <label class="text-xs text-dark-muted block mb-1">Reps</label>
        <input type="text" class="input-small reps-input" value="${exercise.reps}" 
               data-exercise-id="${exercise.id}">
      </div>
      <div>
        <label class="text-xs text-dark-muted block mb-1">Weight (${Storage.getUnit()})</label>
        <input type="number" class="input-small weight-input" 
               value="${displayWeight}" 
               data-exercise-id="${exercise.id}"
               data-weight-kg="${weightKg}"
               placeholder="0" step="0.5" min="0">
      </div>
    </div>
    
    ${weightMessage ? `
      <div class="text-xs ${isProgression ? 'text-accent-success' : 'text-dark-muted'} mb-3">
        ${isProgression ? '📈' : 'ℹ️'} ${weightMessage}
      </div>
    ` : ''}
    
    ${lastPerf ? `
      <div class="text-xs text-dark-muted mb-3">
        Last: ${Storage.formatWeight(lastPerf.weight)} × ${lastPerf.reps} reps (${formatDate(lastPerf.date)})
      </div>
    ` : ''}
    
    ${exercise.alternatives && exercise.alternatives.length > 0 ? `
      <div class="border-t border-dark-border pt-3 mt-3">
        <button class="text-sm text-accent-primary hover:underline" 
                onclick="toggleAlternatives('${exercise.id}')">
          Show alternatives (${exercise.alternatives.length})
        </button>
        <div id="alternatives-${exercise.id}" class="hidden mt-2 space-y-2">
          ${exercise.alternatives.map(alt => `
            <div class="bg-dark-bg p-2 rounded text-sm flex justify-between items-center">
              <div>
                <span class="text-dark-text">${alt.name}</span>
                <span class="text-dark-muted text-xs block">${alt.equipment}</span>
              </div>
              <button class="btn-secondary btn-small" onclick="swapExercise('${exercise.id}', '${alt.id}')">
                Use this
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
  
  // Add event listeners
  const checkbox = card.querySelector('.exercise-complete-check');
  checkbox.addEventListener('change', function() {
    saveExerciseData(exercise.id);
    updateProgress();
  });
  
  return card;
}

/**
 * Toggle alternatives visibility
 */
window.toggleAlternatives = function(exerciseId) {
  const el = document.getElementById(`alternatives-${exerciseId}`);
  if (el) {
    el.classList.toggle('hidden');
  }
};

/**
 * Toggle description visibility
 */
window.toggleDescription = function(exerciseId) {
  const el = document.getElementById(`description-${exerciseId}`);
  const icon = document.getElementById(`desc-icon-${exerciseId}`);
  if (el) {
    el.classList.toggle('hidden');
    if (icon) {
      icon.textContent = el.classList.contains('hidden') ? '▶' : '▼';
    }
  }
};

/**
 * Swap exercise with alternative
 */
window.swapExercise = function(originalId, alternativeId) {
  // Find the original exercise in current exercises
  const originalIndex = currentExercises.findIndex(e => e.id === originalId);
  if (originalIndex === -1) return;
  
  const originalExercise = currentExercises[originalIndex];
  
  // Find the alternative in the original exercise's alternatives
  const alternative = originalExercise.alternatives?.find(a => a.id === alternativeId);
  if (!alternative) return;
  
  // Create a new exercise object from the alternative
  // Keep the sets, reps from original, but use alternative's name, equipment, and description
  const newExercise = {
    id: alternative.id,
    name: alternative.name,
    equipment: alternative.equipment,
    muscle: originalExercise.muscle,
    sets: originalExercise.sets,
    reps: originalExercise.reps,
    notes: originalExercise.notes,
    startingWeight: alternative.startingWeight || originalExercise.startingWeight,
    description: alternative.description || originalExercise.description,
    // Add original as an alternative so user can swap back
    alternatives: [
      { id: originalExercise.id, name: originalExercise.name, equipment: originalExercise.equipment, description: originalExercise.description, startingWeight: originalExercise.startingWeight },
      ...originalExercise.alternatives.filter(a => a.id !== alternativeId)
    ]
  };
  
  // Update the global exercises array
  currentExercises[originalIndex] = newExercise;
  
  // Replace the card in the DOM
  const oldCard = document.getElementById(`exercise-${originalId}`);
  if (oldCard) {
    const newCard = createExerciseCard(newExercise, originalIndex);
    oldCard.replaceWith(newCard);
  }
  
  // Show a brief notification
  showNotification(`Switched to ${alternative.name}`);
};

/**
 * Show next run preview on gym days
 */
function showNextRunPreview(data) {
  const previewEl = document.getElementById('next-run-preview');
  if (!previewEl) return;
  
  const today = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayIndex = today.getDay();
  
  // Look for the next run day (check next 7 days)
  for (let i = 1; i <= 7; i++) {
    const checkIndex = (todayIndex + i) % 7;
    const checkDay = dayNames[checkIndex];
    const schedule = data.schedule?.week?.[checkDay];
    
    if (schedule?.type === 'run') {
      const workout = data.running?.workouts?.find(w => w.id === schedule.workout);
      if (workout) {
        const dayLabel = i === 1 ? 'Tomorrow' : capitalizeFirst(checkDay);
        previewEl.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="text-2xl">🏃</span>
            <div>
              <span class="text-dark-muted text-sm">${dayLabel}:</span>
              <span class="text-dark-text font-medium ml-1">${workout.name}</span>
              <span class="text-dark-muted text-sm ml-2">${workout.duration}</span>
            </div>
          </div>
        `;
        previewEl.style.display = '';
        return;
      }
    }
  }
  
  // No run found in next 7 days
  previewEl.style.display = 'none';
}

/**
 * Save exercise data to localStorage
 */
function saveExerciseData(exerciseId) {
  const card = document.getElementById(`exercise-${exerciseId}`);
  if (!card) return;
  
  const checkbox = card.querySelector('.exercise-complete-check');
  if (!checkbox.checked) return;
  
  const weightInput = card.querySelector('.weight-input');
  const repsInput = card.querySelector('.reps-input');
  const setsInput = card.querySelector('.sets-input');
  
  const weight = parseFloat(weightInput.value) || 0;
  const reps = parseInt(repsInput.value) || parseInt(repsInput.value.split('-').pop()) || 0;
  const sets = parseInt(setsInput.value) || 0;
  
  // Convert weight to kg for storage
  const weightKg = Storage.toKg(weight, Storage.getUnit());
  
  Storage.saveExerciseSet(exerciseId, {
    weight: weightKg,
    reps: reps,
    sets: sets
  });
}

/**
 * Restore exercise completion state from saved workout data
 */
function restoreExerciseState(savedExercises) {
  savedExercises.forEach(saved => {
    const card = document.getElementById(`exercise-${saved.id}`);
    if (!card) return;
    
    const checkbox = card.querySelector('.exercise-complete-check');
    const weightInput = card.querySelector('.weight-input');
    const repsInput = card.querySelector('.reps-input');
    const setsInput = card.querySelector('.sets-input');
    
    // Restore checkbox state
    if (checkbox && saved.completed) {
      checkbox.checked = true;
    }
    
    // Restore weight (convert from stored kg to display unit)
    if (weightInput && saved.weight > 0) {
      weightInput.value = Storage.displayWeight(saved.weight);
      weightInput.dataset.weightKg = saved.weight;
    }
    
    // Restore reps and sets
    if (repsInput && saved.reps > 0) {
      repsInput.value = saved.reps;
    }
    if (setsInput && saved.sets > 0) {
      setsInput.value = saved.sets;
    }
  });
}

/**
 * Update progress bar
 */
function updateProgress() {
  const checkboxes = document.querySelectorAll('.exercise-complete-check');
  const total = checkboxes.length;
  const completed = Array.from(checkboxes).filter(c => c.checked).length;
  
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  if (progressBar) {
    const percent = total > 0 ? (completed / total) * 100 : 0;
    progressBar.style.width = `${percent}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${completed}/${total} completed`;
  }
}

/**
 * Setup complete workout button
 */
function setupCompleteButton(type, workout, exercises) {
  const btn = document.getElementById('complete-workout-btn');
  if (!btn) return;
  
  // Remove any existing event listeners by replacing the button
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  // Check if already completed today
  const todayWorkout = Storage.getTodayWorkout();
  if (todayWorkout) {
    // Show completed state with option to redo
    newBtn.textContent = 'Workout Completed! ✓';
    newBtn.disabled = false;
    newBtn.classList.remove('btn-success');
    newBtn.classList.add('bg-dark-border');
    
    // Add redo option
    newBtn.addEventListener('click', function() {
      if (confirm('Want to redo this workout? This will clear your previous completion for today.')) {
        Storage.clearTodayWorkout();
        // Reset UI and re-setup button
        document.querySelectorAll('.exercise-complete-check').forEach(cb => {
          cb.checked = false;
        });
        updateProgress();
        setupCompleteButton(type, workout, exercises);
        showNotification('Workout reset - ready to go again!');
      }
    });
    return;
  }
  
  newBtn.addEventListener('click', function() {
    // Collect exercise data
    const exerciseResults = [];
    document.querySelectorAll('#exercise-list .exercise-card').forEach(card => {
      const id = card.dataset.exerciseId;
      if (!id) return;
      
      const checkbox = card.querySelector('.exercise-complete-check');
      const weightInput = card.querySelector('.weight-input');
      const repsInput = card.querySelector('.reps-input');
      const setsInput = card.querySelector('.sets-input');
      
      exerciseResults.push({
        id: id,
        completed: checkbox?.checked || false,
        weight: Storage.toKg(parseFloat(weightInput?.value) || 0, Storage.getUnit()),
        reps: parseInt(repsInput?.value) || 0,
        sets: parseInt(setsInput?.value) || 0
      });
      
      // Save to exercise history
      if (checkbox?.checked) {
        saveExerciseData(id);
      }
    });
    
    // Save workout completion
    Storage.saveWorkoutCompletion({
      date: new Date().toISOString().split('T')[0],
      type: type,
      workout: workout,
      exercises: exerciseResults
    });
    
    // Update UI
    newBtn.textContent = 'Workout Completed! ✓';
    newBtn.disabled = false;
    newBtn.classList.remove('btn-success');
    newBtn.classList.add('bg-dark-border');
    
    // Show celebration
    showNotification('Great workout! 💪 See you next time!');
    
    // Re-setup to enable redo functionality
    setTimeout(() => setupCompleteButton(type, workout, exercises), 100);
  });
}

/**
 * Helper functions
 */
function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRunWorkoutName(runningData, workoutId) {
  const workout = runningData?.workouts?.find(w => w.id === workoutId);
  return workout ? workout.name : 'Run';
}

function showError(message) {
  const listEl = document.getElementById('exercise-list');
  if (listEl) {
    listEl.innerHTML = `<div class="text-accent-error">${message}</div>`;
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-accent-success text-white px-6 py-3 rounded-lg shadow-lg z-50';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

/**
 * Initialize streak display
 */
function initStreakDisplay() {
  const streakEl = document.getElementById('streak-display');
  if (!streakEl) return;
  
  const streak = Storage.getStreakCount();
  
  if (streak >= 1) {
    const badge = streakEl.querySelector('.badge');
    badge.textContent = `${streak} day streak`;
    streakEl.classList.remove('hidden');
  }
}

/**
 * Show extra workout section if available
 */
function showExtraWorkout(data, schedule) {
  const extra = schedule.extra;
  if (!extra) return;
  
  const section = document.getElementById('extra-workout-section');
  const iconEl = document.getElementById('extra-workout-icon');
  const summaryEl = document.getElementById('extra-workout-summary');
  const contentEl = document.getElementById('extra-workout-content');
  
  if (!section || !contentEl) return;
  
  // Set icon and summary
  iconEl.textContent = extra.icon || (extra.type === 'run' ? '🏃' : '🏋️');
  summaryEl.textContent = `${extra.description} (${extra.duration} min)`;
  
  // Build content based on extra type
  if (extra.type === 'run') {
    const workout = data.running?.workouts?.find(w => w.id === extra.workout);
    if (workout) {
      const tips = workout.tips || [];
      const randomTip = tips.length > 0 ? tips[Math.floor(Math.random() * tips.length)] : '';
      
      contentEl.innerHTML = `
        <h4 class="card-title mb-2">${workout.name}</h4>
        <p class="text-dark-muted mb-3">${workout.description}</p>
        <div class="grid grid-cols-2 gap-4 text-sm mb-3">
          <div>
            <span class="text-dark-muted">Duration:</span>
            <span class="text-dark-text">${extra.duration} min</span>
          </div>
          <div>
            <span class="text-dark-muted">Intensity:</span>
            <span class="text-dark-text">${workout.intensity}</span>
          </div>
        </div>
        ${randomTip ? `
          <div class="p-3 bg-dark-bg rounded-lg">
            <p class="text-sm text-dark-muted"><strong>Tip:</strong> ${randomTip}</p>
          </div>
        ` : ''}
      `;
    }
  } else if (extra.type === 'gym') {
    const workoutData = data[extra.workout];
    if (workoutData) {
      const exercises = workoutData.exercises || [];
      const exerciseList = exercises.slice(0, 4).map(e => e.name).join(', ');
      const moreCount = exercises.length > 4 ? ` +${exercises.length - 4} more` : '';
      
      contentEl.innerHTML = `
        <h4 class="card-title mb-2">${capitalizeFirst(extra.workout)} Workout</h4>
        <p class="text-dark-muted mb-3">${extra.description}</p>
        <div class="text-sm mb-3">
          <span class="text-dark-muted">Duration:</span>
          <span class="text-dark-text">${extra.duration} min</span>
        </div>
        <div class="text-sm">
          <span class="text-dark-muted">Exercises:</span>
          <span class="text-dark-text">${exerciseList}${moreCount}</span>
        </div>
      `;
    }
  }
  
  // Show the section
  section.style.display = '';
}

/**
 * Toggle extra workout details visibility
 */
window.toggleExtraWorkout = function() {
  const details = document.getElementById('extra-workout-details');
  const icon = document.getElementById('extra-toggle-icon');
  
  if (details) {
    details.classList.toggle('hidden');
    if (icon) {
      icon.textContent = details.classList.contains('hidden') ? '▶' : '▼';
    }
  }
};
