const login = document.getElementById("login");
const register = document.getElementById("register");
const chat = document.getElementById("chat");

document.getElementById("showRegister").onclick = (e) => {
  e.preventDefault();
  login.classList.add("hidden");
  register.classList.remove("hidden");
};

document.getElementById("showLogin").onclick = (e) => {
  e.preventDefault();
  register.classList.add("hidden");
  login.classList.remove("hidden");
};

document.getElementById("loginForm").onsubmit = (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  document.getElementById("notice").textContent =
    "دا یوازې د ډیزاین ازموینه ده؛ حقیقي Login لا Backend ته اړتیا لري.";
};

document.getElementById("registerForm").onsubmit = (e) => {
  e.preventDefault();
  document.getElementById("regNotice").textContent =
    "د Register بڼه کار کوي؛ د حساب خوندي جوړول به وروسته له Backend سره ونښلوو.";
};

document.getElementById("messageForm").onsubmit = (e) => {
  e.preventDefault();
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  const bubble = document.createElement("p");
  bubble.className = "bubble";
  bubble.textContent = text;
  document.getElementById("messages").appendChild(bubble);
  input.value = "";
};

document.getElementById("logout").onclick = () => {
  chat.classList.add("hidden");
  login.classList.remove("hidden");
};
