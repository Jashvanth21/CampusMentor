const express = require("express");
const cors = require("cors");

const apiRouter = require("./api");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const requestLogger = require("./middleware/loggerMiddleware");

const app = express();
app.disable("etag");

const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(requestLogger);

app.get("/", (req, res) => {
  res.status(200).json({
    service: "CampusMentor API",
    status: "ok"
  });
});

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
