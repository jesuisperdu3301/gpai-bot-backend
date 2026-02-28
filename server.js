import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/*
==================================================
SECURITY & BASIC HARDENING
==================================================
*/

app.use(cors());
app.use(express.json({ limit: "50kb" }));

/*
==================================================
HEALTH CHECK
==================================================
*/

app.get("/", (req, res) => {
  res.status(200).send("GPAI backend running");
});

/*
==================================================
CHAT ENDPOINT
==================================================
*/

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Invalid request format. 'messages' must be a non-empty array."
      });
    }

    /*
    --------------------------------------------------
    HISTORY CONTROL (Token discipline)
    --------------------------------------------------
    */

    const maxHistory = parseInt(process.env.MAX_HISTORY || "15");
    const trimmedMessages = messages.slice(-maxHistory);

    /*
    --------------------------------------------------
    MODEL CONFIGURATION
    --------------------------------------------------
    */

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const maxTokens = parseInt(process.env.MAX_TOKENS || "600");

    /*
    --------------------------------------------------
    OPENAI API CALL
    --------------------------------------------------
    */

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: trimmedMessages,
          temperature: 0.2,
          top_p: 1,
          max_tokens: maxTokens
        })
      }
    );

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI API Error:", data);
      return res.status(500).json({
        error: "AI service error",
        details: data?.error?.message || "Unknown error"
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content || "No response";

    /*
    --------------------------------------------------
    STANDARDIZED RESPONSE FORMAT
    --------------------------------------------------
    */

    return res.status(200).json({
      reply,
      model,
      disclaimer:
        "This output is generated for academic demonstrative purposes and does not constitute legal advice."
    });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

/*
==================================================
SERVER START (Render-safe binding)
==================================================
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GPAI backend running on port ${PORT}`);
});