export type ControllerResult<T> = {
  success: boolean;
  data?: T;
  errors?: string[];
};

export function controllerSuccess<T>(data: T): ControllerResult<T> {
  return { success: true, data };
}

export function controllerFailure(errors: string | string[]): ControllerResult<never> {
  return {
    success: false,
    errors: Array.isArray(errors) ? errors : [errors],
  };
}
