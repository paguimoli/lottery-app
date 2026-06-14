import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import type { ControllerResult } from "@/src/lib/controller/controller.types";
import { loginWithPassword, logoutSession } from "./auth.service";
import type {
  AuthRequestMetadata,
  LoginSuccessResponse,
  LogoutResponse,
} from "./auth.types";
import {
  normalizeLoginInput,
  normalizeLogoutInput,
  validateSessionMetadata,
} from "./auth.validation";

const INVALID_CREDENTIALS_ERROR = "Invalid credentials.";

export async function loginController({
  body,
  metadata,
}: {
  body: unknown;
  metadata?: AuthRequestMetadata;
}): Promise<ControllerResult<LoginSuccessResponse>> {
  const input = normalizeLoginInput(body);

  if (!input) {
    return controllerFailure(INVALID_CREDENTIALS_ERROR);
  }

  const metadataValidation = validateSessionMetadata(metadata);

  if (!metadataValidation.valid) {
    return controllerFailure(INVALID_CREDENTIALS_ERROR);
  }

  try {
    const result = await loginWithPassword({
      input,
      metadata,
    });

    if (!result.success) {
      return controllerFailure(INVALID_CREDENTIALS_ERROR);
    }

    return controllerSuccess(result);
  } catch {
    return controllerFailure(INVALID_CREDENTIALS_ERROR);
  }
}

export async function logoutController({
  body,
}: {
  body: unknown;
}): Promise<ControllerResult<LogoutResponse>> {
  const input = normalizeLogoutInput(body);

  if (!input) {
    return controllerSuccess({ success: true });
  }

  try {
    return controllerSuccess(await logoutSession({ input }));
  } catch {
    return controllerSuccess({ success: true });
  }
}
