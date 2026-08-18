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
      row.className = "sets-row";
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
  }

  // --- Export the day as plain text (paste into an agent / training log) ---
  function initExport(now, state) {
    var visible = document.querySelector("section[data-day]:not([hidden])");
    if (!visible) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "export-btn";
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

  // --- Service worker ---
  if ("serviceWorker" in navigator) {
    var base = document.body.getAttribute("data-base") || "/";
    navigator.serviceWorker.register(base + "sw.js").catch(function () {});
  }
})();
