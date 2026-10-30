// FNF Shorts — loads clips.json (written by tools/build.py) and renders the grid and player.
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var grid = $("grid"), empty = $("empty"), search = $("search"), tagBar = $("tags");
  var player = $("player"), video = $("video");
  var hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var all = [], shown = [], current = -1;
  var state = { tag: "", sort: "new", q: "" };

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDur(sec) {
    if (!sec) return "";
    sec = Math.round(sec);
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- grid ----------
  function applyFilters() {
    var q = state.q.trim().toLowerCase();
    shown = all.filter(function (c) {
      if (state.tag && (c.tags || []).indexOf(state.tag) < 0) return false;
      if (q && (c.title + " " + (c.description || "") + " " + (c.tags || []).join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (state.sort === "shuffle") shuffle(shown);
    else {
      shown.sort(function (a, b) { return (a.date || "") < (b.date || "") ? -1 : (a.date || "") > (b.date || "") ? 1 : 0; });
      if (state.sort === "new") shown.reverse();
    }
    render();
  }

  function render() {
    grid.innerHTML = shown.map(function (c, i) {
      var portrait = c.height > c.width;
      var tags = (c.tags || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
      return '<a class="card" href="#' + encodeURIComponent(c.id) + '" data-i="' + i + '">' +
        '<div class="thumb' + (portrait ? " portrait" : "") + '"' +
          (portrait ? ' style="--poster:url(\'' + esc(c.poster) + '\')"' : "") + ">" +
          '<img src="' + esc(c.poster) + '" alt="" loading="lazy" decoding="async">' +
          '<span class="play"></span>' +
          (c.duration ? '<span class="dur">' + fmtDur(c.duration) + "</span>" : "") +
        "</div>" +
        '<div class="card-body"><h3>' + esc(c.title) + "</h3>" +
          '<div class="card-meta"><span>' + esc(fmtDate(c.date)) + '</span><span class="tags">' + tags + "</span></div>" +
        "</div></a>";
    }).join("");

    empty.hidden = shown.length > 0;
    if (!shown.length) empty.textContent = all.length ? "No clips match that." : "No clips yet — check back soon.";
  }

  function renderTags() {
    var set = {};
    all.forEach(function (c) { (c.tags || []).forEach(function (t) { set[t] = (set[t] || 0) + 1; }); });
    var names = Object.keys(set).sort();
    if (!names.length) { tagBar.innerHTML = ""; return; }
    tagBar.innerHTML = '<button type="button" data-tag="" class="on">All</button>' +
      names.map(function (t) { return '<button type="button" data-tag="' + esc(t) + '">' + esc(t) + "</button>"; }).join("");
  }

  tagBar.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.tag = b.getAttribute("data-tag");
    [].forEach.call(tagBar.children, function (x) { x.classList.toggle("on", x === b); });
    applyFilters();
  });
  document.querySelector("[data-sort]").parentNode.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sort]"); if (!b) return;
    state.sort = b.getAttribute("data-sort");
    [].forEach.call(b.parentNode.children, function (x) { x.classList.toggle("on", x === b); });
    applyFilters();
  });
  search.addEventListener("input", function () { state.q = search.value; applyFilters(); });

  grid.addEventListener("click", function (e) {
    var card = e.target.closest(".card");
    if (card) { e.preventDefault(); open(+card.getAttribute("data-i")); }
  });

  // Hover preview: play the clip muted inside the card (desktop only).
  if (hoverCapable) {
    grid.addEventListener("mouseover", function (e) {
      var card = e.target.closest(".card");
      if (!card || card.contains(e.relatedTarget)) return;
      var thumb = card.querySelector(".thumb"), c = shown[+card.getAttribute("data-i")];
      if (!c || thumb.querySelector("video")) return;
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto"; v.src = c.src;
      v.addEventListener("playing", function () { v.classList.add("playing"); });
      thumb.appendChild(v);
      v.play().catch(function () { });
    });
    grid.addEventListener("mouseout", function (e) {
      var card = e.target.closest(".card");
      if (!card || card.contains(e.relatedTarget)) return;
      var v = card.querySelector(".thumb video");
      if (v) { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); }
    });
  }

  // ---------- player ----------
  var autonext = $("autonext");
  autonext.checked = store.get("fnf-shorts-autonext") === "1";
  autonext.addEventListener("change", function () { store.set("fnf-shorts-autonext", autonext.checked ? "1" : "0"); });

  var lastFocus = null;
  function open(i) {
    if (!shown.length) return;
    current = (i + shown.length) % shown.length;
    var c = shown[current];
    if (player.hidden) lastFocus = document.activeElement;
    player.hidden = false;
    document.body.classList.add("locked");
    video.poster = c.poster;
    video.src = c.src;
    video.play().catch(function () { });
    $("player-title").textContent = c.title;
    $("player-meta").textContent = [fmtDate(c.date), (c.tags || []).join(" · "), c.description].filter(Boolean).join(" — ");
    $("download").href = c.src;
    $("download").setAttribute("download", c.file);
    $("prev").hidden = $("next").hidden = shown.length < 2;
    history.replaceState(null, "", "#" + encodeURIComponent(c.id));
    video.focus();
  }
  function close() {
    video.pause();
    video.removeAttribute("src"); video.load();
    player.hidden = true;
    document.body.classList.remove("locked");
    current = -1;
    history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus) lastFocus.focus();
  }

  $("prev").addEventListener("click", function () { open(current - 1); });
  $("next").addEventListener("click", function () { open(current + 1); });
  player.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) close(); });
  video.addEventListener("ended", function () { if (autonext.checked && shown.length > 1) open(current + 1); });

  $("copy").addEventListener("click", function () {
    var btn = this, url = location.href;
    var done = function () { btn.textContent = "Copied!"; setTimeout(function () { btn.textContent = "Copy link"; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt("Copy this link:", url); });
    else prompt("Copy this link:", url);
  });

  document.addEventListener("keydown", function (e) {
    if (player.hidden) {
      if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search.focus(); }
      return;
    }
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft" && e.target.tagName !== "INPUT") { e.preventDefault(); open(current - 1); }
    else if (e.key === "ArrowRight" && e.target.tagName !== "INPUT") { e.preventDefault(); open(current + 1); }
    else if (e.key === "Tab") {  // keep focus inside the dialog
      var f = player.querySelectorAll("button:not([hidden]), a, input, video");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var i = shown.findIndex(function (c) { return c.id === id; });
    if (i < 0) {  // shared link to a clip hidden by filters: clear them
      state.tag = ""; state.q = ""; search.value = "";
      applyFilters();
      i = shown.findIndex(function (c) { return c.id === id; });
    }
    if (i >= 0) open(i);
  }

  // ---------- load ----------
  fetch("clips.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      all = (data.clips || data).filter(function (c) { return c && c.src; });
      $("clip-count").textContent = all.length + (all.length === 1 ? " clip" : " clips");
      renderTags();
      applyFilters();
      openFromHash();
    })
    .catch(function () {
      empty.hidden = false;
      empty.textContent = "Couldn't load the clip list.";
    });
})();
