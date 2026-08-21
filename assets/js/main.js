// Client-side day logic, Friday alternation, week reordering, set checkoff.
(function () {
  var DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // Week parity relative to the alternation anchor, computed at UTC noon to
  // dodge DST edges. Weeks starting at the anchor are "a", next week "b", etc.
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
    initCheckoff(now);
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
        label.textContent = name + " · " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      if (i === 0) card.classList.add("is-today");
      weekList.appendChild(card);
    }
  }

  // --- Set checkoff (localStorage, pruned after 14 days) ---
  function initCheckoff(now) {
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
    } catch (e) { return; } // localStorage unavailable: skip checkoff entirely
    var state = {};
    try { state = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) {}
    var save = function () {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
    };
    document.querySelectorAll("section[data-day]:not([hidden]) [data-exercise-id]").forEach(function (card) {
      var id = card.getAttribute("data-exercise-id");
      var sets = parseInt(card.getAttribute("data-sets"), 10) || 0;
      if (!sets) return;
      var row = document.createElement("div");
      row.className = "flex gap-2.5 mt-3";
      for (var s = 0; s < sets; s++) {
        var box = document.createElement("input");
        box.type = "checkbox";
        box.className = "set-check";
        box.setAttribute("aria-label", "Set " + (s + 1) + " of " + card.getAttribute("data-exercise-name"));
        box.checked = !!(state[id] && state[id][s]);
        box.addEventListener("change", (function (id, s) {
          return function (e) {
            state[id] = state[id] || {};
            state[id][s] = e.target.checked;
            save();
          };
        })(id, s));
        row.appendChild(box);
      }
      var head = card.querySelector(".card-head");
      (head ? head.parentNode : card).insertBefore(row, head ? head.nextSibling : card.firstChild);
    });
    initExport(now, state);
    initFocus(now, state, save);
  }

  // --- Export the day as plain text (paste into an agent / training log) ---
  function initExport(now, state) {
    var visible = document.querySelector("section[data-day]:not([hidden])");
    if (!visible) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "export-btn mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted cursor-pointer hover:text-heading hover:bg-surface-2 min-h-11";
    btn.textContent = "Copy day as text";
    btn.addEventListener("click", function () {
      var lines = ["Workout log — " + now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
      })];
      var title = visible.querySelector(".card h3, .card h4");
      var desc = visible.querySelector(".day-summary p.meta");
      if (title) lines.push(title.textContent.trim() + (desc ? " — " + desc.textContent.trim() : ""));
      var total = 0, done = 0, items = [];
      visible.querySelectorAll("[data-exercise-id]").forEach(function (card) {
        var id = card.getAttribute("data-exercise-id");
        var sets = parseInt(card.getAttribute("data-sets"), 10) || 0;
        var d = 0;
        for (var s = 0; s < sets; s++) if (state[id] && state[id][s]) d++;
        total += sets; done += d;
        var w = card.getAttribute("data-weight");
        items.push("- " + card.getAttribute("data-exercise-name") + ": " + d + "/" + sets +
          " sets of " + card.getAttribute("data-reps") + (w ? " @ " + w + " kg" : ""));
      });
      if (items.length) {
        lines.push("");
        lines = lines.concat(items);
        lines.push("");
        lines.push("Completed " + done + "/" + total + " sets.");
      }
      var text = lines.join("\n");
      var flash = function (msg) {
        btn.textContent = msg;
        setTimeout(function () { btn.textContent = "Copy day as text"; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { flash("Copied ✓"); },
          function () { window.prompt("Copy the log below:", text); });
      } else {
        window.prompt("Copy the log below:", text);
      }
    });
    visible.appendChild(btn);
  }

  // --- Focus mode (one-exercise-at-a-time overlay) ---
  function initFocus(now, state, save) {
    var visible = document.querySelector("section[data-day]:not([hidden])");
    if (!visible) return;

    // Collect exercises
    var exercises = [];
    visible.querySelectorAll("[data-exercise-id]").forEach(function (card) {
      exercises.push({
        id: card.getAttribute("data-exercise-id"),
        name: card.getAttribute("data-exercise-name"),
        sets: parseInt(card.getAttribute("data-sets"), 10) || 0,
        reps: card.getAttribute("data-reps"),
        weight: card.getAttribute("data-weight"),
        demo: card.getAttribute("data-demo")
      });
    });
    if (!exercises.length) return;

    // Build "Start workout" button before export button
    var exportBtn = visible.querySelector(".export-btn");
    var startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "mt-4 w-full rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white min-h-11 cursor-pointer";
    startBtn.textContent = "Start workout";
    if (exportBtn) {
      visible.insertBefore(startBtn, exportBtn);
    } else {
      visible.appendChild(startBtn);
    }

    // Build overlay DOM
    var overlay = document.createElement("div");
    overlay.className = "focus-overlay";
    overlay.id = "focus-overlay";
    overlay.hidden = true;
    overlay.innerHTML = '<div class="sticky top-0 z-[101] flex items-center gap-3 border-b border-line bg-surface px-4 py-2">' +
      '<button class="min-h-11 min-w-11 grid place-content-center text-2xl text-muted" id="focus-close" aria-label="Close">×</button>' +
      '<div class="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">' +
        '<div class="h-full rounded-full bg-green transition-all duration-300" id="focus-progress"></div>' +
      '</div>' +
      '<span class="text-sm tabular-nums text-muted" id="focus-counter">1 / ' + exercises.length + '</span>' +
    '</div>' +
    '<div class="flex-1 overflow-y-auto px-4 py-8 max-w-lg mx-auto w-full" id="focus-body"></div>' +
    '<div class="sticky bottom-0 z-[101] flex gap-3 border-t border-line bg-surface px-4 py-3 max-w-lg mx-auto w-full">' +
      '<button class="flex-1 rounded-xl bg-surface-2 px-4 py-3 font-medium text-body min-h-11" id="focus-prev" disabled>← Prev</button>' +
      '<button class="flex-1 rounded-xl bg-accent px-4 py-3 font-semibold text-white min-h-11" id="focus-next">Next →</button>' +
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

    function render() {
      var total = exercises.length;
      counterEl.textContent = (pos + 1) + " / " + total;
      progressEl.style.width = ((pos + 1) / total * 100) + "%";
      prevBtn.disabled = pos === 0;

      if (pos >= total) {
        // Done screen
        nextBtn.textContent = "Done ✓";
        bodyEl.innerHTML = '<div class="text-center py-16"><div class="text-6xl mb-4">🎉</div><h2 class="text-2xl font-bold text-heading">Done!</h2><p class="text-muted mt-2">Great workout!</p></div>';
        return;
      }

      nextBtn.textContent = pos === total - 1 ? "Done ✓" : "Next →";

      var ex = exercises[pos];
      var html = "";
      if (ex.demo) {
        html += '<img class="mx-auto h-[180px] w-[180px] rounded-xl bg-white object-cover mb-4" src="' + ex.demo + '" alt="' + ex.name + ' demonstration">';
      }
      html += '<h2 class="text-xl font-bold text-heading text-center">' + ex.name + '</h2>';
      html += '<p class="text-center text-muted tabular-nums mt-1">' + ex.sets + ' × ' + ex.reps +
        (ex.weight ? ' · ' + ex.weight + ' kg' : '') + '</p>';

      // Set checkboxes row
      if (ex.sets > 0) {
        html += '<div class="flex gap-2.5 justify-center mt-4" id="focus-sets-row"></div>';
      }
      bodyEl.innerHTML = html;

      // Populate checkboxes and sync with state
      var setsRow = document.getElementById("focus-sets-row");
      if (setsRow) {
        for (var s = 0; s < ex.sets; s++) {
          var box = document.createElement("input");
          box.type = "checkbox";
          box.className = "set-check";
          box.setAttribute("aria-label", "Set " + (s + 1) + " of " + ex.name);
          box.checked = !!(state[ex.id] && state[ex.id][s]);
          box.addEventListener("change", (function (id, s) {
            return function (e) {
              state[id] = state[id] || {};
              state[id][s] = e.target.checked;
              save();
              // Sync with the main page checkboxes
              var mainCard = visible.querySelector('[data-exercise-id="' + id + '"]');
              if (mainCard) {
                var mainBoxes = mainCard.querySelectorAll(".set-check");
                if (mainBoxes[s]) mainBoxes[s].checked = e.target.checked;
              }
            };
          })(ex.id, s));
          setsRow.appendChild(box);
        }
      }

      state._pos = pos;
      save();
    }

    function open() {
      pos = typeof state._pos === "number" ? state._pos : 0;
      if (pos >= exercises.length) pos = exercises.length - 1;
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
      save();
      if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    }

    function goNext() {
      if (pos >= exercises.length) { close(); return; }
      pos++;
      render();
    }

    function goPrev() {
      if (pos <= 0) return;
      pos--;
      render();
    }

    startBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    nextBtn.addEventListener("click", goNext);
    prevBtn.addEventListener("click", goPrev);

    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
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

    // Auto-reopen if focus was active on last visit
    if (state._focus) open();
  }

  // --- Service worker ---
  if ("serviceWorker" in navigator) {
    var base = document.body.getAttribute("data-base") || "/";
    navigator.serviceWorker.register(base + "sw.js").catch(function () {});
  }
})();
