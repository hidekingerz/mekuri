export function errorToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
