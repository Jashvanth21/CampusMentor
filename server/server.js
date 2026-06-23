const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, ".env");
dotenv.config({ path: envPath });

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log("Starting CampusMentor backend...");
  console.log(`Using port: ${PORT}`);
  console.log(`[ENV] Loaded from: ${envPath}`);
  console.log("Groq:", process.env.GROQ_API_KEY ? "Configured" : "Missing API key");
  console.log(`[ENV] MONGO_URI loaded: ${Boolean(process.env.MONGO_URI)}`);
  console.log(`[ENV] JWT_SECRET loaded: ${Boolean(process.env.JWT_SECRET)}`);
  console.log(`[ENV] JUDGE0_API_URL loaded: ${Boolean(process.env.JUDGE0_API_URL)}`);

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI missing. Set MONGO_URI in .env before starting database features.");
  }

  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the existing process on ${PORT} and restart the backend.`
      );
      process.exit(1);
    }
    console.error("Server startup error:", error);
    process.exit(1);
  });
};

startServer();
