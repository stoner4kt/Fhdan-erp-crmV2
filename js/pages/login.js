import { login } from '../auth.js';
import { navigate, homeForRole } from '../router.js';
import { showToast } from '../utils.js';
import { renderSidebar } from '../sidebar.js';

const DEMO_ACCOUNTS = [
  { role: 'System Admin', email: 'admin@fhdan.co.za', password: 'Admin2026!', icon: 'SA' },
  { role: 'Manager', email: 'manager@fhdan.co.za', password: 'Manager2026!', icon: 'MG' },
  { role: 'Finance Officer', email: 'finance@fhdan.co.za', password: 'Finance2026!', icon: 'FO' },
  { role: 'Sales Agent', email: 'sales@fhdan.co.za', password: 'Sales2026!', icon: 'SA' },
  { role: 'Fleet Coordinator', email: 'fleet@fhdan.co.za', password: 'Fleet2026!', icon: 'FC' },
  { role: 'Driver', email: 'driver@fhdan.co.za', password: 'Driver2026!', icon: 'DR' },
];

export default async function render() {
  const loginContainer = document.getElementById('login-container');
  loginContainer.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">FH</div>
          <h1>Fhdan Fleet Hub</h1>
          <p>Sign in to your account</p>
        </div>
        <form id="login-form" class="login-form">
          <div class="form-group">
            <label for="email">Email address</label>
            <input type="email" id="login-email" name="email" placeholder="name@fhdan.co.za" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="login-password" name="password" autocomplete="current-password" required>
          </div>
          <div id="login-error" class="form-error" style="display:none"></div>
          <button type="submit" id="login-btn" class="btn btn-primary btn-full">Sign in</button>
        </form>
        <div class="demo-section">
          <p class="demo-label">Quick Login (Demo Accounts):</p>
          <div class="demo-grid">
            ${DEMO_ACCOUNTS.map((acc, i) => `
              <button class="demo-card" data-idx="${i}">
                <div class="demo-icon">${acc.icon}</div>
                <span>${acc.role}</span>
              </button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.querySelectorAll('.demo-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const acc = DEMO_ACCOUNTS[+btn.dataset.idx];
      document.getElementById('login-email').value = acc.email;
      document.getElementById('login-password').value = acc.password;
    });
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.style.display = 'none';

  try {
    const { profile } = await login(email, password);
    if (profile && profile.is_active === false) throw new Error('This account is inactive. Contact a system administrator.');
    document.getElementById('shell').style.display = 'flex';
    document.getElementById('login-container').style.display = 'none';
    renderSidebar();
    navigate(homeForRole(profile?.role));
  } catch (err) {
    errEl.textContent = err.message || 'Invalid credentials. Please try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}
