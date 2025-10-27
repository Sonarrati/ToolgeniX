// index.js
// Simple Express proxy to call OpenAI securely (store API key in .env)
//
// Usage:
// 1) npm init -y
// 2) npm install express cors dotenv
// 3) node index.js
//
// NOTE: Make sure to put your OpenAI API key in .env (OPENAI_API_KEY=sk-...)

import express from "express";
import fetch from "node-fetch"; // If using Node 18+ you can use global fetch; for older node, install node-fetch
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors()); // adjust origin in production
app.use(express.json({ limit: "5mb" })); // accept JSON bodies up to 5MB

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.warn("WARNING: OPENAI_API_KEY not set in environment. Set OPENAI_API_KEY in .env");
}

// Basic rate limiting (very small) — optional minimal protection
let lastCall = 0;
const MIN_MS_BETWEEN_CALLS = 200; // tiny throttle to avoid accidental bursts

app.post("/api/summarize", async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastCall < MIN_MS_BETWEEN_CALLS) {
      // tiny throttle
      await new Promise(r => setTimeout(r, MIN_MS_BETWEEN_CALLS));
    }
    lastCall = Date.now();

    const { text, length = "medium", style = "paragraph", mode = "openai" } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "Missing text to summarize" });
    }

    // If mode === "local", you could optionally perform extractive summarization here on server.
    // For now we call OpenAI (abstractive) when mode === "openai".
    if (!OPENAI_KEY) return res.status(500).json({ error: "Server not configured with OpenAI key" });

    // Build the prompt
    const promptParts = [];
    promptParts.push(`Summarize the following article into a ${length} summary.`);
    if (style === "bullets") promptParts.push("Format the summary as concise bullet points.");
    if (style === "headline") promptParts.push("Give a short punchy headline (one line).");
    if (style === "paragraph") promptParts.push("Write a short paragraph.");
    promptParts.push("");
    promptParts.push("Article:");
    promptParts.push(text);

    const prompt = promptParts.join("\n");

    // Use Chat Completions endpoint
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // change if you prefer a different model available to your account
        messages: [
          { role: "system", content: "You are a helpful assistant that summarizes content concisely and accurately." },
          { role: "user", content: prompt }
        ],
        max_tokens: 600,
        temperature: 0.2,
        n: 1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      return res.status(500).json({ error: "OpenAI API error", detail: errText });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
    return res.json({ summary: summary.trim() });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message || err.toString() });
  }
});

// Optional health
app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => {
  console.log(`Summarizer proxy listening on http://localhost:${PORT}`);
});
