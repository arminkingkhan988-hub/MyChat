import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateFirebaseProfile,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  serverTimestamp
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
let chatUnsubscribe = null;
const messageUnsubscribers = {};
let darkMode = localStorage.getItem("mychat_dark") === "true";

function showPage(name) {
  currentPage = name;

  Object.entries(pages).forEach(([key, element]) => {
    if (element) element.classList.toggle("hidden", key !== name);
  });

  $("bottomNav").classList.toggle(
    "hidden",
    name === "auth" || name === "conversation"
  );

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("selected", item.dataset.page === name);
  });
}

function setAuthMode(mode) {
  const registering = mode === "register";

  $("loginForm").classList.toggle("hidden", registering);
  $("registerForm").classList.toggle("hidden", !registering);
  $("authTitle").textContent = registering ? "Create Account" : "Welcome Back!";
  $("authSubtitle").textContent = registering
    ? "Join your friends on MyChat"
    : "Login to continue to MyChat";

  $("authSwitch").innerHTML = registering
    ? 'Already have an account? <button id="showLogin" class="text-btn" type="button">Login</button>'
    : 'New to MyChat? <button id="showRegister" class="text-btn" type="button">Create account</button>';

  $("authNotice").textContent = "";
}

$("authSwitch").addEventListener("click", (event) => {
  if (event.target.id === "showLogin") setAuthMode("login");
  if (event.target.id === "showRegister") setAuthMode("register");
});

function applyDarkMode() {
  document.body.classList.toggle("dark", darkMode);
  $("darkModeToggle").checked = darkMode;
  localStorage.setItem("mychat_dark", String(darkMode));
}

function avatarColor(name) {
  const colors = ["green", "blue", "orange", "purple"];
  const score = [...(name || "M")].reduce(
    (total, char) => total + char.charCodeAt(0),
    0
  );
  return colors[score % colors.length];
}

function formatTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "";
  return timestamp.toDate().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function lastMessageText(chat) {
  const last = chat.messages?.[chat.messages.length - 1];
  return last?.text || "Start a conversation";
}

function renderChats() {
  const list = $("chatList");
  list.replaceChildren();

  const queryText = $("searchInput").value.trim().toLowerCase();

  const filtered = [...chats]
    .sort((a, b) => {
      const at = a.updatedAt?.toMillis?.() || 0;
      const bt = b.updatedAt?.toMillis?.() || 0;
      return bt - at;
    })
    .filter((chat) => {
      const matchesName = (chat.name || "").toLowerCase().includes(queryText);
      const matchesFilter = currentFilter === "all" || chat.unread > 0;
      return matchesName && matchesFilter;
    });

  filtered.forEach((chat) => {
    const item = document.createElement("button");
    item.className = "chat-item";

    const avatar = document.createElement("div");
    avatar.className = "avatar " + avatarColor(chat.name);
    avatar.textContent = (chat.name || "M").charAt(0).toUpperCase();

    const info = document.createElement("div");
    info.className = "chat-info";

    const title = document.createElement("div");
    title.className = "chat-title";

    const name = document.createElement("strong");
    name.textContent = chat.name || "MyChat User";

    const time = document.createElement("span");
    const last = chat.messages?.[chat.messages.length - 1];
    time.textContent = last ? (last.time || "") : "";

    title.append(name, time);

    const preview = document.createElement("div");
    preview.className = "chat-preview";

    const previewText = document.createElement("span");
    previewText.className = "preview-text";
    previewText.textContent = lastMessageText(chat);
    preview.appendChild(previewText);

    info.append(title, preview);
    item.append(avatar, info);
    item.addEventListener("click", () => openChat(chat.id));
    list.appendChild(item);
  });

  $("emptyChats").classList.toggle("hidden", filtered.length !== 0);
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

  (chat.messages || []).forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = "message " + (message.senderId === currentUser?.uid ? "sent" : "");
    bubble.textContent = message.text;
    box.appendChild(bubble);
  });

  box.scrollTop = box.scrollHeight;
}

