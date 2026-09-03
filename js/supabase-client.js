/**
 * js/supabase-client.js
 * Shared Supabase client for login and dashboard.
 * Drop into the /js/ folder. Include BEFORE login.js and dashboard-live.js.
 */
(function (global) {
  var SUPABASE_URL  = 'https://grhsehzqiabfpidofiur.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyaHNlaHpxaWFiZnBpZG9maXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTgwNjQsImV4cCI6MjEwMzU5NDA2NH0.1A5amVx7obSfrzrE2Wh8fHskGUtSBp7eV2km_HQdBL0'; // Settings > API > anon public

  // Load the Supabase CDN client if not already loaded, then expose window.sb
  function init(cb) {
    if (global.supabase && global.supabase.createClient) {
      global.sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      if (cb) cb(global.sb);
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = function () {
      global.sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      if (cb) cb(global.sb);
    };
    script.onerror = function () {
      console.error('[Neo] Failed to load Supabase SDK');
    };
    document.head.appendChild(script);
  }

  global.NeoSupabase = { init: init };
})(window);