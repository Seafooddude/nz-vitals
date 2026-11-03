// NZ Vitals: loads data/data.json and renders one card per indicator.
(function () {
  "use strict";

  var grid = document.getElementById("grid");
  var statusEl = document.getElementById("status");
  var notice = document.getElementById("notice");
  var updatedEl = document.getElementById("updated");

  function fmt(v, unit) {
    var n = Number(v).toFixed(unit === "NZD/USD" ? 4 : 1);
    return unit === "%" ? n + "%" : n;
  }

  // Auto-generated caption so text updates with the data.
  function caption(ind) {
    var s = ind.series;
    if (s.length < 2) return "";
    var last = s[s.length - 1], prev = s[s.length - 2];
    var diff = last.value - prev.value;
    var dir = diff > 0 ? "up from" : diff < 0 ? "down from" : "unchanged from";
    var tail = diff === 0 ? "" : " " + fmt(prev.value, ind.unit);
    return ind.name + " was " + fmt(last.value, ind.unit) + " in " + last.date +
      ", " + dir + tail + " in " + prev.date + ".";
  }

  // Tiny dependency-free SVG line chart.
  function chart(series) {
    var W = 300, H = 140, P = 14;
    var vals = series.map(function (d) { return d.value; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    var pts = series.map(function (d, i) {
      var x = P + (i * (W - 2 * P)) / Math.max(series.length - 1, 1);
      var y = H - P - ((d.value - min) / (max - min)) * (H - 2 * P);
      return [x, y];
    });
    var line = pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    var last = pts[pts.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Trend chart">' +
      '<line class="axis" x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '"/>' +
      '<polyline class="line" points="' + line + '"/>' +
      '<circle class="dot" cx="' + last[0] + '" cy="' + last[1] + '" r="3.5"/></svg>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function card(ind) {
    var s = ind.series, last = s[s.length - 1];
    var el = document.createElement("article");
    el.className = "card";
    el.innerHTML =
      "<h2>" + esc(ind.name) + '<span class="tag">' + esc(ind.frequency) + "</span></h2>" +
      '<div class="value">' + fmt(last.value, ind.unit) + "</div>" +
      '<p class="change">' + esc(last.date) + "</p>" +
      chart(s) +
      '<p class="summary">' + esc(caption(ind)) + "</p>" +
      '<p class="source">Source: <a href="' + esc(ind.url) + '">' + esc(ind.source) + "</a></p>";
    return el;
  }

  fetch("data/data.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      data.indicators.forEach(function (ind) { grid.appendChild(card(ind)); });
      updatedEl.textContent = data.updated || "–";
      notice.hidden = !data.placeholder;
      statusEl.remove();
    })
    .catch(function (err) {
      statusEl.textContent = "Could not load data (" + err.message + ").";
    });
})();
