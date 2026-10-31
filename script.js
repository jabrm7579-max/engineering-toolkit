"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- helpers ---------- */
function fmt(n){
  if (!isFinite(n)) return "—";
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a >= 1e9 || a < 1e-4) return n.toExponential(4).replace(/\.?0+e/, "e");
  return String(+n.toPrecision(7));
}
// -> {state:"empty"|"bad"|"ok", v}
function read(input, allowNeg){
  const raw = input.value.trim();
  input.classList.remove("bad");
  if (raw === "") return { state:"empty" };
  const v = Number(raw);
  if (!isFinite(v) || (!allowNeg && v < 0)){ input.classList.add("bad"); return { state:"bad" }; }
  return { state:"ok", v };
}
const NEG = "Negative values are not allowed here.";

/* ---------- theme ---------- */
const root = document.documentElement;
function setTheme(t){
  root.dataset.theme = t;
  $("#theme").textContent = t === "dark" ? "Light mode" : "Blueprint mode";
  try { localStorage.setItem("theme", t); } catch (e) {}
}
let savedTheme = null;
try { savedTheme = localStorage.getItem("theme"); } catch (e) {}
setTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
$("#theme").onclick = () => setTheme(root.dataset.theme === "dark" ? "light" : "dark");

/* ---------- tabs ---------- */
function openTab(id){
  if (!$("#" + id) || !$("#" + id).classList.contains("panel")) id = "conv";
  $$(".panel").forEach(p => p.hidden = p.id !== id);
  $$("nav button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === id));
}
$$("nav button").forEach(b => b.onclick = () => { openTab(b.dataset.tab); history.replaceState(null, "", "#" + b.dataset.tab); });
openTab(location.hash.slice(1) || "conv");

/* ---------- 1. unit converter ---------- */
const CAT = {
  Length:{ m:1, km:1e3, cm:.01, mm:.001, "µm":1e-6, in:.0254, ft:.3048, yd:.9144, mi:1609.344 },
  Mass:{ kg:1, g:.001, mg:1e-6, t:1e3, lb:.45359237, oz:.028349523125 },
  Area:{ "m²":1, "km²":1e6, "cm²":1e-4, "mm²":1e-6, ha:1e4, "ft²":.09290304, "in²":6.4516e-4, acre:4046.8564224 },
  Volume:{ L:1, mL:.001, "m³":1e3, "cm³":.001, gal:3.785411784, "fl oz":.0295735295625 },
  Speed:{ "m/s":1, "km/h":1/3.6, mph:.44704, kn:.514444444 },
  Pressure:{ Pa:1, kPa:1e3, bar:1e5, psi:6894.757293168, atm:101325 },
  Energy:{ J:1, kJ:1e3, Wh:3600, kWh:3.6e6, cal:4.184, BTU:1055.05585 },
  Temperature:null
};
const TEMP = ["°C", "°F", "K"];
let cat = "Length";
const units = () => cat === "Temperature" ? TEMP : Object.keys(CAT[cat]);
const toK = (v, u) => u === "°C" ? v + 273.15 : u === "°F" ? (v - 32) * 5 / 9 + 273.15 : v;
const fromK = (k, u) => u === "°C" ? k - 273.15 : u === "°F" ? (k - 273.15) * 9 / 5 + 32 : k;
function convert(v, a, b){
  if (cat === "Temperature") return fromK(toK(v, a), b);
  return v * CAT[cat][a] / CAT[cat][b];
}
function setCat(c){
  cat = c;
  $$("#cCats button").forEach(b => b.setAttribute("aria-pressed", b.textContent === c));
  const opts = units().map(u => `<option>${u}</option>`).join("");
  $("#cFrom").innerHTML = opts; $("#cTo").innerHTML = opts;
  $("#cTo").selectedIndex = 1;
  updConv();
}
function updConv(){
  const r = read($("#cVal"), cat === "Temperature"), from = $("#cFrom").value, to = $("#cTo").value;
  $("#cMsg").textContent = ""; $("#cAll").innerHTML = "";
  if (r.state !== "ok"){
    $("#cOut").textContent = "—"; $("#cExpr").textContent = "";
    $("#cMsg").textContent = r.state === "bad" ? "Enter a valid number. " + (cat === "Temperature" ? "" : NEG) : "";
    return;
  }
  if (cat === "Temperature" && toK(r.v, from) < 0){
    $("#cOut").textContent = "—"; $("#cMsg").textContent = "That is below absolute zero (0 K)."; return;
  }
  $("#cExpr").textContent = `${fmt(r.v)} ${from} =`;
  $("#cOut").textContent = `${fmt(convert(r.v, from, to))} ${to}`;
  $("#cAll").innerHTML = units().map(u =>
    `<button type="button" class="tile${u === to ? " on" : ""}" data-u="${u}"><span>${u}</span><b>${fmt(convert(r.v, from, u))}</b></button>`).join("");
}
$("#cCats").innerHTML = Object.keys(CAT).map(c => `<button type="button">${c}</button>`).join("");
$("#cCats").onclick = e => { if (e.target.tagName === "BUTTON") setCat(e.target.textContent); };
$("#cAll").onclick = e => { const t = e.target.closest(".tile"); if (t){ $("#cTo").value = t.dataset.u; updConv(); } };
["input", "change"].forEach(ev => { $("#cVal").addEventListener(ev, updConv); $("#cFrom").addEventListener(ev, updConv); $("#cTo").addEventListener(ev, updConv); });
$("#cSwap").onclick = () => { const f = $("#cFrom").value; $("#cFrom").value = $("#cTo").value; $("#cTo").value = f; updConv(); };
setCat("Length");

/* ---------- 2. Ohm's law and power ---------- */
const OF = [["V", "Voltage", "V"], ["I", "Current", "A"], ["R", "Resistance", "Ω"], ["P", "Power", "W"]];
let order = [];
$("#oFields").innerHTML = OF.map(([k, n, u]) =>
  `<div class="field" id="f${k}"><label>${n}<span class="row"><input id="o${k}" type="number" step="any" min="0" inputmode="decimal"><span class="u">${u}</span></span></label><div class="tag"></div></div>`).join("");
function solve(vals){
  let { V, I, R, P } = vals;
  const key = Object.keys(vals).sort((a, b) => "VIRP".indexOf(a) - "VIRP".indexOf(b)).join("");
  switch (key){
    case "VI": R = V / I; P = V * I; break;
    case "VR": I = V / R; P = V * V / R; break;
    case "VP": I = P / V; R = V * V / P; break;
    case "IR": V = I * R; P = I * I * R; break;
    case "IP": V = P / I; R = P / (I * I); break;
    case "RP": V = Math.sqrt(P * R); I = Math.sqrt(P / R); break;
  }
  return { V, I, R, P };
}
function refreshOhm(){
  const msg = $("#oMsg"); msg.textContent = "";
  OF.forEach(([k]) => { $("#f" + k).classList.remove("calc"); $("#f" + k + " .tag").textContent = ""; });
  ["V", "I", "R"].forEach(k => $("#t" + k).setAttribute("class", ""));
  const vals = {};
  for (const k of order){
    const r = read($("#o" + k));
    if (r.state === "bad"){ msg.textContent = "Enter a valid number. " + NEG; return; }
    vals[k] = r.v;
  }
  OF.forEach(([k]) => { if (!order.includes(k) && order.length < 2) $("#o" + k).value = ""; });
  order.forEach(k => { $("#f" + k + " .tag").textContent = "you entered"; if ("VIR".includes(k)) $("#t" + k).setAttribute("class", "in"); });
  if (order.length < 2) return;
  const out = solve(vals);
  if (Object.values(out).some(x => !isFinite(x))){
    msg.textContent = "These values need a division by zero. Change one of them.";
    OF.forEach(([k]) => { if (!order.includes(k)) $("#o" + k).value = ""; });
    return;
  }
  OF.forEach(([k]) => {
    if (order.includes(k)) return;
    $("#o" + k).value = fmt(out[k]); $("#o" + k).classList.remove("bad");
    $("#f" + k).classList.add("calc"); $("#f" + k + " .tag").textContent = "calculated";
    if ("VIR".includes(k)) $("#t" + k).setAttribute("class", "calc");
  });
}
OF.forEach(([k]) => $("#o" + k).addEventListener("input", () => {
  order = order.filter(x => x !== k);
  if ($("#o" + k).value.trim() !== ""){ order.push(k); if (order.length > 2) order.shift(); }
  refreshOhm();
}));
$("#oClear").onclick = () => { order = []; OF.forEach(([k]) => { $("#o" + k).value = ""; $("#o" + k).classList.remove("bad"); }); refreshOhm(); };

/* ---------- 3. shapes ---------- */
const PI = Math.PI;
const SH = {
  Circle:{ f:[["r", "Radius"]], cap:"Circle",
    svg:'<circle cx="100" cy="70" r="55"/><line class="d" x1="100" y1="70" x2="155" y2="70"/><circle cx="100" cy="70" r="2.5" class="d"/><text x="120" y="62">r</text>',
    out:o => [["Area", PI * o.r ** 2], ["Circumference", 2 * PI * o.r], ["Diameter", 2 * o.r]] },
  Rectangle:{ f:[["w", "Width"], ["h", "Height"]], cap:"Rectangle",
    svg:'<rect x="30" y="25" width="140" height="85"/><text x="95" y="128">w</text><text x="12" y="72">h</text>',
    out:o => [["Area", o.w * o.h], ["Perimeter", 2 * (o.w + o.h)], ["Diagonal", Math.hypot(o.w, o.h)]] },
  Sphere:{ f:[["r", "Radius"]], cap:"Sphere",
    svg:'<circle cx="100" cy="70" r="55"/><ellipse class="z" cx="100" cy="70" rx="55" ry="16"/><line class="d" x1="100" y1="70" x2="155" y2="70"/><text x="120" y="64">r</text>',
    out:o => [["Volume", 4 / 3 * PI * o.r ** 3], ["Surface area", 4 * PI * o.r ** 2], ["Diameter", 2 * o.r]] },
  Cylinder:{ f:[["r", "Radius"], ["h", "Height"]], cap:"Cylinder",
    svg:'<ellipse cx="100" cy="30" rx="55" ry="16"/><path d="M45 30v80M155 30v80M45 110a55 16 0 0 0 110 0"/><line class="d" x1="100" y1="30" x2="155" y2="30"/><text x="118" y="24">r</text><text x="164" y="74">h</text>',
    out:o => [["Volume", PI * o.r ** 2 * o.h], ["Lateral area", 2 * PI * o.r * o.h], ["Total surface", 2 * PI * o.r * (o.r + o.h)]] },
  Cone:{ f:[["r", "Radius"], ["h", "Height"]], cap:"Cone",
    svg:'<path d="M100 15L45 110a55 16 0 0 0 110 0z"/><path class="z" d="M45 110a55 16 0 0 1 110 0"/><line class="d" x1="100" y1="15" x2="100" y2="110"/><text x="106" y="66">h</text><text x="120" y="130">r</text>',
    out:o => { const l = Math.hypot(o.r, o.h); return [["Volume", PI * o.r ** 2 * o.h / 3], ["Lateral area", PI * o.r * l], ["Total surface", PI * o.r * (o.r + l)], ["Slant height", l]]; } }
};
let shape = "Circle";
function setShape(s){
  shape = s;
  $$("#gShapes button").forEach(b => b.setAttribute("aria-pressed", b.textContent === s));
  $("#gFields").innerHTML = SH[s].f.map(([k, n]) =>
    `<label>${n}<input id="g_${k}" type="number" step="any" min="0" inputmode="decimal"></label>`).join("");
  $("#gFields").oninput = updShape;
  $("#gSvg").innerHTML = SH[s].svg; $("#gCap").textContent = SH[s].cap;
  updShape();
}
function updShape(){
  const o = {}; let ok = true, bad = false;
  SH[shape].f.forEach(([k]) => { const r = read($("#g_" + k)); if (r.state === "bad") bad = true; if (r.state !== "ok") ok = false; o[k] = r.v; });
  $("#gMsg").textContent = bad ? "Enter valid numbers. " + NEG : "";
  $("#gRes").innerHTML = ok ? SH[shape].out(o).map(([n, v]) => `<div class="res"><span>${n}</span><b>${fmt(v)}</b></div>`).join("") : "";
}
$("#gShapes").innerHTML = Object.keys(SH).map(s => `<button type="button">${s}</button>`).join("");
$("#gShapes").onclick = e => { if (e.target.tagName === "BUTTON") setShape(e.target.textContent); };
setShape("Circle");

/* ---------- 4. resistor color code ---------- */
const COL = {
  Black:"#161616", Brown:"#7b4a2a", Red:"#d62d20", Orange:"#f28c28", Yellow:"#f5d90a", Green:"#2e9e4f",
  Blue:"#2a6fdb", Violet:"#8a4fd1", Grey:"#8d949b", White:"#f5f5f5", Gold:"#c9a227", Silver:"#b8bcc2"
};
const DIG = ["Black", "Brown", "Red", "Orange", "Yellow", "Green", "Blue", "Violet", "Grey", "White"];
const MUL = { Black:1, Brown:10, Red:100, Orange:1e3, Yellow:1e4, Green:1e5, Blue:1e6, Violet:1e7, Gold:.1, Silver:.01 };
const TOL = { Brown:1, Red:2, Green:.5, Blue:.25, Violet:.1, Grey:.05, Gold:5, Silver:10 };
function fillSel(id, names, def){
  $(id).innerHTML = names.map(n => `<option>${n}</option>`).join("");
  $(id).value = def;
}
fillSel("#rb1", DIG, "Brown"); fillSel("#rb2", DIG, "Black");
fillSel("#rm", Object.keys(MUL), "Red"); fillSel("#rt", Object.keys(TOL), "Gold");
function ohms(v){
  if (v >= 1e6) return fmt(v / 1e6) + " MΩ";
  if (v >= 1e3) return fmt(v / 1e3) + " kΩ";
  return fmt(v) + " Ω";
}
function updRes(){
  const a = $("#rb1").value, b = $("#rb2").value, m = $("#rm").value, t = $("#rt").value;
  [["#k1", a], ["#k2", b], ["#k3", m], ["#k4", t]].forEach(([id, c]) => $(id).setAttribute("fill", COL[c]));
  [["#rb1", a], ["#rb2", b], ["#rm", m], ["#rt", t]].forEach(([id, c]) => $(id).style.borderLeft = `8px solid ${COL[c]}`);
  const v = (DIG.indexOf(a) * 10 + DIG.indexOf(b)) * MUL[m], p = TOL[t];
  $("#rOut").textContent = `${ohms(v)} ±${p}%`;
  $("#rRange").textContent = `Range: ${ohms(v * (1 - p / 100))} to ${ohms(v * (1 + p / 100))}`;
}
["#rb1", "#rb2", "#rm", "#rt"].forEach(id => $(id).addEventListener("change", updRes));
updRes();
