// NZ Vitals: loads data/data.json and renders tiles, question cards and
// trend charts (with hover tooltips). No libraries.
(function () {
  "use strict";

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Display settings per indicator. Add an entry here when you add an indicator.
  var CFG = {
    cpi: { label: "CPI inflation", suffix: "y/y", change: "prev", changeNote: "vs prev. qtr",
           band: [1, 3], ref: 2, refLabel: "RBNZ target 1–3%",
           tip: "Annual change in the Consumers Price Index, the main measure of inflation in New Zealand." },
    unemployment: { label: "Unemployment", change: "prev", changeNote: "vs prev. qtr",
           tip: "Share of the labour force without a job and actively looking for one." },
    ocr: { label: "Official Cash Rate", change: "ytd", changeNote: "YTD", step: true,
           tip: "The Reserve Bank's policy interest rate. It sets the tone for mortgage and savings rates." },
    nzdusd: { label: "NZD / USD", change: "ytd", changeNote: "YTD",
           tip: "US dollars per New Zealand dollar. A higher number means a stronger NZ dollar." },
    gdp: { label: "Real GDP", suffix: "q/q", change: "prev", changeNote: "vs prev. qtr",
           tip: "Quarterly growth in the volume of goods and services produced in New Zealand, adjusted for inflation." },
    wages: { label: "Wage growth", suffix: "y/y", change: "prev", changeNote: "vs prev. qtr",
           tip: "Annual growth in the Labour Cost Index: what employers pay for the same job. Feeds into inflation." },
    nontradables: { label: "Non-tradables", suffix: "y/y", change: "prev", changeNote: "vs prev. qtr",
           tip: "Annual inflation in goods and services not traded internationally (rents, rates, insurance, services). It is generated at home, so the RBNZ watches it closely." },
    houses: { label: "House prices", suffix: "y/y", change: "prev", changeNote: "vs prev. qtr",
           tip: "Annual change in house prices. Housing is a big part of household wealth and spending in New Zealand." },
    current_account: { label: "Current account", change: "prev", changeNote: "vs prev. qtr",
           tip: "Quarterly balance of New Zealand's trade, investment income and transfers with the world, in NZ$ billion. A deficit means the country is borrowing from abroad to fund spending." },
    consumer_conf: { label: "Consumer confidence", change: "prev", changeNote: "vs prev. month", ref: 100, refLabel: "Long-run average",
           tip: "OECD composite index of how households feel about the economy and their finances. 100 is the long-run average; above 100 is more upbeat than usual." },
    business_conf: { label: "Business confidence", change: "prev", changeNote: "vs prev. month", ref: 100, refLabel: "Long-run average",
           tip: "OECD composite index of firms' views on output, orders and the outlook. 100 is the long-run average; above 100 is more upbeat than usual." },
    bond10: { label: "10-year govt bond", change: "ytd", changeNote: "YTD",
           tip: "The interest rate the government pays to borrow for 10 years. It anchors long-term fixed mortgage rates." },
    nzx50: { label: "NZX 50", change: "ytd", changeNote: "YTD",
           tip: "Index of the 50 largest companies listed on the New Zealand sharemarket." },
    gdt: { label: "Dairy price (GDT)", change: "ytd", changeNote: "YTD",
           tip: "Global Dairy Trade whole milk powder price in US dollars per tonne. Dairy is New Zealand's biggest export, so this drives farm incomes and the NZ dollar." },
    twi: { label: "NZ dollar (TWI)", change: "ytd", changeNote: "YTD",
           tip: "Trade-weighted index: the NZ dollar against a basket of our main trading partners' currencies." }
  };

  // The four question cards. rows: [label, indicator id, metric].
  var QUESTIONS = [
    { title: "Is inflation back within the target band?", link: "cpi",
      rows: [["Annual CPI inflation", "cpi", "latest"], ["Within the 1–3% target band?", "cpi", "inband"], ["Change from previous quarter", "cpi", "delta"]],
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

  // Trend charts are shown in these groups, in this order. Indicators not listed land in "More".
  var GROUPS = [
    { id: "growth", title: "Growth and jobs", ids: ["gdp", "unemployment", "wages"] },
    { id: "prices", title: "Prices", ids: ["cpi", "nontradables", "houses"] },
    { id: "confidence", title: "Confidence", ids: ["consumer_conf", "business_conf"] },
    { id: "rates", title: "Interest rates and markets", ids: ["ocr", "bond10", "nzx50"] },
    { id: "dollar", title: "The NZ dollar and trade", ids: ["nzdusd", "twi", "current_account", "gdt"] }
  ];

  // Chart time range (years back from the newest point; 0 = everything we hold).
  var rangeYears = 5;
  var charts = [];

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
    if (unit === "US$/t") return "US$" + Math.round(v).toLocaleString("en-NZ");
    if (unit === "index") return v >= 1000 ? Math.round(v).toLocaleString("en-NZ") : Number(v).toFixed(1);
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
    if (kind === "inband") {
      var cv = latest(ind).value;
      return cv > 3 ? "No: " + (cv - 3).toFixed(1) + " pp above" : cv < 1 ? "No: " + (1 - cv).toFixed(1) + " pp below" : "Yes";
    }
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
    var el = document.createElement("div");
    el.className = "tile";
    if (ind.placeholder) {  // not connected yet: no figures, just the label
      el.className += " soon";
      el.innerHTML = '<span class="label" title="' + esc(c.tip) + '">' + esc(c.label) + "</span>" +
        '<div class="tile-value">–</div><span class="tag">Coming soon</span>';
      return el;
    }
    var chg = c.change ? delta(ind, c.change) : null;
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
      if (ind.placeholder) { sample = true; return; }
      var yr = parseInt(latest(ind).date.slice(0, 4), 10) - 1;
      var dd = r[2] === "delta" ? delta(ind, "prev") : r[2] === "ytd" ? delta(ind, "ytd") : null;
      html += '<div class="qrow"><span>' + esc(r[0].replace("{y}", yr)) + "</span><b" + (dd ? ' class="chg ' + dd.dir + '"' : "") + ">" + esc(metric(ind, r[2])) + "</b></div>";
    });
    el.innerHTML = "<h3>" + esc(q.title) + (sample ? '<span class="tag">Coming soon</span>' : "") + "</h3>" +
      (sample && !html ? '<p class="soon-text">Not connected to official data yet.</p>' : html) +
      '<p class="qnote">' + esc(q.note) + '</p><a class="qlink" href="#trend-' + esc(q.link) + '">See trend →</a>';
    return el;
  }

  function trendCard(ind) {
    var el = document.createElement("article");
    el.className = "card";
    el.id = "trend-" + ind.id;
    el.innerHTML =
      "<h2>" + esc(ind.name) + '<span class="tag">' + esc(ind.frequency) + "</span>" +
        (ind.placeholder ? '<span class="tag">Coming soon</span>' : "") + "</h2>" +
      (ind.placeholder ? '<p class="soon-text">Not connected to official data yet.</p>'
        : '<div class="chart-host"></div><p class="summary">' + esc(caption(ind)) + "</p>") +
      '<p class="source">' + (ind.placeholder ? "Planned source: " : "Source: ") + '<a href="' + esc(ind.url) + '">' + esc(ind.source) + "</a></p>";
    return el;
  }

  // ---- chart with axes, target band and hover tooltip -------------------------

  // The slice of the series to show for the chosen time range.
  function windowed(ind, step) {
    var s = ind.series, out = s;
    if (rangeYears) {
      var last = s[s.length - 1].date;
      var cut = (parseInt(last.slice(0, 4), 10) - rangeYears) + last.slice(4);
      out = s.filter(function (p) { return p.date >= cut; });
      // A step series (the OCR) holds its value between decisions, so start the
      // window with the rate that was in force on the cut-off date.
      if (step && out.length && out[0].date > cut) {
        var i = s.indexOf(out[0]);
        if (i > 0) out.unshift({ date: cut, value: s[i - 1].value });
      }
    }
    return out.length < 2 ? s.slice(-2) : out;
  }

  function niceTicks(lo, hi, n) {
    var raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), r = raw / mag;
    var step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, t = [];
    for (var v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) t.push(Math.round(v / step) * step);
    return { ticks: t, step: step };
  }

  function tickText(v, unit, step) {
    var dec = Math.max(0, Math.ceil(-Math.log(step) / Math.LN10 - 1e-9));
    var n = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-NZ") : v.toFixed(dec);
    return unit === "%" ? n + "%" : unit === "US$/t" ? "US$" + n : n;
  }

  // Date ticks for the x axis: whole years for long spans, otherwise evenly spaced months.
  function xTicks(t0, t1) {
    var out = [], YR = 365.25 * 864e5;
    if (t1 - t0 > 2 * YR) {
      var y0 = new Date(t0).getUTCFullYear() + 1, y1 = new Date(t1).getUTCFullYear();
      var k = Math.max(1, Math.ceil((y1 - y0 + 1) / 6));
      for (var y = y0; y <= y1; y += k) out.push({ t: Date.UTC(y, 0, 1), text: String(y) });
    } else {
      for (var i = 0; i <= 4; i++) {
        var t = t0 + (t1 - t0) * i / 4, d = new Date(t);
        out.push({ t: t, text: MON[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2) });
      }
    }
    return out;
  }

  function drawChart(host, ind) {
    var cfg = CFG[ind.id] || {}, step = cfg.step;
    var s = windowed(ind, step);
    var W = Math.max(host.clientWidth, 220), H = 200, L = 40, R = 12, T = 14, B = 26;
    var t = s.map(function (p) { return Date.parse(p.date); });
    var span = (t[t.length - 1] - t[0]) || 1;
    var vals = s.map(function (p) { return p.value; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (cfg.band) { lo = Math.min(lo, cfg.band[0]); hi = Math.max(hi, cfg.band[1]); }
    if (cfg.ref != null) { lo = Math.min(lo, cfg.ref); hi = Math.max(hi, cfg.ref); }
    var pad = (hi - lo) * 0.12 || 1;
    lo -= pad; hi += pad;
    var nt = niceTicks(lo, hi, 4);
    var X = function (v) { return L + (v - t[0]) / span * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    var xs = t.map(X), ys = vals.map(Y);

    // Rates like the OCR hold until the next decision, so draw them as steps.
    var d = "M" + xs[0].toFixed(1) + " " + ys[0].toFixed(1);
    for (var i = 1; i < s.length; i++) {
      if (step) d += " L" + xs[i].toFixed(1) + " " + ys[i - 1].toFixed(1);
      d += " L" + xs[i].toFixed(1) + " " + ys[i].toFixed(1);
    }
    var dots = xs.map(function (x, k) {
      var last = k === xs.length - 1;
      if (!last && s.length > 24) return "";
      return '<circle class="dot' + (last ? " last" : "") + '" cx="' + x.toFixed(1) + '" cy="' + ys[k].toFixed(1) + '" r="' + (last ? 4 : 2.5) + '"/>';
    }).join("");

    var grid = nt.ticks.map(function (v) {
      var y = Y(v).toFixed(1);
      return '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>' +
             '<text class="yt" x="' + (L - 6) + '" y="' + (Number(y) + 3.5) + '" text-anchor="end">' + esc(tickText(v, ind.unit, nt.step)) + "</text>";
    }).join("");
    // Zero line for series that cross zero (growth rates, balances).
    var zero = lo < 0 && hi > 0 ? '<line class="zero" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '"/>' : "";
    var band = "", ref = "";
    if (cfg.band) {
      band = '<rect class="band" x="' + L + '" width="' + (W - L - R) + '" y="' + Y(cfg.band[1]).toFixed(1) + '" height="' + (Y(cfg.band[0]) - Y(cfg.band[1])).toFixed(1) + '"/>';
    }
    if (cfg.ref != null) {
      var ry = Y(cfg.ref);
      ref = '<line class="ref" x1="' + L + '" x2="' + (W - R) + '" y1="' + ry.toFixed(1) + '" y2="' + ry.toFixed(1) + '"/>' +
            (cfg.refLabel ? '<text class="reft" x="' + (W - R - 4) + '" y="' + (cfg.band ? Y(cfg.band[0]) + 12 : ry - 4).toFixed(1) + '" text-anchor="end">' + esc(cfg.refLabel) + "</text>" : "");
    }
    var xt = xTicks(t[0], t[t.length - 1]).map(function (k) {
      var x = X(k.t), a = x < L + 16 ? "start" : x > W - R - 16 ? "end" : "middle";
      return '<line class="tick" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (H - B) + '" y2="' + (H - B + 4) + '"/>' +
             '<text x="' + x.toFixed(1) + '" y="' + (H - 7) + '" text-anchor="' + a + '">' + esc(k.text) + "</text>";
    }).join("");

    host.innerHTML =
      '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(ind.name) + " trend chart. " + esc(caption(ind)) + ' Use the arrow keys to read each value.">' +
      grid + band + zero + ref +
      '<line class="axis" x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '"/>' + xt +
      '<path class="line" d="' + d + '"/>' + dots +
      '<line class="hline" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/>' +
      '<circle class="hdot" r="5" visibility="hidden"/>' +
      '</svg><div class="tip" role="status"></div>';

    var svg = host.querySelector("svg"), hl = svg.querySelector(".hline"), hd = svg.querySelector(".hdot"), tip = host.querySelector(".tip");
    var cur = s.length - 1;

    function move(e) {
      var r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * (W / r.width), k = 0, best = Infinity;
      xs.forEach(function (x, j) { var dist = Math.abs(x - mx); if (dist < best) { best = dist; k = j; } });
      show(k);
    }
    function show(k) {
      cur = k;
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
    // Keyboard: Tab to the chart, then use the arrow keys to step through the points.
    svg.setAttribute("tabindex", "0");
    svg.addEventListener("focus", function () { show(cur); });
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      var st = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 :
               e.key === "Home" ? -s.length : e.key === "End" ? s.length : 0;
      if (!st) return;
      e.preventDefault();
      show(Math.max(0, Math.min(s.length - 1, cur + st)));
    });
  }

  // Draw now and redraw whenever the card changes width (rotation, resize) or the range changes.
  function mountChart(host, ind) {
    var lastW = 0;
    function render(force) {
      var w = host.clientWidth;
      if (!w || (w === lastW && force !== true)) return;
      lastW = w;
      drawChart(host, ind);
    }
    if (window.ResizeObserver) new ResizeObserver(function () { render(); }).observe(host);
    else { render(true); window.addEventListener("resize", function () { render(); }); }
    charts.push(function () { render(true); });
  }

  // ---- earnings by region (map + bars) ----------------------------------------

  var RAMP = ["#dbe9f5", "#a9cbe6", "#6aa6d3", "#2e80bd", "#0a4f86"];

  function renderRegions(r, host, geo) {
    if (!r) {
      host.innerHTML = '<p class="soon-text">Not connected to official data yet.</p>';
      return;
    }
    var mode = "hourly";
    var money = function (v, m) {
      return "$" + (m === "hourly" ? Number(v).toFixed(2) : Math.round(v).toLocaleString("en-NZ"));
    };
    var change = function (cur, prev) {
      if (prev == null) return "";
      var p = (cur - prev) / prev * 100;
      return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(1) + "% on " + r.previous;
    };

    function draw() {
      var key = mode === "hourly" ? "median_hourly" : "median_weekly";
      var unit = mode === "hourly" ? " per hour" : " per week";
      var rows = r.items.slice().sort(function (a, b) { return b[key] - a[key]; });
      var vals = rows.map(function (i) { return i[key]; });
      var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
      var max = Math.max(vmax, r.national[key]) * 1.08;
      var nat = r.national[key] / max * 100;
      var shade = function (v) { return RAMP[Math.min(RAMP.length - 1, Math.floor((v - vmin) / ((vmax - vmin) || 1) * RAMP.length))]; };
      var tipText = function (i) {
        var ch = change(i[key], i["prev_" + key]);
        return "<span>" + esc(i.name) + " · " + esc(r.periodLabel) + "</span><strong>" + esc(money(i[key], mode) + unit) + "</strong>" +
               "<span>" + esc((ch ? ch + " · " : "") + Math.round(i.people * 1000).toLocaleString("en-NZ") + " people") + "</span>";
      };

      var map = "";
      if (geo) {
        var byName = {};
        rows.forEach(function (i) { byName[i.name] = i; });
        map = '<div class="rmap"><svg viewBox="0 0 ' + geo.width + " " + geo.height + '" role="group" aria-label="Map of median ' + mode + ' earnings by region">' +
          Object.keys(geo.regions).filter(function (n) { return byName[n]; }).map(function (n) {
            var i = byName[n];
            return '<path class="rpath" data-r="' + esc(n) + '" d="' + geo.regions[n] + '" fill="' + shade(i[key]) + '" tabindex="0" role="img" aria-label="' +
              esc(n + ": " + money(i[key], mode) + unit) + '"/>';
          }).join("") + '</svg><div class="maptip" role="tooltip"></div>' +
          '<div class="rlegend"><span>' + esc(money(vmin, mode)) + '</span><span class="ramp">' +
          RAMP.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + '</span><span>' + esc(money(vmax, mode)) + "</span></div></div>";
      }

      host.innerHTML =
        '<div class="seg" role="group" aria-label="Earnings measure">' +
          ["hourly", "weekly"].map(function (m) {
            return '<button type="button" data-m="' + m + '" aria-pressed="' + (m === mode) + '">Median ' + m + "</button>";
          }).join("") + "</div>" +
        '<div class="rwrap' + (geo ? " withmap" : "") + '">' + map +
        '<div class="rlist">' + rows.map(function (i) {
          return '<div class="rrow" tabindex="0" data-r="' + esc(i.name) + '">' +
            '<span class="rname">' + esc(i.name) + "</span>" +
            '<span class="rtrack"><span class="rbar" style="width:' + (i[key] / max * 100).toFixed(1) + '%"></span>' +
              '<span class="rnat" style="left:' + nat.toFixed(1) + '%"></span></span>' +
            '<span class="rval">' + esc(money(i[key], mode)) + "</span>" +
            '<div class="rtip" role="tooltip">' + tipText(i) + "</div>" +
            "</div>";
        }).join("") + "</div></div>" +
        '<p class="rnote">Median ' + mode + " earnings of people in paid employment, " + esc(r.periodLabel) +
          ". Dashed line: New Zealand overall (" + esc(money(r.national[key], mode)) + "). Source: " +
          '<a href="' + esc(r.url) + '">Stats NZ</a>. Survey estimates, so smaller regions can move around from year to year. ' +
          "Earnings from paid employment only: benefits and investment income are not included.</p>";

      // Hovering or focusing a region on the map or in the list highlights both.
      var mapEl = host.querySelector(".rmap"), mtip = host.querySelector(".maptip");
      function light(name) {
        [].forEach.call(host.querySelectorAll("[data-r]"), function (el) {
          el.classList.toggle("on", name !== null && el.getAttribute("data-r") === name);
        });
      }
      function place(name, x, y) {
        if (!mtip) return;
        var it = byName && byName[name];
        if (!it) { mtip.className = "maptip"; return; }
        var b = mapEl.getBoundingClientRect();
        mtip.innerHTML = tipText(it);
        mtip.style.left = Math.min(Math.max(x - b.left, 90), b.width - 90) + "px";
        mtip.style.top = (y - b.top - 12) + "px";
        mtip.className = "maptip on";
      }
      host.querySelectorAll("[data-r]").forEach(function (el) {
        var name = el.getAttribute("data-r"), isPath = el.classList.contains("rpath");
        el.addEventListener("pointerenter", function (e) { light(name); if (isPath) place(name, e.clientX, e.clientY); });
        el.addEventListener("pointermove", function (e) { if (isPath) place(name, e.clientX, e.clientY); });
        el.addEventListener("pointerleave", function () { light(null); if (mtip) mtip.className = "maptip"; });
        el.addEventListener("focus", function () {
          light(name);
          if (isPath) { var b = el.getBoundingClientRect(); place(name, b.left + b.width / 2, b.top + b.height / 2); }
        });
        el.addEventListener("blur", function () { light(null); if (mtip) mtip.className = "maptip"; });
      });
    }

    host.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-m]");
      if (!b || b.getAttribute("data-m") === mode) return;
      mode = b.getAttribute("data-m");
      draw();
      var again = host.querySelector('button[data-m="' + mode + '"]');
      if (again) again.focus();
    });
    draw();
  }

  // ---- trend sections -----------------------------------------------------------

  function renderTrends(data) {
    var by = {}, used = {}, grid = $("grid");
    data.indicators.forEach(function (ind) { by[ind.id] = ind; });
    var groups = GROUPS.map(function (g) {
      return { id: g.id, title: g.title, inds: g.ids.filter(function (id) { return by[id]; }).map(function (id) { used[id] = 1; return by[id]; }) };
    });
    var rest = data.indicators.filter(function (i) { return !used[i.id]; });
    if (rest.length) groups.push({ id: "more", title: "More", inds: rest });
    groups = groups.filter(function (g) { return g.inds.length; });

    $("jump").innerHTML = groups.map(function (g) { return '<a href="#g-' + g.id + '">' + esc(g.title) + "</a>"; }).join("");
    groups.forEach(function (g) {
      var sec = document.createElement("section");
      sec.className = "tgroup";
      sec.id = "g-" + g.id;
      sec.innerHTML = '<h3 class="group-title">' + esc(g.title) + '</h3><div class="grid"></div>';
      var gg = sec.querySelector(".grid");
      g.inds.forEach(function (ind) {
        var card = trendCard(ind);
        gg.appendChild(card);
        var host = card.querySelector(".chart-host");
        if (host) mountChart(host, ind);
      });
      grid.appendChild(sec);
    });
  }

  function setupRange() {
    var box = $("range");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-y]");
      if (!b) return;
      rangeYears = parseInt(b.getAttribute("data-y"), 10);
      [].forEach.call(box.querySelectorAll("button"), function (x) {
        x.setAttribute("aria-pressed", String(x === b));
      });
      charts.forEach(function (f) { f(); });
    });
  }

  // ---- start ----------------------------------------------------------------

  setupRange();
  Promise.all([
    fetch("data/data.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }),
    // The map is optional: if it fails to load, the bars still show.
    fetch("data/nz-regions.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ])
    .then(function (res) {
      var data = res[0], geo = res[1];
      var by = {};
      data.indicators.forEach(function (ind) { by[ind.id] = ind; });

      data.indicators.forEach(function (ind) { $("tiles").appendChild(tile(ind)); });
      QUESTIONS.forEach(function (q) { $("qgrid").appendChild(question(q, by)); });
      renderRegions(data.regions, $("regions-body"), geo);
      renderTrends(data);

      // "As of" = the date of the newest real (non-placeholder) observation.
      var real = data.indicators.filter(function (i) { return !i.placeholder; })
        .map(function (i) { return latest(i).date; }).sort().pop();
      var when = data.updated ? isoToText(data.updated) : "–";
      $("updated").textContent = when;
      $("asof").textContent = real ? isoToText(real) : when;
      // Warn visitors if the robot has stopped and the numbers have gone stale.
      if (real && (Date.now() - Date.parse(real)) / 864e5 > 10) {
        $("stale").textContent = "The newest figure on this page is from " + isoToText(real) +
          ". Automatic updates may have stopped.";
        $("stale").hidden = false;
      }
      $("notice").hidden = !data.placeholder;
      $("status").remove();
    })
    .catch(function (err) {
      $("status").textContent = "Could not load data (" + err.message + ").";
    });
})();
