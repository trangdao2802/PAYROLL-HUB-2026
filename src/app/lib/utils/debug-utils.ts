/**
 * Simple debug utility to trace data operations.
 */
export const debugLog = (
  context: string,
  message: string,
  data?: unknown,
  level: "info" | "warn" | "error" = "info"
) => {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${context.toUpperCase()}] ${message}`;

  if (level === "error") {
    console.error(formattedMessage, data ?? "");
  } else if (level === "warn") {
    console.warn(formattedMessage, data ?? "");
  } else {
    console.log(formattedMessage, data ?? "");
  }
};
