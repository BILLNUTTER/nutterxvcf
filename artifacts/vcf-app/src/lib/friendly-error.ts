const CODE_MESSAGES: Record<string, string> = {
  already_registered: "This number is already registered. Please use a different phone number.",
  suspended: "This number has been suspended. Contact support on +254758891491.",
  validation_error: "Please check your details and try again.",
  server_error: "Something went wrong on our end. Please try again in a moment.",
  paylor_disabled: "Automated payment is not enabled yet. Contact +254758891491.",
  paylor_unconfigured: "Payment gateway is not set up. Contact +254758891491.",
  paylor_error: "Payment gateway returned an error. Please try again.",
  paylor_unreachable: "Could not reach the payment gateway. Check your connection and try again.",
  already_paid: "Payment already confirmed for this registration.",
  not_found: "Registration not found. Please start over.",
  no_transaction_id: "No payment transaction found. Please try paying again.",
  not_verified: "This number is not verified yet. Please complete the WhatsApp bot verification first.",
  invalid_credentials: "Incorrect username or password.",
  bad_request: "Invalid request. Please try again.",
};

/** Duck-type check for an ApiError shape (has status + data fields). */
function isApiError(err: unknown): err is { status: number; data: Record<string, unknown> | null; message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "data" in err &&
    typeof (err as { status: unknown }).status === "number"
  );
}

/**
 * Converts any thrown error into a plain, user-friendly string.
 * Strips raw HTTP status prefixes ("HTTP 409 Conflict: ...") that the API client adds.
 */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(err)) {
    const data = err.data;

    // 1. Try the error_code → friendly message map
    const code = typeof data?.error === "string" ? data.error : null;
    if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

    // 2. Use the message from the JSON body directly (no HTTP prefix)
    const msg = typeof data?.message === "string" ? data.message.trim() : null;
    if (msg) return msg;

    // 3. Last resort: strip the "HTTP XXX StatusText: " prefix from err.message
    const raw = err.message ?? "";
    const colonIdx = raw.indexOf(": ");
    if (colonIdx !== -1 && raw.startsWith("HTTP ")) {
      const stripped = raw.slice(colonIdx + 2).trim();
      if (stripped) return stripped;
    }

    return fallback;
  }

  if (err instanceof Error) {
    const msg = err.message.trim();
    // Don't expose raw fetch/network/URL messages
    if (
      msg.startsWith("HTTP ") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("https://") ||
      msg.includes("http://")
    ) {
      return "Network error. Please check your connection and try again.";
    }
    if (msg) return msg;
  }

  return fallback;
}
