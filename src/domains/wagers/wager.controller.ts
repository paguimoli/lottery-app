import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import {
  buildDefaultKenoWagers,
  buildWagerOptionPayload,
  buildWagerTypePayload,
} from "./wager.service";
import type { PayTable, WagerOption, WagerType } from "./wager.types";
import {
  validateWagerOptionForm,
  validateWagerTypeForm,
} from "./wager.validation";

export function saveWagerTypeController({
  form,
  wagerTypes,
  editingWagerTypeId,
}: {
  form: Parameters<typeof buildWagerTypePayload>[0]["form"];
  wagerTypes: WagerType[];
  editingWagerTypeId?: string | null;
}) {
  const validation = validateWagerTypeForm({
    form,
    wagerTypes,
    editingWagerTypeId,
  });

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const existingWagerType = wagerTypes.find(
    (wagerType) => wagerType.id === editingWagerTypeId
  );
  const result = buildWagerTypePayload({ form, existingWagerType });

  if (!result.ok || !result.payload) {
    return controllerFailure(result.message);
  }

  return controllerSuccess({
    wagerType: result.payload,
    wagerTypes: editingWagerTypeId
      ? wagerTypes.map((wagerType) =>
          wagerType.id === editingWagerTypeId ? result.payload! : wagerType
        )
      : [...wagerTypes, result.payload],
  });
}

export function deleteWagerTypeController({
  wagerTypeId,
  wagerTypes,
  wagerOptions,
}: {
  wagerTypeId: string;
  wagerTypes: WagerType[];
  wagerOptions: WagerOption[];
}) {
  return controllerSuccess({
    wagerTypes: wagerTypes.filter((wagerType) => wagerType.id !== wagerTypeId),
    wagerOptions: wagerOptions.filter(
      (option) => option.wagerTypeId !== wagerTypeId
    ),
  });
}

export function saveWagerOptionController({
  form,
  wagerOptions,
  editingWagerOptionId,
}: {
  form: Parameters<typeof buildWagerOptionPayload>[0]["form"];
  wagerOptions: WagerOption[];
  editingWagerOptionId?: string | null;
}) {
  const validation = validateWagerOptionForm({
    form,
    wagerOptions,
    editingWagerOptionId,
  });

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const existingOption = wagerOptions.find(
    (option) => option.id === editingWagerOptionId
  );
  const result = buildWagerOptionPayload({ form, existingOption });

  if (!result.ok || !result.payload) {
    return controllerFailure(result.message);
  }

  return controllerSuccess({
    wagerOption: result.payload,
    wagerOptions: editingWagerOptionId
      ? wagerOptions.map((option) =>
          option.id === editingWagerOptionId ? result.payload! : option
        )
      : [...wagerOptions, result.payload],
  });
}

export function deleteWagerOptionController({
  optionId,
  wagerOptions,
}: {
  optionId: string;
  wagerOptions: WagerOption[];
}) {
  return controllerSuccess({
    wagerOptions: wagerOptions.filter((option) => option.id !== optionId),
  });
}

export function addDefaultKenoWagersController({
  gameId,
  wagerTypes,
  wagerOptions,
  payTables,
}: {
  gameId: string;
  wagerTypes: WagerType[];
  wagerOptions: WagerOption[];
  payTables: PayTable[];
}) {
  const { nextWagerTypes, newDefaults, newOptions } = buildDefaultKenoWagers({
    gameId,
    wagerTypes,
    wagerOptions,
    payTables,
  });

  if (newDefaults.length === 0 && newOptions.length === 0) {
    return controllerFailure("Default wager types already exist for this game.");
  }

  return controllerSuccess({
    newDefaults,
    newOptions,
    wagerTypes: nextWagerTypes,
    wagerOptions: [...wagerOptions, ...newOptions],
  });
}

export const createWagerTypeController = saveWagerTypeController;
export const updateWagerTypeController = saveWagerTypeController;
export const createWagerOptionController = saveWagerOptionController;
export const updateWagerOptionController = saveWagerOptionController;
