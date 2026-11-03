// NZ Vitals: loads data/data.json and renders tiles, question cards and
// trend charts (with hover tooltips). No libraries.
(function () {
  "use strict";

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Display settings per indicator. Add an entry here when you add an indicator.
  var CFG = {
    cpi: { label: "CPI inflation", suffix: "y/y", change: "prev", changeNote: "vs prev. qtr",
           tip: "Annual change in the Consumers Price Index, the main measure of inflation in New Zealand." },
    unemployment: { label: "Unemployment", change: "prev", changeNote: "vs prev. qtr",
           tip: "Share of the labour force without a job and actively looking for one." },
    ocr: { label: "Official Cash Rate", change: "ytd", changeNote: "YTD", step: true,
           tip: "The Reserve Bank's policy interest rate. It sets the tone for mortgage and savings rates." },
    nzdusd: { label: "NZD / USD", change: "ytd", changeNote: "YTD",
           tip: "US dollars per New Zealand dollar. A higher number means a stronger NZ dollar." }
  };

  // The four question cards. rows: [label, indicator id, metric].
  var QUESTIONS = [
    { title: "Is inflation back within the target band?", link: "cpi",
      rows: [["Annual CPI inflation", "cpi", "latest"], ["Change from previous quarter", "cpi", "delta"]],
      note: "The Reserve Bank aims to keep annual CPI inflation between 1% and 3%, close to 2% over the medium term." },
    { title: "Is the labour market weakening?", link: "unemployment",
      rows: [["Unemployment rate", "unemployment", "latest"], ["Change from previous quarter", "unemployment", "delta"]],
      note: "A rising unemployment rate is one of the clearest signs that hiring is cooling." },
    { title: "Is monetary policy tightening or easing?", link: "ocr",
      rows: [["Official Cash Rate", "ocr", "latest"], ["Change since 31 Dec {y}", "ocr", "ytd"], ["Last change", "ocr", "lastchange"]],
      note: "Raising the OCR makes borrowing dearer and cools spending and inflation. Cutting it does the opposite." },
    { title: "What is the NZ dollar doing?", link: "nzdusd",
      rows: [["NZD/USD", "nzdusd", "latest"], ["Change since 31 Dec {y}", "nzdusd", "ytd"], ["12-month range (month-ends)", "nzdusd", "range"]],
      note: "A weaker NZ dollar makes imports dearer and tends to lift inflation. A stronger one does the opposite." }
  ];

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---- formatting ---------------------------------------------------------

  function isoToText(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MON[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  // A point shows its own label (e.g. "2026 Q2") if it has one, else its date.
  function fmtDate(p) { return p.label || isoToText(p.date); }

  function fmt(v, unit) {
    if (unit === "NZD/USD") return Number(v).toFixed(4);
    var n = Number(v).toFixed(2).replace(/0$/, ""); // 2.75, 2.5, 5.0
    return unit === "%" ? n + "%" : n;
  }

  // ---- metrics ------------------------------------------------------------

  function latest(ind) { return ind.series[ind.series.length - 1]; }

  // Last point on or before 31 Dec of the previous year.
  function baseline(s) {
    var cutoff = (parseInt(s[s.length - 1].date.slice(0, 4), 10) - 1) + "-12-31", base = null;
    s.forEach(function (p) { if (p.date <= cutoff) base = p; });
    return base;
  }

  // Change vs previous point ("prev") or since last year end ("ytd").
  function delta(ind, mode) {
    var s = ind.series, last = latest(ind);
    var ref = mode === "ytd" ? baseline(s) : s[s.length - 2];
    if (!ref) return null;
    var diff = last.value - ref.value, abs = Math.abs(diff);
    var sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
    var text = ind.unit === "%"
      ? (mode === "ytd" ? sign + Math.round(abs * 100) + " bp" : sign + Number(abs.toFixed(2)) + " pp")
      : sign + (abs / ref.value * 100).toFixed(1) + "%";
    return { text: text, dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat" };
  }

  function metric(ind, kind) {
    var s = ind.series, d, i;
    if (kind === "latest") return fmt(latest(ind).value, ind.unit);
    if (kind === "delta") { d = delta(ind, "prev"); return d ? d.text : "–"; }
    if (kind === "ytd") { d = delta(ind, "ytd"); return d ? d.text : "–"; }
    if (kind === "lastchange") {
      for (i = s.length - 1; i > 0; i--) if (s[i].value !== s[i - 1].value) return fmtDate(s[i]);
      return "No change in period";
    }
    if (kind === "range") {
      var v = s.map(function (p) { return p.value; });
      return fmt(Math.min.apply(null, v), ind.unit) + "–" + fmt(Math.max.apply(null, v), ind.unit);
    }
    return "–";
  }

  // Auto-written caption: updates itself whenever the data changes.
  function caption(ind) {
    var s = ind.series;
    if (s.length < 2) return "";
    var last = s[s.length - 1], prev = s[s.length - 2], diff = last.value - prev.value;
    var when = function (p) { return p.label ? "in " + p.label : "on " + isoToText(p.date); };
    var base = ind.name + " was " + fmt(last.value, ind.unit) + " " + when(last);
    if (diff === 0) return base + ", unchanged since " + fmtDate(prev) + ".";
    return base + ", " + (diff > 0 ? "up" : "down") + " from " + fmt(prev.value, ind.unit) + " " + when(prev) + ".";
  }

  // ---- components ---------------------------------------------------------

  function tile(ind) {
    var c = CFG[ind.id] || { label: ind.name, tip: "" };
    var chg = c.change ? delta(ind, c.change) : null;
    var el = document.createElement("div");
    el.className = "tile";
    el.innerHTML =
      '<span class="label" title="' + esc(c.tip) + '">' + esc(c.label) + "</span>" +
      '<div class="tile-value">' + esc(fmt(latest(ind).value, ind.unit)) +
        (c.suffix ? " <small>" + esc(c.suffix) + "</small>" : "") + "</div>" +
      '<div class="tile-meta"><span>' + esc(fmtDate(latest(ind))) + "</span>" +
        (chg ? '<span class="chg ' + chg.dir + '">' + esc(chg.text) + " " + esc(c.changeNote || "") + "</span>" : "") + "</div>" +
      (ind.placeholder ? '<span class="tag">Placeholder</span>' : "");
    return el;
  }

  function question(q, by) {
    var el = document.createElement("article"), html = "", sample = false;
    el.className = "qcard";
    q.rows.forEach(function (r) {
      var ind = by[r[1]];
      if (!ind) return;
      if (ind.placeholder) sample = true;
      var yr = parseInt(latest(ind).date.slice(0, 4), 10) - 1;
      html += '<div class="qrow"><span>' + esc(r[0].replace("{y}", yr)) + "</span><b>" + esc(metric(ind, r[2])) + "</b></div>";
    });
    el.innerHTML = "<h3>" + esc(q.title) + (sample ? '<span class="tag">Placeholder</span>' : "") + "</h3>" + html +
      '<p class="qnote">' + esc(q.note) + '</p><a class="qlink" href="#trend-' + esc(q.link) + '">See trend →</a>';
    return el;
  }

  function trendCard(ind) {
    var el = document.createElement("article");
    el.className = "card";
    el.id = "trend-" + ind.id;
    el.innerHTML =
      "<h2>" + esc(ind.name) + '<span class="tag">' + esc(ind.frequency) + "</span>" +
        (ind.placeholder ? '<span class="tag">Placeholder</span>' : "") + "</h2>" +
      '<div class="chart-host"></div>' +
      '<p class="summary">' + esc(caption(ind)) + "</p>" +
      '<p class="source">Source: <a href="' + esc(ind.url) + '">' + esc(ind.source) + "</a></p>";
    return el;
  }

  // ---- chart with hover tooltip --------------------------------------------

  function drawChart(host, ind) {
    var s = ind.series, step = (CFG[ind.id] || {}).step;
    var W = Math.max(host.clientWidth, 220), H = 150, L = 10, R = 10, T = 16, B = 24;
    var t = s.map(function (p) { return Date.parse(p.date); });
    var span = (t[t.length - 1] - t[0]) || 1;
    var vals = s.map(function (p) { return p.value; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.15 || 1;
    lo -= pad; hi += pad;
    var xs = t.map(function (v) { return L + (v - t[0]) / span * (W - L - R); });
    var ys = vals.map(function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); });

    // Rates like the OCR hold until the next decision, so draw them as steps.
    var d = "M" + xs[0].toFixed(1) + " " + ys[0].toFixed(1);
    for (var i = 1; i < s.length; i++) {
      if (step) d += " L" + xs[i].toFixed(1) + " " + ys[i - 1].toFixed(1);
      d += " L" + xs[i].toFixed(1) + " " + ys[i].toFixed(1);
    }
    var dots = xs.map(function (x, k) {
      var last = k === xs.length - 1;
      return '<circle class="dot' + (last ? " last" : "") + '" cx="' + x.toFixed(1) + '" cy="' + ys[k].toFixed(1) + '" r="' + (last ? 4 : 2.5) + '"/>';
    }).join("");

    host.innerHTML =
      '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(ind.name) + ' trend chart">' +
      '<line class="axis" x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '"/>' +
      '<path class="line" d="' + d + '"/>' + dots +
      '<line class="hline" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/>' +
      '<circle class="hdot" r="5" visibility="hidden"/>' +
      '<text x="' + L + '" y="' + (H - 6) + '">' + esc(fmtDate(s[0])) + "</text>" +
      '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtDate(s[s.length - 1])) + "</text>" +
      '</svg><div class="tip" role="status"></div>';

    var svg = host.querySelector("svg"), hl = svg.querySelector(".hline"), hd = svg.querySelector(".hdot"), tip = host.querySelector(".tip");

    function move(e) {
      var r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * (W / r.width), k = 0, best = Infinity;
      xs.forEach(function (x, j) { var dist = Math.abs(x - mx); if (dist < best) { best = dist; k = j; } });
      hl.setAttribute("x1", xs[k]); hl.setAttribute("x2", xs[k]); hl.setAttribute("visibility", "visible");
      hd.setAttribute("cx", xs[k]); hd.setAttribute("cy", ys[k]); hd.setAttribute("visibility", "visible");
      tip.innerHTML = "<span>" + esc(fmtDate(s[k])) + "</span><strong>" + esc(fmt(s[k].value, ind.unit)) + "</strong>";
      var below = ys[k] < 56;
      tip.style.left = Math.min(Math.max(xs[k], 56), W - 56) + "px";
      tip.style.top = (below ? ys[k] + 12 : ys[k] - 12) + "px";
      tip.className = "tip on" + (below ? " below" : "");
    }
    function hide() {
      hl.setAttribute("visibility", "hidden"); hd.setAttribute("visibility", "hidden"); tip.className = "tip";
    }
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerdown", move);
    svg.addEventListener("pointerleave", hide);
  }

  // Draw now and redraw whenever the card changes width (rotation, resize).
  function mountChart(host, ind) {
    var lastW = 0;
    function render() {
      var w = host.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      drawChart(host, ind);
    }
    if (window.ResizeObserver) new ResizeObserver(render).observe(host);
    else { render(); window.addEventListener("resize", render); }
  }

  // ---- start ----------------------------------------------------------------

  fetch("data/data.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var by = {};
      data.indicators.forEach(function (ind) { by[ind.id] = ind; });

      data.indicators.forEach(function (ind) { $("tiles").appendChild(tile(ind)); });
      QUESTIONS.forEach(function (q) { $("qgrid").appendChild(question(q, by)); });
      data.indicators.forEach(function (ind) {
        var card = trendCard(ind);
        $("grid").appendChild(card);
        mountChart(card.querySelector(".chart-host"), ind);
      });

      var when = data.updated ? isoToText(data.updated) : "–";
      $("updated").textContent = when;
      $("asof").textContent = when;
      $("notice").hidden = !data.placeholder;
      $("status").remove();
    })
    .catch(function (err) {
      $("status").textContent = "Could not load data (" + err.message + ").";
    });
})();
