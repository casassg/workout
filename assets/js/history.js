/**
 * History page functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  loadHistory();
  loadExerciseProgress();
  setupClearButton();
});

function loadHistory() {
  const history = Storage.getWorkoutHistory();
  const historyEl = document.getElementById('workout-history');
  
  // Calculate stats
  const totalWorkouts = history.length;
  const thisWeek = countThisWeek(history);
  const streak = calculateStreak(history);
  const daysSinceLast = calculateDaysSinceLast(history);
  
  document.getElementById('total-workouts').textContent = totalWorkouts;
  document.getElementById('this-week').textContent = thisWeek;
  document.getElementById('current-streak').textContent = streak;
  document.getElementById('last-workout').textContent = daysSinceLast === null ? '-' : daysSinceLast;
  
  // Render history
  if (history.length === 0) {
    return;
  }
  
  // Sort by date descending
  const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  historyEl.innerHTML = sorted.slice(0, 20).map(function(workout) {
    const date = new Date(workout.date);
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    const completedCount = workout.exercises ? workout.exercises.filter(function(e) { return e.completed; }).length : 0;
    const totalCount = workout.exercises ? workout.exercises.length : 0;
    
    const typeIcon = workout.type === 'run' ? '🏃' : '🏋️';
    const typeBadge = workout.type === 'run' ? 'badge-run' : 'badge-muscle';
    const workoutName = workout.workout.replace(/_/g, ' ');
    
    let html = '<div class="exercise-card">';
    html += '<div class="flex items-center justify-between">';
    html += '<div class="flex items-center gap-3">';
    html += '<span class="text-xl">' + typeIcon + '</span>';
    html += '<div>';
    html += '<div class="font-medium capitalize">' + workoutName + '</div>';
    html += '<div class="text-sm text-dark-muted">' + dateStr + '</div>';
    html += '</div></div>';
    html += '<div class="text-right">';
    html += '<span class="badge ' + typeBadge + '">' + workout.type + '</span>';
    if (totalCount > 0) {
      html += '<div class="text-xs text-dark-muted mt-1">' + completedCount + '/' + totalCount + ' exercises</div>';
    }
    html += '</div></div></div>';
    
    return html;
  }).join('');
}

function loadExerciseProgress() {
  const exerciseHistory = Storage.getAllExerciseHistory();
  const progressEl = document.getElementById('exercise-progress');
  
  const exercises = Object.entries(exerciseHistory);
  
  if (exercises.length === 0) {
    progressEl.innerHTML = '<p class="text-dark-muted">No exercise data yet. Complete some workouts to track progress!</p>';
    return;
  }
  
  // Sort by most recent activity
  exercises.sort(function(a, b) {
    const aLast = a[1].length > 0 ? a[1][a[1].length - 1].date : '';
    const bLast = b[1].length > 0 ? b[1][b[1].length - 1].date : '';
    return bLast.localeCompare(aLast);
  });
  
  progressEl.innerHTML = exercises.slice(0, 15).map(function(entry) {
    const exerciseId = entry[0];
    const history = entry[1];
    
    if (history.length === 0) return '';
    
    const latest = history[history.length - 1];
    const first = history[0];
    const improvement = history.length > 1 ? latest.weight - first.weight : 0;
    let improvementClass = 'text-dark-muted';
    if (improvement > 0) improvementClass = 'text-accent-success';
    else if (improvement < 0) improvementClass = 'text-accent-error';
    
    // Format exercise name from id
    const name = exerciseId.split('_').map(function(w) { 
      return w.charAt(0).toUpperCase() + w.slice(1); 
    }).join(' ');
    
    let html = '<div class="exercise-card">';
    html += '<div class="flex items-center justify-between mb-2">';
    html += '<h3 class="font-medium">' + name + '</h3>';
    html += '<span class="text-sm text-dark-muted">' + history.length + ' sessions</span>';
    html += '</div>';
    html += '<div class="flex items-center justify-between text-sm">';
    html += '<div>';
    html += '<span class="text-dark-muted">Current:</span> ';
    html += '<span class="text-dark-text font-medium" data-weight-kg="' + latest.weight + '">' + Storage.formatWeight(latest.weight) + '</span>';
    html += ' <span class="text-dark-muted">x ' + latest.reps + ' reps</span>';
    html += '</div>';
    if (history.length > 1) {
      const sign = improvement > 0 ? '+' : '';
      html += '<div class="' + improvementClass + '">';
      html += sign + Storage.displayWeight(improvement) + ' ' + Storage.getUnit() + ' since start';
      html += '</div>';
    }
    html += '</div></div>';
    
    return html;
  }).join('');
}

function countThisWeek(history) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  return history.filter(function(w) { 
    return new Date(w.date) >= startOfWeek; 
  }).length;
}

function calculateStreak(history) {
  if (history.length === 0) return 0;
  
  const sorted = [...history].sort(function(a, b) { 
    return new Date(b.date) - new Date(a.date); 
  });
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // Check if worked out today or yesterday
  if (sorted[0].date !== today && sorted[0].date !== yesterday) {
    return 0;
  }
  
  let streak = 1;
  let currentDate = new Date(sorted[0].date);
  
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    if (sorted[i].date === prevDateStr) {
      streak++;
      currentDate = prevDate;
    } else {
      break;
    }
  }
  
  return streak;
}

function calculateDaysSinceLast(history) {
  if (history.length === 0) return null;
  
  const sorted = [...history].sort(function(a, b) { 
    return new Date(b.date) - new Date(a.date); 
  });
  const lastDate = new Date(sorted[0].date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);
  
  const diffTime = today - lastDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

function setupClearButton() {
  const btn = document.getElementById('clear-data-btn');
  if (!btn) return;
  
  btn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all workout data? This cannot be undone.')) {
      Storage.clearAllData();
      location.reload();
    }
  });
}
