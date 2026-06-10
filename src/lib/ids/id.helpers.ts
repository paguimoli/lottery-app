export function timestampId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}
