const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
};

const errorHandler = (err, req, res, next) => {
  if (err?.code === 11000) {
    const duplicateField = Object.keys(err?.keyPattern || {})[0];
    if (duplicateField === "rollNumber") {
      return res.status(400).json({
        success: false,
        message: "Roll number already exists"
      });
    }
  }

  const statusCode =
    err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
};

module.exports = {
  notFound,
  errorHandler
};
