/* Hamburger menu for the header on phones. The button is added here, so pages without JavaScript keep a plain nav. */
(function () {
  var bar = document.querySelector(".topbar");
  var inner = document.querySelector(".topbar-inner");
  var nav = document.querySelector(".topbar .nav");
  if (!bar || !inner || !nav) return;

  nav.id = nav.id || "site-nav";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "menu-btn";
  btn.setAttribute("aria-controls", nav.id);
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", "Open menu");
  btn.innerHTML = '<span class="menu-bars" aria-hidden="true"></span>';
  inner.appendChild(btn);
  bar.classList.add("js-menu");

  function setOpen(open) {
    bar.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  btn.addEventListener("click", function () {
    setOpen(!bar.classList.contains("menu-open"));
  });

  // Close after choosing a link, on Escape, when tapping elsewhere, or when the screen widens.
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && bar.classList.contains("menu-open")) {
      setOpen(false);
      btn.focus();
    }
  });
  document.addEventListener("click", function (e) {
    if (!bar.contains(e.target)) setOpen(false);
  });
  window.addEventListener("resize", function () {
    if (window.innerWidth > 600) setOpen(false);
  });
})();
