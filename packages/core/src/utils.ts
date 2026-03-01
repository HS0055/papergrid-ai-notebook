import { AILayoutResponseSchema } from './schemas';

export const generateId = (): string => crypto.randomUUID();

export function validateAIOutput(data: unknown) {
  const result = AILayoutResponseSchema.safeParse(data);
  if (result.success) return { success: true as const, data: result.data };
  return { success: false as const, errors: result.error.issues };
}
