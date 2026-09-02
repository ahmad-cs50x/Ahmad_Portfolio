const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const contactRoutes = require("./routes/contact.routes");
const rateLimiter = require("./middleware/rateLimiter");

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = (process.env.CLIENT_URL || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());

// Dynamic CORS configuration for local mobile-to-PC cross-debugging
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server requests)
      if (!origin) return callback(null, true);

      // In development, automatically allow any request coming from local network IPs (192.168.x.x, 10.x.x.x, localhost)
      const isLocalNetwork =
        process.env.NODE_ENV !== "production" &&
        (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/).test(origin);

      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || isLocalNetwork) {
        return callback(null, true);
      }

      return callback(new Error("CORS policy violation: Access denied for this origin."));
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/api/health", (_req, res) => {
  res.json({ success: true, service: "ahmad-portfolio-api", uptime: process.uptime() });
});

app.use("/api", rateLimiter);
app.use("/api/contact", contactRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use((err, _req, res, _next) => {
  console.error("[error]", err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? "Something went wrong on our end. Please try again later." : err.message,
  });
});

module.exports = app;