import { AILayoutResponseSchema, parseAIResponse } from './schemas';
import type { AIPageZ } from './schemas';

export const generateId = (): string => crypto.randomUUID();

export function validateAIOutput(data: unknown) {
  const result = AILayoutResponseSchema.safeParse(data);
  if (result.success) return { success: true as const, data: result.data };
  return { success: false as const, errors: result.error.issues };
}

export function validateAIMultiPageOutput(data: unknown): { success: true; pages: AIPageZ[] } | { success: false; errors: unknown[] } {
  try {
    const result = parseAIResponse(data);
    return { success: true, pages: result.pages };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return { success: false, errors: (error as { issues: unknown[] }).issues };
    }
    return { success: false, errors: [error] };
  }
}
