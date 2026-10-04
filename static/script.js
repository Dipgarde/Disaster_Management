console.log("Disaster Management frontend loaded");

function togglePassword(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        iconEl.textContent = "🙈";
    } else {
        input.type = "password";
        iconEl.textContent = "👁️";
    }
}

// ---------- Save login info feature ----------
// NOTE: storing a password in a cookie is a simplification for this
// student project's demo. A real production system never stores a
// usable password client-side like this.

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");

    // Email stays blank for the user to type. Only once the typed
    // email matches a previously saved one does the password autofill.
    emailInput.addEventListener("input", function () {
        const savedEmail = getCookie("saved_email");
        const savedPassword = getCookie("saved_password");

        if (savedEmail && savedPassword && emailInput.value.trim().toLowerCase() === savedEmail.toLowerCase()) {
            passwordInput.value = savedPassword;
        } else {
            passwordInput.value = "";
        }
    });

    loginForm.addEventListener("submit", function () {
        const email = emailInput.value;
        const password = passwordInput.value;
        sessionStorage.setItem("pending_login_email", email);
        sessionStorage.setItem("pending_login_password", password);
    });
}

function showSaveLoginToast() {
    const pendingEmail = sessionStorage.getItem("pending_login_email");
    const pendingPassword = sessionStorage.getItem("pending_login_password");
    if (!pendingEmail) return;

    const toast = document.createElement("div");
    toast.className = "save-login-toast";
    toast.innerHTML = `
        <div class="save-login-text">💾 Save login info for next time?</div>
        <div class="save-login-actions">
            <button class="save-login-btn save-login-yes">Save</button>
            <button class="save-login-btn save-login-no">Not now</button>
        </div>
    `;
    document.body.appendChild(toast);

    toast.querySelector(".save-login-yes").onclick = function () {
        setCookie("saved_email", pendingEmail, 30);
        setCookie("saved_password", pendingPassword, 30);
        sessionStorage.removeItem("pending_login_email");
        sessionStorage.removeItem("pending_login_password");
        toast.remove();
    };

    toast.querySelector(".save-login-no").onclick = function () {
        sessionStorage.removeItem("pending_login_email");
        sessionStorage.removeItem("pending_login_password");
        toast.remove();
    };
}

document.addEventListener("DOMContentLoaded", showSaveLoginToast);