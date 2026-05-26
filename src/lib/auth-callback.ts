type CallbackValidationInput = {
  code: string | null;
  state: string | null;
  expectedState: string | null;
  cookieCreatedAt: number | null;
  maxAgeMs: number;
  nowMs: number;
};

export type CallbackValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export const validateKickCallbackInput = (
  input: CallbackValidationInput,
): CallbackValidationResult => {
  if (!input.code) {
    return { ok: false, message: "Missing authorization code" };
  }
  if (!input.state) {
    return { ok: false, message: "Missing callback state" };
  }
  if (!input.expectedState) {
    return { ok: false, message: "Missing OAuth state cookie" };
  }
  if (input.state !== input.expectedState) {
    return { ok: false, message: "OAuth state mismatch" };
  }
  if (input.cookieCreatedAt === null) {
    return { ok: false, message: "Missing OAuth cookie timestamp" };
  }
  if (input.nowMs - input.cookieCreatedAt > input.maxAgeMs) {
    return { ok: false, message: "OAuth cookie expired" };
  }
  return { ok: true };
};
