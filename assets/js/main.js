// Client-side day logic, Friday alternation, week reordering, focus mode.
(function () {
  var DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
          var age = (now - new Date(k.slice(8) + "T12:00:00")) / 864e5;
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
      var descEl = card.querySelector(".whitespace-pre-line");
      exercises.push({
        id: card.getAttribute("data-exercise-id"),
        name: card.getAttribute("data-exercise-name"),
        sets: parseInt(card.getAttribute("data-sets"), 10) || 0,
        reps: card.getAttribute("data-reps"),
        weight: card.getAttribute("data-weight"),
        demo: card.getAttribute("data-demo"),
        description: descEl ? descEl.textContent.trim() : ""
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

    // Rest timer state (persists across exercises within a session)
    var timer = { running: false, remaining: 0, total: 90, iv: null };

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

    function addSet(id, total) {
      state[id] = state[id] || {};
      for (var s = 0; s < total; s++) {
        if (!state[id][s]) { state[id][s] = true; save(); return; }
      }
    }

    function undoSet(id, total) {
      if (!state[id]) return;
      for (var s = total - 1; s >= 0; s--) {
        if (state[id][s]) { state[id][s] = false; save(); return; }
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
        items.push("- " + ex.name + ": " + d + "/" + ex.sets +
          " sets of " + ex.reps + (ex.weight ? " @ " + ex.weight + " kg" : ""));
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

      // Name + reps
      html += '<h2 class="text-xl font-bold text-heading text-center">' + ex.name + '</h2>';
      html += '<p class="text-center text-muted tabular-nums mt-1">' +
        ex.sets + ' \u00d7 ' + ex.reps +
        (ex.weight ? ' \u00b7 ' + ex.weight + ' kg' : '') + '</p>';

      // Set counter: [ - ]  2 / 4  [ + ]
      html += '<div class="mt-6 flex items-center justify-center gap-4">';
      html += '<button type="button" id="focus-sub-set" class="w-14 h-14 rounded-full border-2 border-line bg-surface-2 grid place-content-center text-2xl font-bold text-muted active:scale-95 transition-transform cursor-pointer' + (done <= 0 ? ' opacity-30 pointer-events-none' : '') + '">\u2212</button>';
      if (allDone) {
        html += '<div class="text-center min-w-[5rem]"><span class="text-4xl font-bold text-green">\u2713</span>' +
          '<p class="text-sm text-green font-medium mt-1">' + done + ' / ' + ex.sets + '</p></div>';
      } else {
        html += '<div class="text-center min-w-[5rem]"><span class="text-4xl font-bold tabular-nums text-heading">' + done + '</span>' +
          '<p class="text-sm text-muted mt-1">' + done + ' / ' + ex.sets + ' sets</p></div>';
      }
      html += '<button type="button" id="focus-add-set" class="w-14 h-14 rounded-full border-2 border-accent bg-accent/10 grid place-content-center text-2xl font-bold text-accent active:scale-95 transition-transform cursor-pointer' + (allDone ? ' opacity-30 pointer-events-none' : '') + '">+</button>';
      html += '</div>';

      // Rest timer
      html += '<button type="button" id="focus-timer-btn" class="mt-3 w-full rounded-xl bg-surface-2 border border-line px-4 py-3 text-center font-medium text-muted min-h-11 cursor-pointer tabular-nums">' +
        '\u23f1 Rest ' + clockStr(timer.total) + '</button>';

      // Timer presets
      html += '<div class="flex justify-center gap-2 mt-2">';
      var presets = [60, 90, 120];
      for (var p = 0; p < presets.length; p++) {
        html += '<button type="button" data-preset="' + presets[p] + '" class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-muted cursor-pointer hover:text-heading">' +
          clockStr(presets[p]) + '</button>';
      }
      html += '</div>';

      // Description
      if (ex.description) {
        html += '<div class="mt-6 border-t border-line pt-4">' +
          '<h3 class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">How to perform</h3>' +
          '<div class="text-sm text-muted whitespace-pre-line leading-relaxed">' + ex.description + '</div>' +
        '</div>';
      }

      html += '</div>';
      bodyEl.innerHTML = html;

      // Update timer display if it's still running from previous exercise
      updateTimerDisplay();

      // Wire + / - buttons
      var addBtn = document.getElementById("focus-add-set");
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
      var subBtn = document.getElementById("focus-sub-set");
      if (subBtn) {
        subBtn.addEventListener("click", function () {
          undoSet(ex.id, ex.sets);
          render();
        });
      }

      // Wire timer
      var timerBtn = document.getElementById("focus-timer-btn");
      if (timerBtn) {
        timerBtn.addEventListener("click", toggleTimer);
      }

      // Wire presets
      bodyEl.querySelectorAll("[data-preset]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          timer.total = parseInt(btn.getAttribute("data-preset"), 10);
          stopTimer();
          timer.remaining = 0;
          updateTimerDisplay();
        });
      });

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
