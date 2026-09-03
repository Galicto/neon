/**
 * js/login.js
 * Replaces the hardcoded demo check with real Supabase Auth.
 * The UX is identical — same form, same fill button, same redirect.
 *
 * Depends on js/supabase-client.js loaded first in login.html:
 *   <script src="js/supabase-client.js"></script>
 *   <script src="js/login.js"></script>
 */
(function () {
  var form    = document.getElementById('login-form');
  var emailEl = document.getElementById('login-email');
  var passEl  = document.getElementById('login-password');
  var err     = document.getElementById('login-error');
  var btn     = document.getElementById('login-btn');
  var fill    = document.getElementById('login-fill');

  if (!form || !emailEl || !passEl) return;

  var DEMO_EMAIL = 'demo@neoautomations.com';
  var DEMO_PASS  = 'test@123';

  function showError(msg) {
    if (!err) return;
    err.textContent = msg || 'Invalid email or password. Please try again.';
    err.classList.add('visible');
  }
  function clearError() {
    if (err) err.classList.remove('visible');
  }
  function setLoading(on) {
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? 'Signing in…' : 'Sign in';
  }

  // Fill button — same behaviour as before
  if (fill) {
    fill.addEventListener('click', function (e) {
      e.preventDefault();
      emailEl.value = DEMO_EMAIL;
      passEl.value  = DEMO_PASS;
      clearError();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var email    = (emailEl.value || '').trim().toLowerCase();
    var password = passEl.value || '';

    if (!email || !password) {
      showError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    // Supabase Auth — works for any user created in Authentication > Users
    NeoSupabase.init(function (sb) {
      sb.auth.signInWithPassword({ email: email, password: password })
        .then(function (res) {
          if (res.error) {
            setLoading(false);
            showError(res.error.message || 'Invalid email or password.');
            return;
          }
          // Session is stored automatically by Supabase in localStorage.
          // Write the same neo_auth key for any legacy code that reads it.
          var user = res.data.user;
          var payload = JSON.stringify({
            token: res.data.session.access_token,
            exp:   new Date(res.data.session.expires_at * 1000).getTime(),
            user:  {
              name:      (user.user_metadata && user.user_metadata.name) || user.email,
              email:     user.email,
              client_id: (user.app_metadata && user.app_metadata.client_id) || null
            }
          });
          try { localStorage.setItem('neo_auth', payload); } catch (_) {}
          window.location.href = 'dashboard.html';
        })
        .catch(function (ex) {
          setLoading(false);
          showError('Something went wrong. Please try again.');
          console.error('[Neo] login error', ex);
        });
    });
  });
})();