function openChat(id) {
  const chat = chats.find((item) => item.id === id);
  if (!chat) return;

  currentChatId = id;
  $("conversationName").textContent = chat.name || "MyChat User";
  $("conversationAvatar").textContent =
    (chat.name || "M").charAt(0).toUpperCase();
  $("conversationAvatar").className =
    "avatar " + avatarColor(chat.name);

  renderMessages();
  showPage("conversation");
}

function updateProfile() {
  if (!currentUser) return;

  $("profileName").textContent = currentUser.name;
  $("profileEmail").textContent = currentUser.email;
  $("profileAvatar").textContent =
    (currentUser.name || "M").charAt(0).toUpperCase();
}

async function ensureUserProfile(user) {
  const name = user.displayName || user.email.split("@")[0];

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      name,
      email: user.email.toLowerCase(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return { uid: user.uid, name, email: user.email };
}

function stopChatListeners() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

  Object.values(messageUnsubscribers).forEach((unsubscribe) => unsubscribe());
  Object.keys(messageUnsubscribers).forEach((id) => {
    delete messageUnsubscribers[id];
  });
}

function subscribeToMessages(chat) {
  if (messageUnsubscribers[chat.id]) return;

  const messagesQuery = query(
    collection(db, "chats", chat.id, "messages"),
    orderBy("createdAt", "asc")
  );

  messageUnsubscribers[chat.id] = onSnapshot(
    messagesQuery,
    (snapshot) => {
      const currentChat = chats.find((item) => item.id === chat.id);
      if (!currentChat) return;

      currentChat.messages = snapshot.docs.map((messageDoc) => {
        const data = messageDoc.data();
        return {
          id: messageDoc.id,
          text: data.text || "",
          senderId: data.senderId,
          senderName: data.senderName || "",
          time: formatTime(data.createdAt)
        };
      });

      renderChats();
      if (currentChatId === chat.id) renderMessages();
    },
    (error) => {
      console.error("Message listener error:", error);
      alert("Could not load messages. Please check your Firestore rules and internet connection.");
    }
  );
}

function subscribeToChats() {
  if (!currentUser) return;

  stopChatListeners();

  const chatsQuery = query(
    collection(db, "chats"),
    where("participants", "array-contains", currentUser.uid)
  );

  chatUnsubscribe = onSnapshot(
    chatsQuery,
    (snapshot) => {
      const oldChats = chats;

      const nextChats = snapshot.docs.map((chatDoc) => {
        const data = chatDoc.data();
        const otherUid = (data.participants || []).find(
          (uid) => uid !== currentUser.uid
        );
        const participantNames = data.participantNames || {};

        return {
          id: chatDoc.id,
          participants: data.participants || [],
          participantNames,
          name: participantNames[otherUid] || "MyChat User",
          updatedAt: data.updatedAt || data.createdAt || null,
          unread: 0,
          messages: oldChats.find((chat) => chat.id === chatDoc.id)?.messages || []
        };
      });

      const nextIds = new Set(nextChats.map((chat) => chat.id));

      Object.keys(messageUnsubscribers).forEach((id) => {
        if (!nextIds.has(id)) {
          messageUnsubscribers[id]();
          delete messageUnsubscribers[id];
        }
      });

      chats = nextChats;
      chats.forEach(subscribeToMessages);

      renderChats();

      if (currentChatId && !chats.some((chat) => chat.id === currentChatId)) {
        currentChatId = null;
        showPage("home");
      }
    },
    (error) => {
      console.error("Chat listener error:", error);
      alert("Could not load chats. Check your Firestore security rules.");
    }
  );
}

