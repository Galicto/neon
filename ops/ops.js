const ROLE = document.documentElement.dataset.role || "";

const els = {
  email: document.getElementById("ops-email"),
  role: document.getElementById("ops-role"),
  error: document.getElementById("ops-error"),
  kpis: document.getElementById("ops-kpis"),
  leads: document.getElementById("ops-leads"),
  users: document.getElementById("ops-users"),
  audit: document.getElementById("ops-audit"),
};

function showError(msg) {
  if (!els.error) return;
  els.error.textContent = msg;
  els.error.classList.add("show");
}

async function api(url, opts) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (!window.location.pathname.startsWith("/staff/login")) {
      window.location.replace("/staff/login");
    }
    throw new Error(data.error || "Sign in required.");
  }
  if (res.status === 403) {
    throw new Error(data.error || "Not allowed for this role.");
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function switchPanel(id) {
  document.querySelectorAll(".ops-panel").forEach((p) => p.classList.toggle("is-on", p.id === id));
  document.querySelectorAll(".ops-nav button[data-panel]").forEach((b) => {
    b.classList.toggle("is-on", b.dataset.panel === id);
  });
}

async function loadOverview() {
  const data = await api("/api/stats");
  const s = data.stats;
  els.kpis.innerHTML = `
    <div class="ops-kpi"><b>${s.submissions}</b><span>Audit requests</span></div>
    <div class="ops-kpi"><b>${s.new}</b><span>New / unread</span></div>
    <div class="ops-kpi"><b>${s.last7d}</b><span>Last 7 days</span></div>
    <div class="ops-kpi"><b>${ROLE === "admin" ? s.staff : "—"}</b><span>Active staff</span></div>
  `;
  const ph = document.getElementById("ops-placeholders");
  if (ph) {
    ph.textContent =
      "Placeholders: " + data.placeholders.siteVisits + ". " + data.placeholders.liveConversations + ".";
  }
}

async function loadLeads() {
  const data = await api("/api/submissions");
  if (!data.submissions.length) {
    els.leads.innerHTML = '<div class="ops-empty">No audit requests yet.</div>';
    return;
  }
  els.leads.innerHTML = `
    <table class="ops-table">
      <thead><tr><th>When</th><th>Person</th><th>Bottleneck</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${data.submissions
          .map((row) => {
            const when = new Date(row.created_at).toLocaleString("en-IN", { hour12: true });
            return `<tr>
              <td>${esc(when)}</td>
              <td><strong>${esc(row.name)}</strong><br><span class="ops-muted">${esc(row.email)}${row.company ? " · " + esc(row.company) : ""}</span></td>
              <td>${esc(row.bottleneck)}</td>
              <td><span class="ops-pill ${esc(row.status)}">${esc(row.status.replace("_", " "))}</span></td>
              <td>
                <select data-status="${row.id}">
                  <option value="new" ${row.status === "new" ? "selected" : ""}>new</option>
                  <option value="in_review" ${row.status === "in_review" ? "selected" : ""}>in review</option>
                  <option value="replied" ${row.status === "replied" ? "selected" : ""}>replied</option>
                  <option value="closed" ${row.status === "closed" ? "selected" : ""}>closed</option>
                </select>
                <textarea class="ops-note" data-notes="${row.id}" placeholder="Internal notes">${esc(row.notes)}</textarea>
                <button class="ops-btn ghost" data-save="${row.id}" type="button">Save</button>
              </td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
  els.leads.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.save;
      const status = els.leads.querySelector(`[data-status="${id}"]`).value;
      const notes = els.leads.querySelector(`[data-notes="${id}"]`).value;
      try {
        await api("/api/submissions/" + id, { method: "PATCH", body: JSON.stringify({ status, notes }) });
        btn.textContent = "Saved";
        setTimeout(() => (btn.textContent = "Save"), 1200);
      } catch (err) {
        showError(err.message);
      }
    });
  });
}

async function loadUsers() {
  if (ROLE !== "admin" || !els.users) return;
  const data = await api("/api/users");
  els.users.querySelector("tbody").innerHTML = data.users
    .map(
      (u) => `<tr>
        <td>${esc(u.email)}</td>
        <td>${esc(u.role)}</td>
        <td>${u.active ? "active" : "disabled"}</td>
        <td>${
          u.role === "admin"
            ? "—"
            : `<button class="ops-btn ghost" data-toggle="${u.id}" data-active="${u.active}" type="button">${u.active ? "Disable" : "Enable"}</button>`
        }</td>
      </tr>`
    )
    .join("");
  els.users.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api("/api/users/" + btn.dataset.toggle, {
          method: "PATCH",
          body: JSON.stringify({ active: btn.dataset.active === "1" ? false : true }),
        });
        await loadUsers();
      } catch (err) {
        showError(err.message);
      }
    });
  });
}

async function loadAudit() {
  if (ROLE !== "admin" || !els.audit) return;
  const data = await api("/api/audit-log");
  els.audit.innerHTML = data.log.length
    ? `<table class="ops-table"><thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead><tbody>${data.log
        .map(
          (row) =>
            `<tr><td>${esc(new Date(row.created_at).toLocaleString("en-IN"))}</td><td>${esc(row.action)}</td><td>${esc(row.detail || "")}</td></tr>`
        )
        .join("")}</tbody></table>`
    : '<div class="ops-empty">No audit events yet.</div>';
}

document.querySelectorAll(".ops-nav button[data-panel]").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
});

const logout = document.getElementById("ops-logout");
if (logout) {
  logout.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    window.location.replace("/staff/login");
  });
}

const createForm = document.getElementById("ops-create-user");
if (createForm) {
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(createForm);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
          role: "manager",
        }),
      });
      createForm.reset();
      await loadUsers();
    } catch (err) {
      showError(err.message);
    }
  });
}

const loginForm = document.getElementById("ops-login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
        }),
      });
      window.location.replace(data.user.role === "admin" ? "/admin" : "/manager");
    } catch (err) {
      showError(err.message === "auth" ? "Invalid email or password." : err.message);
      btn.disabled = false;
    }
  });
}

(async function boot() {
  if (!document.body.classList.contains("ops-app")) return;
  try {
    const me = await api("/api/me");
    if (ROLE === "admin" && me.user.role !== "admin") {
      window.location.replace("/manager");
      return;
    }
    if (els.email) els.email.textContent = me.user.email;
    if (els.role) els.role.textContent = me.user.role;
    await loadOverview();
    await loadLeads();
    await loadUsers();
    await loadAudit();
  } catch (err) {
    if (err.message !== "auth") showError(err.message);
  }
})();
