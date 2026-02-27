import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/*
==================================================
 SECURITY MIDDLEWARE
==================================================
*/

app.use(cors());
app.use(express.json({ limit: "50kb" }));

/*
==================================================
 RATE LIMITING
==================================================
*/

app.use(
  "/api/chat",
  rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT || "20"),
    message: { error: "Too many requests" }
  })
);

/*
==================================================
 CHAT ENDPOINT
==================================================
*/

app.post("/api/chat", async (req, res) => {
  try {
    let { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid request format" });
    }

    const maxHistory = parseInt(process.env.MAX_HISTORY || "25");

    messages = messages.slice(-maxHistory);

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const maxTokens = parseInt(process.env.MAX_TOKENS || "1200");

    const cacheKey = `${model}|${JSON.stringify(messages)}`;

    /*
    ==========================================
    OPENAI CALL
    ==========================================
    */

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
          top_p: 1
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI Error:", data);
      return res.status(500).json({ error: "AI service error" });
    }

    res.json({
      text: data.choices?.[0]?.message?.content || "No response",
      model
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/*
==================================================
 SERVER START
==================================================
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GPAI backend running on port ${PORT}`);
});