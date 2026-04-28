import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRouter from "./routes/chat.js";
import ordersRouter from "./routes/orders.js";
import adminRouter from "./routes/admin.js";
import recommendationsRouter from "./routes/recommendations.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      try {
        const url = new URL(origin);
        const host = url.hostname;
        const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
        return callback(null, isLocalhost);
      } catch {
        return callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "Q-Commerce chatbot backend is running.",
  });
});

app.use("/api/chat", chatRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/recommendations", recommendationsRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: err?.message || "Internal server error.",
  });
});

app.listen(PORT, () => {
  console.log(`Q-Commerce chatbot backend running at http://localhost:${PORT}`);
});
