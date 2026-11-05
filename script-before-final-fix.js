import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "./firebase.js";

const $ = (id) => document.getElementById(id);

const pages = {
  auth: $("authPage"),
  home: $("homePage"),
  conversation: $("conversationPage"),
  profile: $("profilePage"),
  settings: $("settingsPage")
};

let currentPage = "auth";
let currentUser = null;
let currentChatId = null;
let currentFilter = "all";
let chats = [];
let users = [];
let darkMode = localStorage.getItem("mychat_dark") === "true";

try {
  users = JSON.parse(localStorage.getItem("mychat_users") || "[]");
  chats = JSON.parse(localStorage.getItem("mychat_chats") || "[]");
} catch (error) {
  users = [];
  chats = [];
}

function saveData() {
  localStorage.setItem("mychat_users", JSON.stringify(users));
  localStorage.setItem("mychat_chats", JSON.stringify(chats));
}

function showPage(name) {
  currentPage = name;
  Object.entries(pages).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== name);
  });

  $("bottomNav").classList.toggle("hidden", name === "auth" || name === "conversation");

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("selected", item.dataset.page === name);
  });
}

function setAuthMode(mode) {
  const registering = mode === "register";
  $("loginForm").classList.toggle("hidden", registering);
  $("registerForm").classList.toggle("hidden", !registering);
  $("authTitle").textContent = registering ? "Create Account" : "Welcome Back!";
  $("authSubtitle").textContent = registering ? "Join your friends on MyChat" : "Login to continue to MyChat";
  $("authSwitch").innerHTML = registering
    ? 'Already have an account? <button id="showLogin" class="text-btn" type="button">Login</button>'
    : 'New to MyChat? <button id="showRegister" class="text-btn" type="button">Create account</button>';

  $("showLogin")?.addEventListener("click", () => setAuthMode("login"));
  $("showRegister")?.addEventListener("click", () => setAuthMode("register"));
  $("authNotice").textContent = "";
}

function applyDarkMode() {
  document.body.classList.toggle("dark", darkMode);
  $("darkModeToggle").checked = darkMode;
  localStorage.setItem("mychat_dark", String(darkMode));
}

function seedChats() {
  if (chats.length) return;

  chats = [
    { id: "demo-ahmad", name: "Ahmad", unread: 2, messages: [{ text: "Assalamu alaikum!", sent: false, time: "10:35 AM" }] },
    { id: "demo-bilal", name: "Bilal", unread: 0, messages: [{ text: "How are you, friend?", sent: false, time: "Yesterday" }] },
    { id: "demo-khalid", name: "Khalid", unread: 1, messages: [{ text: "See you tomorrow 👋", sent: false, time: "Yesterday" }] },
    { id: "demo-group", name: "MyChat Group", unread: 0, messages: [{ text: "Welcome to the group!", sent: false, time: "Monday" }] }
  ];
  saveData();
}

function renderChats() {
  const list = $("chatList");
  list.replaceChildren();
  const query = $("searchInput").value.trim().toLowerCase();

  const filtered = chats.filter((chat) => {
    const searchMatch = chat.name.toLowerCase().includes(query);
    const filterMatch = currentFilter === "all" || chat.unread > 0;
    return searchMatch && filterMatch;
  });

  filtered.forEach((chat) => {
    const item = document.createElement("button");
    item.className = "chat-item";

    const avatar = document.createElement("div");
    avatar.className = "avatar " + avatarColor(chat.name);
    avatar.textContent = chat.name.charAt(0).toUpperCase();

    const info = document.createElement("div");
    info.className = "chat-info";

    const title = document.createElement("div");
    title.className = "chat-title";

    const name = document.createElement("strong");
    name.textContent = chat.name;

    const time = document.createElement("span");
    const lastMessage = chat.messages[chat.messages.length - 1];
    time.textContent = lastMessage?.time || "";

    title.append(name, time);

    const preview = document.createElement("div");
    preview.className = "chat-preview";

    const previewText = document.createElement("span");
    previewText.className = "preview-text";
    previewText.textContent = lastMessage?.text || "Start a conversation";

    preview.appendChild(previewText);

    if (chat.unread > 0) {
      const badge = document.createElement("b");
      badge.className = "unread-count";
      badge.textContent = String(chat.unread);
      preview.appendChild(badge);
    }

    info.append(title, preview);
    item.append(avatar, info);
    item.addEventListener("click", () => openChat(chat.id));
    list.appendChild(item);
  });

  $("emptyChats").classList.toggle("hidden", filtered.length !== 0);
}

function avatarColor(name) {
  const colors = ["green", "blue", "orange", "purple"];
  const score = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return colors[score % colors.length];
}

function openChat(id) {
  const chat = chats.find((item) => item.id === id);
  if (!chat) return;

  currentChatId = id;
  chat.unread = 0;
  $("conversationName").textContent = chat.name;
  $("conversationAvatar").textContent = chat.name.charAt(0).toUpperCase();
  $("conversationAvatar").className = "avatar " + avatarColor(chat.name);

  renderMessages();
  saveData();
  renderChats();
  showPage("conversation");
}

