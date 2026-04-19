/**
 * NeuralChat — script.js
 * Handles chat UI interactions and backend API communication.
 * Designed and Developed by Er. Sundram Tiwari
 */

// ─────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────
const chatFeed      = document.getElementById("chatFeed");
const userInput     = document.getElementById("userInput");
const sendBtn       = document.getElementById("sendBtn");
const welcomeSplash = document.getElementById("welcomeSplash");

// HTML <template> elements for message rendering
const tplUser   = document.getElementById("tplUser");
const tplAI     = document.getElementById("tplAI");
const tplTyping = document.getElementById("tplTyping");

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

/** Full conversation history sent to the backend on every request */
const conversationHistory = [];

/** Whether a response is currently being awaited */
let isBusy = false;

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

/** Scroll the chat feed to the very bottom smoothly */
function scrollToBottom() {
  chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior: "smooth" });
}

/** Escape HTML special chars to prevent XSS */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Auto-grow the textarea height as the user types.
 * Resets to 1 row when text is cleared.
 */
function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

/** Shorten a long model identifier to a readable label, e.g. "Claude 3 Sonnet" */
function formatModelName(modelId) {
  const map = {
    "anthropic/claude-3-sonnet": "Claude 3 Sonnet",
    "qwen/qwen-2-72b-instruct":  "Qwen 2 72B",
    "mistralai/mistral-7b-instruct": "Mistral 7B",
  };
  // Return mapped name, or prettify the raw ID as fallback
  return map[modelId] || modelId.split("/").pop().replace(/-/g, " ");
}

// ─────────────────────────────────────────────
// Message rendering
// ─────────────────────────────────────────────

/**
 * Append a user bubble to the chat feed.
 * @param {string} text — raw user text
 */
function appendUserMessage(text) {
  const clone = tplUser.content.cloneNode(true);
  clone.querySelector(".bubble").textContent = text;
  chatFeed.appendChild(clone);
  scrollToBottom();
}

/**
 * Append an AI response bubble to the chat feed.
 * @param {string} text   — assistant reply text
 * @param {string} model  — model identifier string
 * @param {boolean} isError — render as error style
 */
function appendAIMessage(text, model, isError = false) {
  const clone = tplAI.content.cloneNode(true);

  const bubble = clone.querySelector(".bubble");
  bubble.textContent = text;
  if (isError) bubble.classList.add("bubble-error");

  const meta = clone.querySelector(".msg-meta");
  if (!isError && model) {
    const tag = document.createElement("span");
    tag.className = "model-tag";
    tag.textContent = "✦ " + formatModelName(model);
    meta.appendChild(tag);
  }

  chatFeed.appendChild(clone);
  scrollToBottom();
}

/**
 * Show the animated typing indicator.
 * Returns the inserted element so it can be removed later.
 */
function showTyping() {
  const clone = tplTyping.content.cloneNode(true);
  // The template has id="typingIndicator" on the root — grab after appending
  chatFeed.appendChild(clone);
  const indicator = document.getElementById("typingIndicator");
  scrollToBottom();
  return indicator;
}

/** Remove the typing indicator element from the DOM */
function hideTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ─────────────────────────────────────────────
// Core: Send message
// ─────────────────────────────────────────────

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isBusy) return;

  // Hide the welcome splash on first message
  if (welcomeSplash) welcomeSplash.style.display = "none";

  // Lock the UI
  isBusy = true;
  sendBtn.disabled = true;

  // Clear & reset textarea
  userInput.value = "";
  autoGrow(userInput);

  // Show user bubble
  appendUserMessage(text);

  // Track in conversation history
  conversationHistory.push({ role: "user", content: text });

  // Show typing dots
  const typingEl = showTyping();

  try {
    // POST to Flask backend
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    const data = await res.json();

    // Remove typing indicator
    hideTyping(typingEl);

    if (!res.ok || data.error) {
      // Server returned an error
      const errorMsg = data.error || "Something went wrong. Please try again.";
      appendAIMessage(errorMsg, null, true);
    } else {
      // Success — show AI reply and track it in history
      appendAIMessage(data.response, data.model);
      conversationHistory.push({ role: "assistant", content: data.response });
    }

  } catch (networkErr) {
    // Network / fetch-level error
    hideTyping(typingEl);
    appendAIMessage(
      "Unable to reach the server. Please check your connection and try again.",
      null,
      true
    );
    console.error("[NeuralChat] Fetch error:", networkErr);
  } finally {
    // Always unlock the UI
    isBusy = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// ─────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────

/** Send on button click */
sendBtn.addEventListener("click", sendMessage);

/** Auto-grow textarea as user types */
userInput.addEventListener("input", () => autoGrow(userInput));

/**
 * Send on Enter (without Shift).
 * Shift+Enter inserts a newline (default textarea behaviour).
 */
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // prevent newline
    sendMessage();
  }
});

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
userInput.focus();
