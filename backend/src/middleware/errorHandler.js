// 404 handler (route not found)
export function notFound(req, res, next) {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

// Global error handler (500 + others)
export function errorHandler(err, req, res, next) {
  console.error("ERROR:", err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let details = err.details || null;

  if (statusCode === 500 && err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation error";
    details = err.errors || null;
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? "ServerError" : "BadRequest",
    message,
    details,
  });
}