function renderMessages() {
  const chat = chats.find((item) => item.id === currentChatId);
  if (!chat) return;

  const box = $("messages");
  box.replaceChildren();

  const date = document.createElement("div");
  date.className = "date-label";
  date.textContent = "Conversation";
  box.appendChild(date);

  chat.messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = "message " + (message.sent ? "sent" : "");
    bubble.textContent = message.text;
    box.appendChild(bubble);
  });

  box.scrollTop = box.scrollHeight;
}

function updateProfile() {
  $("profileName").textContent = currentUser.name;
  $("profileEmail").textContent = currentUser.email;
  $("profileAvatar").textContent = currentUser.name.charAt(0).toUpperCase();
}

function loginUser(user) {
  currentUser = user;
  seedChats();
  updateProfile();
  renderChats();
  showPage("home");
}

$("showRegister").addEventListener("click", () => setAuthMode("register"));

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  const button = $("loginForm").querySelector('button[type="submit"]');

  try {
    if (button) button.disabled = true;
    $("authNotice").textContent = "Logging in...";

    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    $("authNotice").textContent = "";
    loginUser({
      uid: user.uid,
      name: user.displayName || user.email.split("@")[0],
      email: user.email
    });
  } catch (error) {
    $("authNotice").textContent =
      error.code === "auth/invalid-credential"
        ? "Incorrect email or password."
        : error.code === "auth/invalid-email"
        ? "Please enter a valid email address."
        : error.message || "Login failed. Please try again.";
  } finally {
    if (button) button.disabled = false;
  }
});

$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim().toLowerCase();
  const password = $("registerPassword").value;
  const button = $("registerForm").querySelector('button[type="submit"]');

  if (!name) {
    $("authNotice").textContent = "Please enter your name.";
    return;
  }

  try {
    if (button) button.disabled = true;
    $("authNotice").textContent = "Creating your account...";

    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateFirebaseProfile(result.user, { displayName: name });

    $("authNotice").textContent = "";
    loginUser({
      uid: result.user.uid,
      name,
      email: result.user.email
    });
  } catch (error) {
    $("authNotice").textContent =
      error.code === "auth/email-already-in-use"
        ? "This email is already registered. Please log in."
        : error.code === "auth/weak-password"
        ? "Your password must be at least 6 characters."
        : error.code === "auth/invalid-email"
        ? "Please enter a valid email address."
        : error.message || "Account creation failed. Please try again.";
  } finally {
    if (button) button.disabled = false;
  }
});

$("messageForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const text = $("messageInput").value.trim();
  const chat = chats.find((item) => item.id === currentChatId);
  if (!text || !chat) return;

  chat.messages.push({
    text,
    sent: true,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });

  $("messageInput").value = "";
  saveData();
  renderMessages();
  renderChats();
});

$("searchInput").addEventListener("input", renderChats);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    renderChats();
  });
});

$("newChatBtn").addEventListener("click", () => {
  $("modalTitle").textContent = "New chat";
  $("modalText").textContent = "Enter a contact name to create a local demo conversation.";
  $("modalInput").value = "";
  $("modal").classList.remove("hidden");
  $("modalInput").focus();
});

$("modalCancel").addEventListener("click", () => $("modal").classList.add("hidden"));

$("modalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("modalInput").value.trim();
  if (!name) return;

  let chat = chats.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!chat) {
    chat = {
      id: "local-" + Date.now(),
      name,
      unread: 0,
      messages: []
    };
    chats.unshift(chat);
    saveData();
  }

  $("modal").classList.add("hidden");
  $("searchInput").value = "";
  currentFilter = "all";
  document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
  renderChats();
  openChat(chat.id);
});

$("backBtn").addEventListener("click", () => {
  renderChats();
  showPage("home");
});

$("headerProfile").addEventListener("click", () => {
  if (currentUser) {
    updateProfile();
    showPage("profile");
  } else {
    showPage("auth");
  }
});

$("editProfileBtn").addEventListener("click", editName);
$("editNameSetting").addEventListener("click", editName);

function editName() {
  const name = prompt("Enter your display name:", currentUser.name);
  if (!name || !name.trim()) return;

  currentUser.name = name.trim();
  const index = users.findIndex((item) => item.email === currentUser.email);
  if (index >= 0) users[index].name = currentUser.name;
  saveData();
  updateProfile();
}

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    currentUser = null;
    currentChatId = null;
    $("loginForm").reset();
    $("registerForm").reset();
    setAuthMode("login");
    showPage("auth");
  } catch (error) {
    alert("Could not log out. Please try again.");
  }
});

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    if (page === "profile") updateProfile();
    if (page === "home") renderChats();
    showPage(page);
  });
});

$("darkModeToggle").addEventListener("change", (event) => {
  darkMode = event.target.checked;
  applyDarkMode();
});

$("chatMenuBtn").addEventListener("click", () => {
  alert("More chat options will be added when the backend is connected.");
});

applyDarkMode();
setAuthMode("login");
showPage("auth");

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginUser({
      uid: user.uid,
      name: user.displayName || user.email.split("@")[0],
      email: user.email
    });
  } else {
    currentUser = null;
    currentChatId = null;
    showPage("auth");
  }
});
