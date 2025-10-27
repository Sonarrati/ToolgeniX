// server.js (ES module)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch"; // node-fetch v3 (ESM)

dotenv.config();

const app = express();
app.use(cors()); // in production restrict origin
app.use(express.json({ limit: "8mb" })); // accept larger text

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("ERROR: OPENAI_API_KEY not set. Create .env from .env.example and put your key there.");
  process.exit(1);
}

const PORT = process.env.PORT || 5173;

/**
 * POST /api/summarize
 * body: { text: string, length: "short"|"medium"|"long", style: "paragraph"|"bullets"|"headline" }
 */
app.post("/api/summarize", async (req, res) => {
  try {
    const { text = "", length = "medium", style = "paragraph" } = req.body || {};
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return res.status(400).json({ error: "Provide article text (min ~20 chars) in request body." });
    }

    // Build a concise prompt for ChatCompletion
    let instruction = `Summarize the following article in a ${length} summary.`;
    if (style === "bullets") instruction += " Format the summary as concise bullet points.";
    else if (style === "headline") instruction += " Provide a one-line headline.";
    else instruction += " Provide a concise paragraph summary.";

    const prompt = `${instruction}\n\nArticle:\n\n${text}`;

    // Call OpenAI Chat Completions
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // change to a model you have access to
        messages: [
          { role: "system", content: "You are a helpful summarization assistant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 700,
        temperature: 0.2,
        n: 1
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("OpenAI error:", response.status, txt);
      return res.status(500).json({ error: "OpenAI API error", detail: txt });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
    return res.json({ summary: String(summary).trim() });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message || err.toString() });
  }
});

// Simple health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
