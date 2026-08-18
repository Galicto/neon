/**
 * Mock client login. Demo-only — not a real auth system.
 */
(function () {
  var DEMO_EMAIL = "demo@neoautomations.com";
  var DEMO_PASS = "test@123";

  var form = document.getElementById("login-form");
  var emailEl = document.getElementById("login-email");
  var passEl = document.getElementById("login-password");
  var err = document.getElementById("login-error");
  var btn = document.getElementById("login-btn");
  var fill = document.getElementById("login-fill");
  if (!form || !emailEl || !passEl) return;

  function showError(msg) {
    if (!err) return;
    err.textContent = msg;
    err.classList.add("visible");
  }

  function fillDemo() {
    emailEl.value = DEMO_EMAIL;
    passEl.value = DEMO_PASS;
    if (err) err.classList.remove("visible");
  }

  function persist(email) {
    var payload = JSON.stringify({
      token: "demo",
      exp: Date.now() + 8 * 60 * 60 * 1000,
      user: { name: "Aarav Sharma", email: email || DEMO_EMAIL },
    });
    try { sessionStorage.setItem("neo_auth", payload); } catch (e) {}
    try { localStorage.setItem("neo_auth", payload); } catch (e) {}
  }

  function parse(email, password) {
    email = (email || "").trim().toLowerCase();
    password = (password || "").trim();
    if (email.indexOf("/") !== -1) {
      var parts = email.split("/");
      var left = (parts[0] || "").trim();
      var right = (parts[1] || "").trim();
      if (left) email = left;
      if (right && !password) password = right;
    }
    return { email: email, password: password };
  }

  if (fill) {
    fill.addEventListener("click", function (e) {
      e.preventDefault();
      fillDemo();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var parsed = parse(emailEl.value, passEl.value);
    var ok = parsed.password === DEMO_PASS;

    if (!ok) {
      showError("Use " + DEMO_EMAIL + " and password test@123");
      return;
    }

    if (err) err.classList.remove("visible");
    if (btn) btn.disabled = true;
    persist(parsed.email || DEMO_EMAIL);
    window.location.href = "dashboard.html";
  });
})();
