import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// simple in-memory cache to avoid repeated identical requests
const responseCache = new Map();
const CACHE_LIMIT = parseInt(process.env.CACHE_LIMIT || "100", 10);
function cacheResponse(key, value) {
  if (responseCache.size >= CACHE_LIMIT) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(key, value);
}

// ------------------------
// Middleware
// ------------------------
app.use(cors());
app.use(express.json());

// ------------------------
// Health check
// ------------------------
app.get("/", (req, res) => {
  res.send("GPAI backend running");
});

// ------------------------
// API endpoint
// ------------------------
app.post("/api/chat", async (req, res) => {
  try {
    let { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request format" });
    }

    // cap history length to avoid excessive token usage
    const maxHistory = parseInt(process.env.MAX_HISTORY || "25", 10);
    if (messages.length > maxHistory) {
      messages = messages.slice(-maxHistory);
    }

    // allow selecting a model via env var; default to a smaller, cheaper variant for efficiency
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const maxTokens = parseInt(process.env.MAX_TOKENS || "1500", 10);

    // check cache first
    const cacheKey = `${model}|${maxTokens}|${JSON.stringify(messages)}`;
    if (responseCache.has(cacheKey)) {
      return res.json(responseCache.get(cacheKey));
    }

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          max_tokens: maxTokens
        })
      }
    );

    const data = await openaiRes.json();

    // ⚖️ Academic abstraction layer
    const payload = {
      reply: data.choices?.[0]?.message?.content ?? "No response",
      model,
      disclaimer:
        "This output is generated for academic demonstrative purposes and does not constitute legal advice."
    };
    cacheResponse(cacheKey, payload);
    res.json(payload);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------
app.listen(PORT, () => {
  console.log(`GPAI backend running on port ${PORT}`);
});
