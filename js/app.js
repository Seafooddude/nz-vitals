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
    current_account: { label: "Current account", suffix: "NZ$bn", change: "prev", changeNote: "vs prev. qtr",
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

  // Plain-English notes for each indicator's own page.
  var NOTES = {
    gdp: ["The change in the volume of goods and services New Zealand produces from one quarter to the next, adjusted for inflation and seasonal patterns.",
          "It is the broadest measure of whether the economy is growing or shrinking. Two negative quarters in a row is a common rule of thumb for a recession. Quarterly figures jump around, so the trend matters more than any single quarter."],
    wages: ["Annual growth in the Labour Cost Index, which tracks what employers pay for the same job over time.",
            "Fast wage growth can keep inflation high, while slow growth squeezes household budgets. The Reserve Bank watches it for signs of pressure on prices."],
    unemployment: ["The share of the labour force that has no job and is actively looking for one, from the Household Labour Force Survey.",
                   "It lags the economy: it tends to rise after growth has already slowed and fall after it has recovered. The Reserve Bank reads it as a gauge of spare capacity in the labour market."],
    cpi: ["The annual change in the Consumers Price Index, the main measure of inflation in New Zealand.",
          "The Reserve Bank aims to keep annual inflation between 1% and 3%, focusing on 2% over the medium term. Inflation above the band tends to keep interest rates higher for longer and erodes what wages and savings can buy."],
    nontradables: ["Inflation in goods and services that are not traded internationally, such as rents, rates, insurance and local services.",
                   "Because it is driven by domestic demand and costs, it is a sign of underlying inflation pressure that the Reserve Bank watches closely."],
    houses: ["The annual change in house prices, using the Bank for International Settlements residential property price index.",
             "Housing is the largest asset for most New Zealand households, so price changes affect wealth, spending and borrowing. The series is quarterly and published with a lag."],
    consumer_conf: ["An OECD composite index built from household surveys, scaled so that 100 is the long-run average.",
                    "Confidence leads spending: households that feel worse about jobs and incomes tend to hold back. Above 100 is more upbeat than usual, below 100 is gloomier."],
    business_conf: ["An OECD composite index built from business surveys on output, orders and the outlook, scaled so that 100 is the long-run average.",
                    "Firms that expect weaker demand tend to cut back on hiring and investment, so it often turns before output and jobs do."],
    current_account: ["The balance of New Zealand's transactions with the rest of the world: trade in goods and services, investment income paid and received, and transfers. Shown in NZ$ billion per quarter.",
                      "A deficit means the country is borrowing from overseas to fund spending. A persistent, large deficit can leave the NZ dollar more exposed to shifts in global sentiment."],
    ocr: ["The Reserve Bank's policy interest rate, set at scheduled reviews during the year. The chart shows each change as a step.",
          "Raising the OCR makes borrowing dearer and cools spending and inflation. Cutting it does the opposite. It sets the tone for mortgage and savings rates."],
    bond10: ["The interest rate the government pays to borrow for ten years, taken from the secondary-market closing yield.",
             "It reflects expectations for inflation and the OCR, and it anchors longer-term fixed mortgage rates."],
    nzx50: ["An index of the 50 largest companies listed on the New Zealand sharemarket.",
            "A quick read on investor confidence and on how the market is pricing the outlook for company profits."],
    gdt: ["The Global Dairy Trade whole milk powder price in US dollars per tonne.",
          "Dairy is New Zealand's largest export, so this price influences farm incomes, export earnings and the NZ dollar."],
    nzdusd: ["US dollars per New Zealand dollar.",
             "A weaker NZ dollar makes imports dearer, which tends to lift inflation, and helps exporters. A stronger one does the opposite."],
    twi: ["The trade-weighted index measures the NZ dollar against a basket of 17 currencies, weighted by trade with each country.",
          "It gives a fuller picture than any single exchange rate, because it reflects the partners New Zealand actually trades with."]
  };

  // The Key Indicators tiles, in reading order: economy and prices on the first row, rates and sentiment on the second.
  var KEY_TILES = ["gdp", "unemployment", "wages", "cpi", "nontradables", "houses",
                   "ocr", "bond10", "nzdusd", "gdt", "consumer_conf", "business_conf"];

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
    var s = ind.series;
    return deltaVs(ind, mode === "ytd" ? baseline(s) : s[s.length - 2], mode);
  }

  function deltaVs(ind, ref, mode) {
    var last = latest(ind);
    if (!ref) return null;
    var diff = last.value - ref.value, abs = Math.abs(diff);
    var sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
    // Percent series: points. Balances (can be negative): change in NZ$ billion. Everything else: % change.
    var text = ind.unit === "%"
      ? (mode === "ytd" ? sign + Math.round(abs * 100) + " bp" : sign + Number(abs.toFixed(2)) + " pp")
      : ind.unit === "NZ$bn" ? sign + "NZ$" + abs.toFixed(2) + "bn"
      : sign + (abs / Math.abs(ref.value) * 100).toFixed(1) + "%";
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

  // ---- "new reading since your last visit" ----------------------------------------
  // We remember the newest date shown for each indicator. A tile gets a blue dot if its date is
  // newer than the one remembered from the previous visit. The baseline is kept for the browser
  // tab's session, so a refresh doesn't clear the dots; a new visit does. Storage can be blocked
  // (private windows), so every access is wrapped and the dots simply don't appear.
  var seenBase = {};
  function initSeen(data) {
    try {
      var base = sessionStorage.getItem("nzv.base");
      if (base === null) base = localStorage.getItem("nzv.seen") || "{}";
      sessionStorage.setItem("nzv.base", base);
      seenBase = JSON.parse(base) || {};
      var now = {};
      data.indicators.forEach(function (i) { if (!i.placeholder && i.series.length) now[i.id] = latest(i).date; });
      localStorage.setItem("nzv.seen", JSON.stringify(now));
    } catch (e) { seenBase = {}; }
  }
  function isNew(ind) {
    return !ind.placeholder && ind.series.length && seenBase[ind.id] && latest(ind).date > seenBase[ind.id];
  }

  // ---- components ---------------------------------------------------------

  function tile(ind) {
    var c = CFG[ind.id] || { label: ind.name, tip: "" };
    var el = document.createElement(ind.placeholder ? "div" : "a");
    el.className = "tile";
    if (!ind.placeholder) el.href = "indicator.html?id=" + encodeURIComponent(ind.id);
    if (ind.placeholder) {  // not connected yet: no figures, just the label
      el.className += " soon";
      el.innerHTML = '<div class="tile-top"><span class="label" title="' + esc(c.tip) + '">' + esc(c.label) + "</span></div>" +
        '<div class="tile-value">–</div><span class="tag">Coming soon</span>';
      return el;
    }
    var chg = c.change ? delta(ind, c.change) : null;
    el.innerHTML =
      '<div class="tile-top"><span class="label" title="' + esc(c.tip) + '">' + esc(c.label) + "</span>" +
      (isNew(ind) ? '<span class="newdot" title="New reading since your last visit" role="img" aria-label="New reading since your last visit"></span>' : "") + "</div>" +
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
      '<p class="qnote">' + esc(q.note) + '</p><a class="qlink" href="indicator.html?id=' + esc(q.link) + '">Full history →</a>';
    return el;
  }

  function trendCard(ind) {
    var el = document.createElement("article");
    el.className = "card";
    el.id = "trend-" + ind.id;
    el.innerHTML =
      "<h2>" + (ind.placeholder ? esc(ind.name) : '<a href="indicator.html?id=' + encodeURIComponent(ind.id) + '">' + esc(ind.name) + "</a>") + '<span class="tag">' + esc(ind.frequency) + "</span>" +
        (ind.placeholder ? '<span class="tag">Coming soon</span>' : "") + "</h2>" +
      (ind.placeholder ? '<p class="soon-text">Not connected to official data yet.</p>'
        : '<div class="chart-host"></div><p class="summary">' + esc(caption(ind)) + "</p>") +
      '<p class="source">' + (ind.placeholder ? "Planned source: " : "Source: ") + '<a href="' + esc(ind.url) + '">' + esc(ind.source) + "</a>" +
        (ind.placeholder ? "" : ' · <a href="indicator.html?id=' + encodeURIComponent(ind.id) + '">Full history →</a>') + "</p>";
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
    var W = Math.max(host.clientWidth, 220), H = parseInt(host.getAttribute("data-h"), 10) || 200, L = 40, R = 12, T = 14, B = 26;
    var t = s.map(function (p) { return Date.parse(p.date); });
    var span = (t[t.length - 1] - t[0]) || 1;
    var vals = s.map(function (p) { return p.value; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (cfg.band) { lo = Math.min(lo, cfg.band[0]); hi = Math.max(hi, cfg.band[1]); }
    if (cfg.ref != null) { lo = Math.min(lo, cfg.ref); hi = Math.max(hi, cfg.ref); }
    var pad = (hi - lo) * 0.12 || 1;
    lo -= pad; hi += pad;
    var nt = niceTicks(lo, hi, H > 260 ? 6 : 4);
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

  // ---- regional map + bars (shared by earnings and population) --------------------

  var RAMP = ["#dbe9f5", "#a9cbe6", "#6aa6d3", "#2e80bd", "#0a4f86"];

  // cfg.modes: [{id, label}], cfg.initial, cfg.group (aria label for the switch), cfg.mapLabel(mode),
  // cfg.build(mode) -> { rows: [{name, v, val, tip, aria}], fmt(v), nat (a dashed national marker, or null), note }
  function regionView(host, geo, cfg) {
    var mode = cfg.initial;

    function draw() {
      var b = cfg.build(mode);
      var rows = b.rows.slice().sort(function (x, y) { return y.v - x.v; });
      var vals = rows.map(function (i) { return i.v; });
      var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
      var max = Math.max(vmax, b.nat || 0) * 1.08;
      var nat = b.nat == null ? null : b.nat / max * 100;
      var shade = function (v) { return RAMP[Math.min(RAMP.length - 1, Math.floor((v - vmin) / ((vmax - vmin) || 1) * RAMP.length))]; };
      var byName = {};
      rows.forEach(function (i) { byName[i.name] = i; });

      var map = "";
      if (geo) {
        map = '<div class="rmap"><svg viewBox="0 0 ' + geo.width + " " + geo.height + '" role="group" aria-label="' + esc(cfg.mapLabel(mode)) + '">' +
          Object.keys(geo.regions).filter(function (n) { return byName[n]; }).map(function (n) {
            return '<path class="rpath" data-r="' + esc(n) + '" d="' + geo.regions[n] + '" fill="' + shade(byName[n].v) +
              '" tabindex="0" role="img" aria-label="' + esc(byName[n].aria) + '"/>';
          }).join("") + '</svg><div class="maptip" role="tooltip"></div>' +
          '<div class="rlegend"><span>' + esc(b.fmt(vmin)) + '</span><span class="ramp">' +
          RAMP.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + '</span><span>' + esc(b.fmt(vmax)) + "</span></div></div>";
      }

      host.innerHTML =
        '<div class="seg" role="group" aria-label="' + esc(cfg.group) + '">' +
          cfg.modes.map(function (m) {
            return '<button type="button" data-m="' + esc(m.id) + '" aria-pressed="' + (m.id === mode) + '">' + esc(m.label) + "</button>";
          }).join("") + "</div>" +
        '<div class="rwrap' + (geo ? " withmap" : "") + '">' + map +
        '<div class="rlist">' + rows.map(function (i) {
          return '<div class="rrow" tabindex="0" data-r="' + esc(i.name) + '">' +
            '<span class="rname">' + esc(i.name) + "</span>" +
            '<span class="rtrack"><span class="rbar" style="width:' + Math.max(0, i.v / max * 100).toFixed(1) + '%"></span>' +
              (nat == null ? "" : '<span class="rnat" style="left:' + nat.toFixed(1) + '%"></span>') + "</span>" +
            '<span class="rval">' + esc(i.val) + "</span>" +
            '<div class="rtip" role="tooltip">' + i.tip + "</div>" +
            "</div>";
        }).join("") + "</div></div>" +
        '<p class="rnote">' + b.note + "</p>";

      // Hovering or focusing a region on the map or in the list highlights both.
      var mapEl = host.querySelector(".rmap"), mtip = host.querySelector(".maptip");
      function light(name) {
        [].forEach.call(host.querySelectorAll("[data-r]"), function (el) {
          el.classList.toggle("on", name !== null && el.getAttribute("data-r") === name);
        });
      }
      function place(name, x, y) {
        if (!mtip) return;
        var it = byName[name];
        if (!it) { mtip.className = "maptip"; return; }
        var bx = mapEl.getBoundingClientRect();
        mtip.innerHTML = it.tip;
        mtip.style.left = Math.min(Math.max(x - bx.left, 90), bx.width - 90) + "px";
        mtip.style.top = (y - bx.top - 12) + "px";
        mtip.className = "maptip on";
      }
      host.querySelectorAll("[data-r]").forEach(function (el) {
        var name = el.getAttribute("data-r"), isPath = el.classList.contains("rpath");
        el.addEventListener("pointerenter", function (e) { light(name); if (isPath) place(name, e.clientX, e.clientY); });
        el.addEventListener("pointermove", function (e) { if (isPath) place(name, e.clientX, e.clientY); });
        el.addEventListener("pointerleave", function () { light(null); if (mtip) mtip.className = "maptip"; });
        el.addEventListener("focus", function () {
          light(name);
          if (isPath) { var r = el.getBoundingClientRect(); place(name, r.left + r.width / 2, r.top + r.height / 2); }
        });
        el.addEventListener("blur", function () { light(null); if (mtip) mtip.className = "maptip"; });
      });
    }

    host.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-m]");
      if (!btn || btn.getAttribute("data-m") === mode) return;
      mode = btn.getAttribute("data-m");
      draw();
      var again = host.querySelector('button[data-m="' + mode + '"]');
      if (again) again.focus();
    });
    draw();
  }

  // ---- earnings by region ----------------------------------------------------

  function renderRegions(r, host, geo) {
    if (!r) {
      host.innerHTML = '<p class="soon-text">Not connected to official data yet.</p>';
      return;
    }
    var money = function (v, m) {
      return "$" + (m === "hourly" ? Number(v).toFixed(2) : Math.round(v).toLocaleString("en-NZ"));
    };
    var change = function (cur, prev) {
      if (prev == null) return "";
      var p = (cur - prev) / prev * 100;
      return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(1) + "% on " + r.previous;
    };
    regionView(host, geo, {
      initial: "hourly",
      group: "Earnings measure",
      modes: [{ id: "hourly", label: "Median hourly" }, { id: "weekly", label: "Median weekly" }],
      mapLabel: function (m) { return "Map of median " + m + " earnings by region"; },
      build: function (mode) {
        var key = mode === "hourly" ? "median_hourly" : "median_weekly";
        var unit = mode === "hourly" ? " per hour" : " per week";
        return {
          fmt: function (v) { return money(v, mode); },
          nat: r.national[key],
          rows: r.items.map(function (i) {
            var ch = change(i[key], i["prev_" + key]);
            return { name: i.name, v: i[key], val: money(i[key], mode), aria: i.name + ": " + money(i[key], mode) + unit,
              tip: "<span>" + esc(i.name) + " · " + esc(r.periodLabel) + "</span><strong>" + esc(money(i[key], mode) + unit) + "</strong>" +
                   "<span>" + esc((ch ? ch + " · " : "") + Math.round(i.people * 1000).toLocaleString("en-NZ") + " people") + "</span>" };
          }),
          note: "Median " + mode + " earnings of people in paid employment, " + esc(r.periodLabel) +
            ". Dashed line: New Zealand overall (" + esc(money(r.national[key], mode)) + "). Source: " +
            '<a href="' + esc(r.url) + '">Stats NZ</a>. Survey estimates, so smaller regions can move around from year to year. ' +
            "Earnings from paid employment only: benefits and investment income are not included."
        };
      }
    });
  }

  // ---- population by region (latest base year and Stats NZ projections) -----------

  function renderPopulation(p, host, geo) {
    var n = function (v) { return Math.round(v).toLocaleString("en-NZ"); };
    var pct = function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"; };
    var base = String(p.baseYear), last = String(p.years[p.years.length - 1]);
    var shown = p.years.filter(function (y) { return (y - p.baseYear) % 10 === 0; }).map(String);
    var modes = shown.map(function (y) { return { id: y, label: y }; });   // the note and tooltip say which is the base year
    modes.push({ id: "growth", label: "Growth to " + last });

    regionView(host, geo, {
      initial: base,
      group: "Population year",
      modes: modes,
      mapLabel: function (m) { return m === "growth" ? "Map of projected population growth to " + last + " by region" : "Map of population in " + m + " by region"; },
      build: function (mode) {
        var src = '<a href="' + esc(p.url) + '">Stats NZ</a>';
        var tail = " Source: " + src + ", subnational population projections (" + esc(p.projection.toLowerCase()) + " scenario, base year " + esc(base) +
          "). Projections are not forecasts, and Stats NZ rounds them. " + esc(base) + " is the newest figure in this dataset.";
        if (mode === "growth") {
          var g = function (v) { return (v[last] - v[base]) / v[base] * 100; };
          return {
            fmt: pct,
            nat: g(p.national),
            rows: p.items.map(function (i) {
              var v = g(i.values);
              return { name: i.name, v: v, val: pct(v), aria: i.name + ": " + pct(v) + " by " + last,
                tip: "<span>" + esc(i.name) + " · " + esc(base) + " to " + esc(last) + "</span><strong>" + esc(pct(v)) + "</strong>" +
                     "<span>" + esc(n(i.values[base]) + " → " + n(i.values[last]) + " people") + "</span>" };
            }),
            note: "Projected change in population between " + esc(base) + " and " + esc(last) + ". Dashed line: New Zealand overall (" +
              esc(pct(g(p.national))) + ")." + tail
          };
        }
        var total = p.national[mode], isBase = mode === base;
        return {
          fmt: n,
          nat: null,
          rows: p.items.map(function (i) {
            var v = i.values[mode], d = v - i.values[base];
            var line = (v / total * 100).toFixed(1) + "% of New Zealand" +
              (isBase ? "" : " · " + (d >= 0 ? "+" : "−") + n(Math.abs(d)) + " (" + pct(d / i.values[base] * 100) + ") since " + base);
            return { name: i.name, v: v, val: n(v), aria: i.name + ": " + n(v) + " people in " + mode,
              tip: "<span>" + esc(i.name) + " · " + esc(mode) + (isBase ? " (base year)" : " (projected)") + "</span><strong>" + esc(n(v)) + " people</strong>" +
                   "<span>" + esc(line) + "</span>" };
          }),
          note: (isBase ? "Estimated" : "Projected") + " resident population at 30 June " + esc(mode) + ". New Zealand total: " + esc(n(total)) + "." + tail
        };
      }
    });
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

    if ($("jump")) $("jump").innerHTML = groups.map(function (g) { return '<a href="#g-' + g.id + '">' + esc(g.title) + "</a>"; }).join("");
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
    if (!box) return;
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

  // ---- indicator detail page (indicator.html?id=cpi) ----------------------------

  // The latest point on or before the same date a year earlier.
  function yearAgo(s) {
    var last = s[s.length - 1].date, cut = (parseInt(last.slice(0, 4), 10) - 1) + last.slice(4), base = null;
    s.forEach(function (p) { if (p.date <= cut) base = p; });
    return base;
  }

  function chgHtml(d) {
    return d ? '<span class="chg ' + d.dir + '">' + esc(d.text) + "</span>" : "–";
  }

  function renderDetail(data) {
    var root = $("detail"), id = new URLSearchParams(location.search).get("id");
    var ind = data.indicators.filter(function (i) { return i.id === id; })[0];
    if (!ind) {
      root.innerHTML = '<p class="crumb"><a href="index.html">← Dashboard</a></p><h1>Indicator not found</h1>' +
        '<p>There is no indicator called "' + esc(id || "") + '". <a href="index.html#key-indicators">See all indicators</a>.</p>';
      return;
    }
    var c = CFG[ind.id] || { label: ind.name, tip: "" }, notes = NOTES[ind.id] || [c.tip || "", ""];
    document.title = ind.name + " | NZ Vitals";
    // Each indicator is its own page, so give it its own canonical URL.
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.href = "https://nz-vitals.pages.dev/indicator.html?id=" + encodeURIComponent(ind.id);

    var linked = data.indicators.filter(function (i) { return !i.placeholder; });
    var pos = linked.indexOf(ind), prev = pos > 0 ? linked[pos - 1] : null, next = pos >= 0 && pos < linked.length - 1 ? linked[pos + 1] : null;
    var pn = '<nav class="pn" aria-label="Other indicators">' +
      (prev ? '<a href="indicator.html?id=' + encodeURIComponent(prev.id) + '">← ' + esc((CFG[prev.id] || {}).label || prev.name) + "</a>" : "<span></span>") +
      (next ? '<a href="indicator.html?id=' + encodeURIComponent(next.id) + '">' + esc((CFG[next.id] || {}).label || next.name) + " →</a>" : "<span></span>") + "</nav>";

    var head = '<p class="crumb"><a href="index.html">← Dashboard</a></p>' +
      "<h1>" + esc(ind.name) + '<span class="tag">' + esc(ind.frequency) + "</span></h1>";
    var about = '<section class="about-ind"><h2 class="section-title">What it measures</h2><p>' + esc(notes[0]) + "</p>" +
      '<h2 class="section-title">Why it matters</h2><p>' + esc(notes[1]) + "</p></section>";
    var src = '<p class="source">' + (ind.placeholder ? "Planned source: " : "Source: ") + '<a href="' + esc(ind.url) + '">' + esc(ind.source) + "</a> · " + esc(ind.frequency) + "</p>";

    if (ind.placeholder) {
      root.innerHTML = head + '<p class="soon-text">Not connected to official data yet.</p>' + about + src + pn;
      return;
    }

    var s = ind.series, last = latest(ind), step = c.step;
    var dPrev = deltaVs(ind, s[s.length - 2], "prev"), ya = yearAgo(s), dYear = ya ? deltaVs(ind, ya, "prev") : null;
    root.innerHTML = head +
      '<div class="hero"><div class="big">' + esc(fmt(last.value, ind.unit)) + (c.suffix ? " <small>" + esc(c.suffix) + "</small>" : "") + "</div>" +
        '<div class="hero-meta">' + esc(fmtDate(last)) + (dPrev ? " · " + chgHtml(dPrev) + " " + esc(c.changeNote || "vs previous") : "") + "</div></div>" +
      '<p class="lede">' + esc(caption(ind)) + "</p>" +
      '<div class="trend-bar"><p class="hint">Hover over (or tap) the chart to see the values.</p>' +
        '<div class="seg" id="range" role="group" aria-label="Chart time range">' +
          '<button type="button" data-y="1" aria-pressed="false">1Y</button>' +
          '<button type="button" data-y="5" aria-pressed="false">5Y</button>' +
          '<button type="button" data-y="0" aria-pressed="true">Max</button></div></div>' +
      '<article class="card bigchart"><div class="chart-host" data-h="340"></div></article>' +
      '<div class="stats" id="stats"></div>' +
      about +
      '<section><h2 class="section-title">Data</h2><div class="data-actions"><button type="button" class="btn" id="csv">Download CSV</button>' +
        '<button type="button" class="btn" id="more"></button></div><div id="dtable"></div></section>' +
      src + pn;

    mountChart(root.querySelector(".chart-host"), ind);

    // Stats for the chosen time range
    function stats() {
      var w = windowed(ind, step).filter(function (p) { return !p.synthetic; }), hi = w[0], lo = w[0];
      w.forEach(function (p) { if (p.value > hi.value) hi = p; if (p.value < lo.value) lo = p; });
      var span = rangeYears ? "last " + (rangeYears === 1 ? "year" : rangeYears + " years") : "all data";
      var box = function (label, big, small) {
        return '<div class="stat"><span class="label">' + esc(label) + "</span><b>" + big + "</b><small>" + esc(small || "") + "</small></div>";
      };
      $("stats").innerHTML =
        box("Latest", esc(fmt(last.value, ind.unit)), fmtDate(last)) +
        box("Change on previous", chgHtml(dPrev), s.length > 1 ? "from " + fmt(s[s.length - 2].value, ind.unit) + " in " + fmtDate(s[s.length - 2]) : "") +
        box("Change on a year ago", chgHtml(dYear), ya ? "from " + fmt(ya.value, ind.unit) + " in " + fmtDate(ya) : "") +
        box("Highest (" + span + ")", esc(fmt(hi.value, ind.unit)), fmtDate(hi)) +
        box("Lowest (" + span + ")", esc(fmt(lo.value, ind.unit)), fmtDate(lo));
    }
    stats();
    charts.push(stats);

    // Data table (newest first) and CSV
    var all = false;
    function table() {
      var idx = s.map(function (_, k) { return k; }).reverse();
      if (!all) idx = idx.slice(0, 12);
      $("dtable").innerHTML = '<table class="dtable"><thead><tr><th scope="col">Period</th><th scope="col" class="num">Value</th><th scope="col" class="num">Change on previous</th></tr></thead><tbody>' +
        idx.map(function (k) {
          var d = k > 0 ? deltaVs({ unit: ind.unit, series: [s[k]] }, s[k - 1], "prev") : null;
          return "<tr><td>" + esc(fmtDate(s[k])) + '</td><td class="num">' + esc(fmt(s[k].value, ind.unit)) + '</td><td class="num">' + chgHtml(d) + "</td></tr>";
        }).join("") + "</tbody></table>";
      $("more").textContent = all ? "Show latest 12" : "Show all " + s.length;
      $("more").hidden = s.length <= 12;
    }
    table();
    $("more").addEventListener("click", function () { all = !all; table(); });
    $("csv").addEventListener("click", function () {
      var rows = ["date,period,value"].concat(s.map(function (p) { return [p.date, '"' + fmtDate(p) + '"', p.value].join(","); }));
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([rows.join("\n") + "\n"], { type: "text/csv" }));
      a.download = "nz-vitals-" + ind.id + ".csv";
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  function startDetail() {
    rangeYears = 0;   // detail pages open on the full history
    fetch("data/data.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) { renderDetail(data); setupRange(); })
      .catch(function (err) {
        $("detail").innerHTML = '<p class="status">Could not load data (' + esc(err.message) + ").</p>";
      });
  }

  // ---- start ----------------------------------------------------------------

  if ($("detail")) { startDetail(); return; }
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

      initSeen(data);
      // The tile grid shows a fixed, even set of 12 (2 rows of 6, 3 of 4 or 6 of 2) so every row is full.
      // Everything else is still charted under Trends and has its own page.
      KEY_TILES.forEach(function (id) { if (by[id]) $("tiles").appendChild(tile(by[id])); });
      QUESTIONS.forEach(function (q) { $("qgrid").appendChild(question(q, by)); });
      renderRegions(data.regions, $("regions-body"), geo);
      // Population is optional: the section stays hidden if the data file doesn't have it yet.
      if (data.population && $("population")) {
        renderPopulation(data.population, $("population-body"), geo);
        $("population").hidden = false;
      }
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
