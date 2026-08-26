// Client-side day logic, Friday alternation, week reordering, focus mode.
(function () {
  var DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  var UNIT_KEY = "workout:unit";

  function toLb(kg) {
    return kg * 2.20462;
  }

  function formatKg(kg) {
    return String(Math.round(kg * 100) / 100);
  }

  function formatWeight(kg, unit) {
    return unit === "lb" ? String(Math.round(toLb(kg) / 2.5) * 2.5) + " lb" : formatKg(kg) + " kg";
  }

  function altWeek(anchorISO) {
    var p = anchorISO.split("-");
    var anchor = Date.UTC(+p[0], p[1] - 1, +p[2], 12);
    var now = new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    var weeks = Math.floor((today - anchor) / (7 * 864e5));
    return ((weeks % 2) + 2) % 2 === 0 ? "a" : "b";
  }

  // --- Today page ---
  var todayPage = document.querySelector("[data-today-page]");
  if (todayPage) {
    var now = new Date();
    var dayKey = DAYS[now.getDay()];
    var dateEl = document.getElementById("today-date");
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
      });
    }
    var week = altWeek(todayPage.getAttribute("data-alt-anchor"));
    document.querySelectorAll("[data-day]").forEach(function (sec) {
      var match = sec.getAttribute("data-day") === dayKey;
      var alt = sec.getAttribute("data-alt-week");
      if (alt) match = match && alt === week;
      sec.hidden = !match;
    });
    initToday(now);
  }

  // --- Week page: reorder to start from today, relabel ---
  var weekList = document.querySelector("[data-week-list]");
  if (weekList) {
    var today = new Date();
    var cards = {};
    weekList.querySelectorAll("[data-day]").forEach(function (c) {
      cards[c.getAttribute("data-day")] = c;
    });
    for (var i = 0; i < 7; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var card = cards[DAYS[d.getDay()]];
      if (!card) continue;
      var label = card.querySelector("[data-day-label]");
      if (label) {
        var name = i === 0 ? "Today" : i === 1 ? "Tomorrow"
          : d.toLocaleDateString("en-US", { weekday: "long" });
        label.textContent = name + " \u00b7 " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      if (i === 0) card.classList.add("is-today");
      weekList.appendChild(card);
    }
  }

  // --- Today: state + focus mode ---
  function initToday(now) {
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var key = "workout:" + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf("workout:") === 0) {
          var date = k.slice(8);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          var age = (now - new Date(date + "T12:00:00")) / 864e5;
          if (isNaN(age) || age > 14) localStorage.removeItem(k);
        }
      }
    } catch (e) { return; }
    var state = {};
    try { state = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) {}
    var save = function () {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
    };
    initFocus(now, state, save);
  }

  // --- Timer helpers ---
  function clockStr(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // --- Focus mode ---
  function initFocus(now, state, save) {
    var visible = document.querySelector("section[data-day]:not([hidden])");
    if (!visible) return;

    // Collect exercises from hidden cards
    var exercises = [];
    visible.querySelectorAll("[data-exercise-id]").forEach(function (card) {
      var descEl = card.querySelector("[data-desc]");
      exercises.push({
        id: card.getAttribute("data-exercise-id"),
        name: card.getAttribute("data-exercise-name"),
        sets: parseInt(card.getAttribute("data-sets"), 10) || 0,
        reps: card.getAttribute("data-reps"),
        weight: parseFloat(card.getAttribute("data-weight")) || 0,
        demo: card.getAttribute("data-demo"),
        descHtml: descEl ? descEl.innerHTML : ""
      });
    });
    if (!exercises.length) return;

    // "Start workout" button on the summary card
    var summaryCard = visible.querySelector(".rounded-xl");
    var startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "mt-4 w-full rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white min-h-11 cursor-pointer";
    startBtn.textContent = "\u25b6 Start workout (" + exercises.length + " exercises)";
    if (summaryCard) {
      summaryCard.appendChild(startBtn);
    } else {
      visible.appendChild(startBtn);
    }

    // Build overlay
    var overlay = document.createElement("div");
    overlay.className = "focus-overlay";
    overlay.id = "focus-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="sticky top-0 z-[101] flex items-center gap-3 border-b border-line bg-surface px-4 py-2">' +
        '<button class="min-h-11 min-w-11 grid place-content-center text-2xl text-muted" id="focus-close" aria-label="Close">\u00d7</button>' +
        '<div class="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">' +
          '<div class="h-full rounded-full bg-green transition-all duration-300" id="focus-progress"></div>' +
        '</div>' +
        '<span class="text-sm tabular-nums text-muted whitespace-nowrap" id="focus-counter"></span>' +
      '</div>' +
      '<div class="flex-1 overflow-y-auto" id="focus-body"></div>' +
      '<div class="sticky bottom-0 z-[101] border-t border-line bg-surface px-4 py-3">' +
        '<div class="flex gap-3 max-w-lg mx-auto">' +
          '<button class="flex-1 rounded-xl bg-surface-2 px-4 py-3 font-medium text-body min-h-11" id="focus-prev" disabled>\u2190 Prev</button>' +
          '<button class="flex-1 rounded-xl bg-accent px-4 py-3 font-semibold text-white min-h-11" id="focus-next">Next \u2192</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var closeBtn = document.getElementById("focus-close");
    var prevBtn = document.getElementById("focus-prev");
    var nextBtn = document.getElementById("focus-next");
    var progressEl = document.getElementById("focus-progress");
    var counterEl = document.getElementById("focus-counter");
    var bodyEl = document.getElementById("focus-body");

    var wakeLock = null;
    var pos = 0;
    var unit = "kg";
    var currentWeights = {};
    try {
      if (localStorage.getItem(UNIT_KEY) === "lb") unit = "lb";
    } catch (e) {}

    // Rest timer state (persists across exercises within a session)
    var rest = parseInt(visible.getAttribute("data-rest"), 10);
    if (!isFinite(rest) || rest <= 0) rest = 60;
    var timer = { running: false, remaining: 0, total: rest, iv: null };

    function stopTimer() {
      if (timer.iv) clearInterval(timer.iv);
      timer.iv = null;
      timer.running = false;
    }

    function startTimer(seconds) {
      stopTimer();
      timer.total = seconds;
      timer.remaining = seconds;
      timer.running = true;
      timer.iv = setInterval(function () {
        timer.remaining--;
        updateTimerDisplay();
        if (timer.remaining <= 0) {
          stopTimer();
          timer.remaining = 0;
          updateTimerDisplay();
          // Chime: use AudioContext for a short beep
          try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.3;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
          } catch (e) {}
        }
      }, 1000);
    }

    function toggleTimer() {
      if (timer.running) {
        stopTimer();
        updateTimerDisplay();
      } else if (timer.remaining > 0) {
        // Resume
        timer.running = true;
        timer.iv = setInterval(function () {
          timer.remaining--;
          updateTimerDisplay();
          if (timer.remaining <= 0) {
            stopTimer();
            timer.remaining = 0;
            updateTimerDisplay();
            try {
              var ctx = new (window.AudioContext || window.webkitAudioContext)();
              var osc = ctx.createOscillator();
              var gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              gain.gain.value = 0.3;
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            } catch (e) {}
          }
        }, 1000);
        updateTimerDisplay();
      } else {
        // Start fresh
        startTimer(timer.total);
      }
    }

    function updateTimerDisplay() {
      var el = document.getElementById("focus-timer-btn");
      if (!el) return;
      if (timer.running) {
        el.textContent = "\u23f8 " + clockStr(timer.remaining);
        el.className = "mt-3 w-full rounded-xl bg-green/15 border border-green px-4 py-3 text-center font-semibold text-green min-h-11 cursor-pointer tabular-nums text-lg";
      } else if (timer.remaining > 0) {
        el.textContent = "\u25b6 " + clockStr(timer.remaining) + " (paused)";
        el.className = "mt-3 w-full rounded-xl bg-orange/15 border border-orange px-4 py-3 text-center font-semibold text-orange min-h-11 cursor-pointer tabular-nums text-lg";
      } else {
        el.textContent = "\u23f1 Rest " + clockStr(timer.total);
        el.className = "mt-3 w-full rounded-xl bg-surface-2 border border-line px-4 py-3 text-center font-medium text-muted min-h-11 cursor-pointer tabular-nums";
      }
    }

    // Set counting
    function countDone(id, total) {
      var n = 0;
      if (state[id]) for (var s = 0; s < total; s++) if (state[id][s]) n++;
      return n;
    }

    function currentWeight(ex) {
      if (Object.prototype.hasOwnProperty.call(currentWeights, ex.id)) return currentWeights[ex.id];
      var weights = state._w && state._w[ex.id];
      if (weights) {
        for (var s = ex.sets - 1; s >= 0; s--) {
          if (state[ex.id] && state[ex.id][s] && Object.prototype.hasOwnProperty.call(weights, s)) {
            currentWeights[ex.id] = weights[s];
            return currentWeights[ex.id];
          }
        }
      }
      currentWeights[ex.id] = ex.weight;
      return currentWeights[ex.id];
    }

    function addSet(id, total) {
      state[id] = state[id] || {};
      for (var s = 0; s < total; s++) {
        if (!state[id][s]) {
          state[id][s] = true;
          if (Object.prototype.hasOwnProperty.call(currentWeights, id)) {
            state._w = state._w || {};
            state._w[id] = state._w[id] || {};
            state._w[id][s] = currentWeights[id];
          }
          save();
          return;
        }
      }
    }

    function undoSet(id, total) {
      if (!state[id]) return;
      for (var s = total - 1; s >= 0; s--) {
        if (state[id][s]) {
          state[id][s] = false;
          if (state._w && state._w[id]) delete state._w[id][s];
          save();
          return;
        }
      }
    }

    // Build export text
    function exportText() {
      var lines = ["Workout log \u2014 " + now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
      })];
      var titleEl = visible.querySelector("h3");
      if (titleEl) lines.push(titleEl.textContent.trim());
      var totalSets = 0, doneSets = 0, items = [];
      for (var i = 0; i < exercises.length; i++) {
        var ex = exercises[i];
        var d = countDone(ex.id, ex.sets);
        totalSets += ex.sets;
        doneSets += d;
        var weights = [];
        var loggedWeights = state._w && state._w[ex.id];
        for (var s = 0; s < ex.sets; s++) {
          if (!state[ex.id] || !state[ex.id][s]) continue;
          if (loggedWeights && Object.prototype.hasOwnProperty.call(loggedWeights, s)) {
            weights.push(loggedWeights[s]);
          } else if (ex.weight) {
            weights.push(ex.weight);
          }
        }
        var suffix = "";
        if (weights.length) {
          var textWeights = weights.map(formatKg);
          suffix = " @ " + (textWeights.every(function (weight) { return weight === textWeights[0]; })
            ? textWeights[0] : textWeights.join("/")) + " kg";
        }
        items.push("- " + ex.name + ": " + d + "/" + ex.sets + " sets of " + ex.reps + suffix);
      }
      lines.push("");
      lines = lines.concat(items);
      lines.push("");
      lines.push("Completed " + doneSets + "/" + totalSets + " sets.");
      return lines.join("\n");
    }

    function render() {
      var total = exercises.length;
      var clamped = Math.min(pos, total - 1);
      counterEl.textContent = (clamped + 1) + " / " + total;
      progressEl.style.width = ((clamped + 1) / total * 100) + "%";
      prevBtn.disabled = pos === 0;

      // Done screen
      if (pos >= total) {
        var ts = 0, ds = 0;
        for (var i = 0; i < total; i++) { ts += exercises[i].sets; ds += countDone(exercises[i].id, exercises[i].sets); }
        nextBtn.textContent = "Close";
        bodyEl.innerHTML =
          '<div class="text-center py-12 px-4 max-w-lg mx-auto">' +
            '<div class="text-6xl mb-4">\ud83c\udf89</div>' +
            '<h2 class="text-2xl font-bold text-heading">Workout complete!</h2>' +
            '<p class="text-lg text-muted mt-2 tabular-nums">' + ds + ' / ' + ts + ' sets</p>' +
            '<button type="button" id="focus-copy" class="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white min-h-11 cursor-pointer">Copy log to clipboard</button>' +
          '</div>';
        var copyBtn = document.getElementById("focus-copy");
        if (copyBtn) {
          copyBtn.addEventListener("click", function () {
            var text = exportText();
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(
                function () { copyBtn.textContent = "Copied \u2713"; },
                function () { window.prompt("Copy:", text); }
              );
            } else {
              window.prompt("Copy:", text);
            }
          });
        }
        return;
      }

      nextBtn.textContent = pos === total - 1 ? "Done \u2713" : "Next \u2192";

      var ex = exercises[pos];
      var done = countDone(ex.id, ex.sets);
      var allDone = done >= ex.sets;

      var html = '<div class="max-w-lg mx-auto w-full px-4 py-6">';

      // GIF
      if (ex.demo) {
        html += '<img class="mx-auto h-[180px] w-[180px] rounded-xl bg-white object-cover mb-5" src="' +
          ex.demo + '" alt="' + ex.name + '">';
      }

      // Name + unit selector
      html += '<div class="flex flex-wrap items-center justify-center gap-2">';
      html += '<h2 class="text-xl font-bold text-heading text-center">' + ex.name + '</h2>';
      if (ex.weight) {
        html += '<div class="flex gap-1 rounded-lg bg-surface-2 p-1">' +
          '<button type="button" data-unit="kg" class="rounded px-2 py-1 text-xs cursor-pointer' + (unit === "kg" ? ' bg-accent text-white' : ' text-muted') + '">kg</button>' +
          '<button type="button" data-unit="lb" class="rounded px-2 py-1 text-xs cursor-pointer' + (unit === "lb" ? ' bg-accent text-white' : ' text-muted') + '">lb</button>' +
        '</div>';
      }
      html += '</div>';
      html += '<p class="text-center text-muted tabular-nums mt-1">' +
        ex.sets + ' \u00d7 ' + ex.reps +
        (ex.weight ? ' \u00b7 ' + formatWeight(ex.weight, unit) : '') + '</p>';

      if (done) {
        var loggedWeights = state._w && state._w[ex.id];
        html += '<div class="mt-6"><p class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Completed</p>' +
          '<div class="flex flex-wrap gap-2">';
        for (var s = 0; s < ex.sets; s++) {
          if (!state[ex.id] || !state[ex.id][s]) continue;
          var loggedWeight = loggedWeights && Object.prototype.hasOwnProperty.call(loggedWeights, s)
            ? loggedWeights[s] : ex.weight;
          html += '<span class="rounded-lg bg-green/15 px-3 py-2 text-sm font-medium text-green tabular-nums">Set ' + (s + 1) +
            (ex.weight ? ' \u00b7 ' + formatWeight(loggedWeight, unit) : '') + ' \u2713</span>';
        }
        html += '</div></div>';
      }

      if (allDone) {
        html += '<p class="mt-6 text-center font-semibold text-green">All ' + ex.sets + ' sets logged \u2713</p>';
      } else {
        html += '<div class="mt-6 rounded-xl border border-line bg-surface-2 p-4">' +
          '<p class="text-center text-sm font-medium text-muted">Set ' + (done + 1) + ' of ' + ex.sets + '</p>';
        if (ex.weight) {
          var weight = currentWeight(ex);
          html += '<p class="mt-4 text-center text-xs font-semibold uppercase tracking-wide text-muted">Working weight</p>' +
            '<div class="mt-2 flex items-center justify-center gap-4">' +
              '<button type="button" id="focus-sub-weight" aria-label="Decrease weight" class="min-h-11 min-w-11 rounded-lg bg-surface text-xl font-bold text-muted cursor-pointer">\u2212</button>' +
              '<span class="min-w-28 text-center text-xl font-semibold tabular-nums text-heading">' + formatWeight(weight, unit) + '</span>' +
              '<button type="button" id="focus-add-weight" aria-label="Increase weight" class="min-h-11 min-w-11 rounded-lg bg-surface text-xl font-bold text-muted cursor-pointer">+</button>' +
            '</div>';
        }
        html += '<button type="button" id="focus-log-set" class="mt-4 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white min-h-11 cursor-pointer">Log set</button>' +
          '</div>';
      }
      if (done) {
        html += '<button type="button" id="focus-undo-set" class="mt-3 w-full py-2 text-sm font-medium text-muted cursor-pointer hover:text-heading">Undo last set</button>';
      }

      // Rest timer
      html += '<button type="button" id="focus-timer-btn" class="mt-3 w-full rounded-xl bg-surface-2 border border-line px-4 py-3 text-center font-medium text-muted min-h-11 cursor-pointer tabular-nums">' +
        '\u23f1 Rest ' + clockStr(timer.total) + '</button>';

      // Description (pre-rendered as HTML by Hugo's markdownify)
      if (ex.descHtml) {
        html += '<div class="mt-6 border-t border-line pt-4">' +
          '<h3 class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">How to perform</h3>' +
          ex.descHtml +
        '</div>';
      }

      html += '</div>';
      bodyEl.innerHTML = html;

      // Update timer display if it's still running from previous exercise
      updateTimerDisplay();

      // Wire set actions
      var addBtn = document.getElementById("focus-log-set");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          addSet(ex.id, ex.sets);
          var newDone = countDone(ex.id, ex.sets);
          if (newDone >= ex.sets) {
            render(); // show green check
            setTimeout(function () {
              if (pos < exercises.length - 1) {
                pos++;
                stopTimer();
                render();
                bodyEl.scrollTop = 0;
              }
            }, 600);
          } else {
            render();
            startTimer(timer.total);
          }
        });
      }
      var subBtn = document.getElementById("focus-undo-set");
      if (subBtn) {
        subBtn.addEventListener("click", function () {
          undoSet(ex.id, ex.sets);
          render();
        });
      }

      var subWeightBtn = document.getElementById("focus-sub-weight");
      var addWeightBtn = document.getElementById("focus-add-weight");
      function adjustWeight(direction) {
        var step = unit === "lb" ? 2.5 / 2.20462 : 2.5;
        currentWeights[ex.id] = Math.max(0, currentWeight(ex) + direction * step);
        render();
      }
      if (subWeightBtn) subWeightBtn.addEventListener("click", function () { adjustWeight(-1); });
      if (addWeightBtn) addWeightBtn.addEventListener("click", function () { adjustWeight(1); });
      bodyEl.querySelectorAll("[data-unit]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          unit = btn.getAttribute("data-unit");
          try { localStorage.setItem(UNIT_KEY, unit); } catch (e) {}
          render();
        });
      });

      // Wire timer
      var timerBtn = document.getElementById("focus-timer-btn");
      if (timerBtn) {
        timerBtn.addEventListener("click", toggleTimer);
        timerBtn.addEventListener("dblclick", function () {
          stopTimer();
          timer.remaining = 0;
          updateTimerDisplay();
        });
      }

      // Persist position by exercise id (survives exercise reorder between builds)
      state._pos = pos;
      state._exId = ex ? ex.id : null;
      save();
    }

    function open() {
      // Resolve position: prefer saved exercise id, fall back to numeric index
      pos = 0;
      if (state._exId) {
        for (var j = 0; j < exercises.length; j++) {
          if (exercises[j].id === state._exId) { pos = j; break; }
        }
      } else if (typeof state._pos === "number") {
        pos = state._pos;
      }
      if (pos >= exercises.length) pos = exercises.length - 1;
      if (pos < 0) pos = 0;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      state._focus = true;
      save();
      render();
      if (navigator.wakeLock) {
        try { navigator.wakeLock.request("screen").then(function (wl) { wakeLock = wl; }).catch(function () {}); } catch (e) {}
      }
    }

    function close() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      state._focus = false;
      stopTimer();
      save();
      if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    }

    function goNext() {
      if (pos >= exercises.length) { close(); return; }
      pos++;
      stopTimer();
      render();
      bodyEl.scrollTop = 0;
    }

    function goPrev() {
      if (pos <= 0) return;
      pos--;
      stopTimer();
      render();
      bodyEl.scrollTop = 0;
    }

    startBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    nextBtn.addEventListener("click", goNext);
    prevBtn.addEventListener("click", goPrev);

    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") close();
    });

    var touchStartX = 0, touchStartY = 0;
    overlay.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });
    overlay.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx)) {
        if (dx < 0) goNext(); else goPrev();
      }
    }, { passive: true });

    if (state._focus) open();
  }

  // --- Service worker ---
  if ("serviceWorker" in navigator) {
    var base = document.body.getAttribute("data-base") || "/";
    navigator.serviceWorker.register(base + "sw.js").catch(function () {});
  }
})();
