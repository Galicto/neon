/**
 * Product demo login only. Not production auth.
 * Real staff access is /staff/login (server-side sessions).
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

  if (fill) {
    fill.addEventListener("click", function (e) {
      e.preventDefault();
      fillDemo();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (emailEl.value || "").trim().toLowerCase();
    var password = passEl.value || "";
    var ok = email === DEMO_EMAIL && password === DEMO_PASS;

    if (!ok) {
      showError("This is a product demo. Use the fill button, or sign in to staff at /staff/login.");
      return;
    }

    if (err) err.classList.remove("visible");
    if (btn) btn.disabled = true;
    persist(email);
    window.location.href = "dashboard.html";
  });
})();