async function loginUser(user) {
  currentUser = user;
  updateProfile();
  showPage("home");

  try {
    currentUser = await ensureUserProfile(auth.currentUser);
    updateProfile();
    subscribeToChats();
  } catch (error) {
    console.error("Profile setup error:", error);
    alert("Could not load your profile: " + error.message);
  }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  const button = $("loginForm").querySelector('button[type="submit"]');

  try {
    if (button) button.disabled = true;
    $("authNotice").textContent = "Logging in...";
    await signInWithEmailAndPassword(auth, email, password);
    $("authNotice").textContent = "";
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

$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = $("messageInput").value.trim();
  const chat = chats.find((item) => item.id === currentChatId);

  if (!text || !chat || !currentUser) return;

  try {
    const sendButton = $("messageForm").querySelector('button[type="submit"]');
    if (sendButton) sendButton.disabled = true;

    await addDoc(collection(db, "chats", chat.id, "messages"), {
      text,
      senderId: currentUser.uid,
      senderName: currentUser.name,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "chats", chat.id), {
      updatedAt: serverTimestamp()
    });

    $("messageInput").value = "";
  } catch (error) {
    console.error("Send message error:", error);
    alert("Message could not be sent: " + error.message);
  } finally {
    const sendButton = $("messageForm").querySelector('button[type="submit"]');
    if (sendButton) sendButton.disabled = false;
  }
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
  $("modalText").textContent = "Enter your friend's registered email address.";
  $("modalInput").type = "email";
  $("modalInput").placeholder = "friend@example.com";
  $("modalInput").value = "";
  $("modal").classList.remove("hidden");
  $("modalInput").focus();
});

$("modalCancel").addEventListener("click", () => {
  $("modal").classList.add("hidden");
});

$("modalForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const email = $("modalInput").value.trim().toLowerCase();
  if (!email) return;

  try {
    const submitButton = $("modalForm").querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    const userQuery = query(
      collection(db, "users"),
      where("email", "==", email)
    );
    const result = await getDocs(userQuery);

    if (result.empty) {
      alert("No MyChat account was found for this email. Ask your friend to create an account and log in first.");
      return;
    }

    const friendDoc = result.docs[0];
    const friend = friendDoc.data();
    const friendUid = friend.uid || friendDoc.id;

    if (friendUid === currentUser.uid) {
      alert("You cannot start a chat with yourself.");
      return;
    }

    const existingChat = chats.find(
      (chat) =>
        chat.participants.includes(friendUid) &&
        chat.participants.includes(currentUser.uid)
    );

    if (existingChat) {
      $("modal").classList.add("hidden");
      openChat(existingChat.id);
      return;
    }

    const chatRef = doc(collection(db, "chats"));
    const participantNames = {};
    participantNames[currentUser.uid] = currentUser.name;
    participantNames[friendUid] = friend.name || friend.email.split("@")[0];

    await setDoc(chatRef, {
      participants: [currentUser.uid, friendUid],
      participantNames,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    $("modal").classList.add("hidden");
    $("searchInput").value = "";
    currentFilter = "all";
    document.querySelectorAll(".tab").forEach((item) => {
      item.classList.toggle("active", item.dataset.filter === "all");
    });

    setTimeout(() => openChat(chatRef.id), 700);
  } catch (error) {
    console.error("Create chat error:", error);
    alert("Could not create chat: " + error.message);
  } finally {
    const submitButton = $("modalForm").querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = false;
  }
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

async function editName() {
  if (!currentUser) return;

  const name = prompt("Enter your display name:", currentUser.name);
  if (!name || !name.trim()) return;

  const cleanName = name.trim();

  try {
    await updateFirebaseProfile(auth.currentUser, { displayName: cleanName });
    await setDoc(
      doc(db, "users", currentUser.uid),
      { name: cleanName, updatedAt: serverTimestamp() },
      { merge: true }
    );

    currentUser.name = cleanName;
    updateProfile();
    alert("Profile updated.");
  } catch (error) {
    alert("Could not update profile: " + error.message);
  }
}

$("logoutBtn").addEventListener("click", async () => {
  try {
    stopChatListeners();
    chats = [];
    currentChatId = null;
    currentUser = null;
    await signOut(auth);
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
  alert("More chat options will be added in a future update.");
});

applyDarkMode();
setAuthMode("login");
showPage("auth");

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginUser(user);
  } else {
    stopChatListeners();
    currentUser = null;
    currentChatId = null;
    chats = [];
    showPage("auth");
  }
});
