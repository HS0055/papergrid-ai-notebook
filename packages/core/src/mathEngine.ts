// ============================================================================
// Global Math Engine for Papera
// Works on ALL paper types. NEVER throws — returns null on failure.
// Zero external dependencies.
// ============================================================================

import type { Block } from './types';

// ── Types ──────────────────────────────────────────────────────────────────

export type ExpressionType =
  | 'plain'
  | 'numeric'
  | 'expression'
  | 'assignment'
  | 'reference';

export interface MathResult {
  expression: string;
  result: number;
  variables: Map<string, number>;
  assignment?: string;
  displayResult: string;
}

// ── Token types for the tokenizer ──────────────────────────────────────────

type TokenKind = 'number' | 'op' | 'paren' | 'func' | 'var';

interface Token {
  kind: TokenKind;
  value: string;
  num?: number;
}

// ── 1. detectExpression ────────────────────────────────────────────────────

const ASSIGNMENT_RE = /^[a-zA-Z][a-zA-Z0-9 ]*?\s*[=:]\s*.+/;
const EXPRESSION_RE = /[+\-*/^()%]|sqrt|abs|sin|cos|tan|log|ln/;
const REFERENCE_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;
const NUMERIC_RE = /^\s*-?\s*[$€£]?\s*[\d,]+\.?\d*\s*%?\s*$/;
const HAS_DIGIT_RE = /\d/;

export function detectExpression(text: string): ExpressionType {
  try {
    const trimmed = text.trim();
    if (trimmed.length === 0) return 'plain';

    // Assignment: "varName = ..." or "varName: ..."
    if (ASSIGNMENT_RE.test(trimmed)) return 'assignment';

    // Must contain at least one digit to be considered math
    if (!HAS_DIGIT_RE.test(trimmed)) {
      // Could be a pure variable reference
      if (REFERENCE_RE.test(trimmed)) return 'reference';
      return 'plain';
    }

    // Pure numeric literal (possibly with currency/percent)
    if (NUMERIC_RE.test(trimmed)) return 'numeric';

    // Contains math operators or functions
    if (EXPRESSION_RE.test(trimmed)) return 'expression';

    // Contains natural language math keywords
    if (/\b(plus|minus|times|divided\s+by|over|of|squared|cubed)\b/i.test(trimmed)) {
      return 'expression';
    }

    // Number with k/m/b suffix near operators
    if (/\d+[kmb]\b/i.test(trimmed) && /[+\-*/]/.test(trimmed)) {
      return 'expression';
    }

    return 'plain';
  } catch {
    return 'plain';
  }
}

// ── 2. tokenize ────────────────────────────────────────────────────────────

const FUNC_NAMES = new Set(['sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'ln']);

function preprocess(input: string): string {
  let s = input;

  // Strip currency symbols
  s = s.replace(/[$€£]/g, '');

  // Strip trailing = (user typed "5 + 3 =")
  s = s.replace(/=\s*$/, '');

  // Natural language -> operators
  s = s.replace(/\bplus\b/gi, '+');
  s = s.replace(/\bminus\b/gi, '-');
  s = s.replace(/\btimes\b/gi, '*');
  s = s.replace(/\bdivided\s+by\b/gi, '/');
  s = s.replace(/\bover\b/gi, '/');

  // "squared" -> ^2, "cubed" -> ^3
  s = s.replace(/\bsquared\b/gi, '^2');
  s = s.replace(/\bcubed\b/gi, '^3');

  // "X% of Y" -> (X/100)*Y — do this BEFORE stripping %
  s = s.replace(/([\d.]+)\s*%\s*of\b/gi, '($1/100)*');

  // Standalone trailing % -> /100
  s = s.replace(/([\d.]+)\s*%/g, '($1/100)');

  // "10k" -> 10000, "2.5m" -> 2500000, "1b" -> 1000000000
  s = s.replace(/([\d.]+)\s*k\b/gi, (_m, n) => String(parseFloat(n) * 1_000));
  s = s.replace(/([\d.]+)\s*m\b/gi, (_m, n) => String(parseFloat(n) * 1_000_000));
  s = s.replace(/([\d.]+)\s*b\b/gi, (_m, n) => String(parseFloat(n) * 1_000_000_000));

  // Strip commas within numbers ("1,000" -> "1000")
  s = s.replace(/(\d),(\d)/g, '$1$2');

  // "X of Y" (remaining, not percent) — treat as multiplication
  s = s.replace(/\bof\b/gi, '*');

  return s;
}

export function tokenize(input: string): Token[] | null {
  try {
    const s = preprocess(input).trim();
    if (s.length === 0) return null;

    const tokens: Token[] = [];
    let i = 0;

    while (i < s.length) {
      const ch = s[i];

      // Whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Parentheses
      if (ch === '(' || ch === ')') {
        tokens.push({ kind: 'paren', value: ch });
        i++;
        continue;
      }

      // Operators
      if (ch === '+' || ch === '*' || ch === '/' || ch === '^') {
        tokens.push({ kind: 'op', value: ch });
        i++;
        continue;
      }

      // Minus: could be unary or binary
      if (ch === '-') {
        const prev = tokens[tokens.length - 1];
        const isUnary = !prev || prev.kind === 'op' || (prev.kind === 'paren' && prev.value === '(');
        if (isUnary) {
          // Read number after minus
          let j = i + 1;
          while (j < s.length && /\s/.test(s[j])) j++;
          if (j < s.length && (/\d/.test(s[j]) || s[j] === '.')) {
            // Parse negative number
            let numStr = '-';
            while (j < s.length && (/\d/.test(s[j]) || s[j] === '.')) {
              numStr += s[j];
              j++;
            }
            const num = parseFloat(numStr);
            if (isNaN(num)) return null;
            tokens.push({ kind: 'number', value: numStr, num });
            i = j;
            continue;
          } else {
            // Unary minus before variable/paren: push -1 *
            tokens.push({ kind: 'number', value: '-1', num: -1 });
            tokens.push({ kind: 'op', value: '*' });
            i++;
            continue;
          }
        } else {
          tokens.push({ kind: 'op', value: '-' });
          i++;
          continue;
        }
      }

      // Numbers
      if (/\d/.test(ch) || (ch === '.' && i + 1 < s.length && /\d/.test(s[i + 1]))) {
        let numStr = '';
        let j = i;
        while (j < s.length && (/\d/.test(s[j]) || s[j] === '.')) {
          numStr += s[j];
          j++;
        }
        const num = parseFloat(numStr);
        if (isNaN(num)) return null;
        tokens.push({ kind: 'number', value: numStr, num });
        i = j;
        continue;
      }

      // Identifiers: functions or variables
      if (/[a-zA-Z_]/.test(ch)) {
        let ident = '';
        let j = i;
        while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) {
          ident += s[j];
          j++;
        }
        const lower = ident.toLowerCase();
        if (FUNC_NAMES.has(lower)) {
          tokens.push({ kind: 'func', value: lower });
        } else if (lower === 'pi') {
          tokens.push({ kind: 'number', value: 'pi', num: Math.PI });
        } else if (lower === 'e' && (j >= s.length || !/[a-zA-Z]/.test(s[j]))) {
          // Standalone 'e' is Euler's number, but not if part of a longer word
          tokens.push({ kind: 'number', value: 'e', num: Math.E });
        } else {
          // Implicit multiplication: "2x" -> 2 * x
          const prev = tokens[tokens.length - 1];
          if (prev && (prev.kind === 'number' || (prev.kind === 'paren' && prev.value === ')'))) {
            tokens.push({ kind: 'op', value: '*' });
          }
          tokens.push({ kind: 'var', value: lower });
        }
        i = j;
        continue;
      }

      // Unknown character — skip it
      i++;
    }

    return tokens.length > 0 ? tokens : null;
  } catch {
    return null;
  }
}

// ── 3. evalTokens — recursive descent parser ──────────────────────────────

interface ParseState {
  tokens: Token[];
  pos: number;
  context: Map<string, number>;
}

function peek(state: ParseState): Token | null {
  return state.pos < state.tokens.length ? state.tokens[state.pos] : null;
}

function consume(state: ParseState): Token | null {
  if (state.pos >= state.tokens.length) return null;
  return state.tokens[state.pos++];
}

function expectOp(state: ParseState, op: string): boolean {
  const t = peek(state);
  if (t && t.kind === 'op' && t.value === op) {
    state.pos++;
    return true;
  }
  return false;
}

// Grammar:
//   expr       = term (('+' | '-') term)*
//   term       = power (('*' | '/') power)*
//   power      = unary ('^' unary)*
//   unary      = '-' unary | atom
//   atom       = number | variable | func '(' expr ')' | '(' expr ')'

function parseExpr(state: ParseState): number | null {
  let left = parseTerm(state);
  if (left === null) return null;

  while (true) {
    const t = peek(state);
    if (!t || t.kind !== 'op') break;
    if (t.value === '+') {
      state.pos++;
      const right = parseTerm(state);
      if (right === null) return null;
      left = left + right;
    } else if (t.value === '-') {
      state.pos++;
      const right = parseTerm(state);
      if (right === null) return null;
      left = left - right;
    } else {
      break;
    }
  }
  return left;
}

function parseTerm(state: ParseState): number | null {
  let left = parsePower(state);
  if (left === null) return null;

  while (true) {
    const t = peek(state);
    if (!t || t.kind !== 'op') break;
    if (t.value === '*') {
      state.pos++;
      const right = parsePower(state);
      if (right === null) return null;
      left = left * right;
    } else if (t.value === '/') {
      state.pos++;
      const right = parsePower(state);
      if (right === null) return null;
      if (right === 0) return null; // Division by zero
      left = left / right;
    } else {
      break;
    }
  }
  return left;
}

function parsePower(state: ParseState): number | null {
  const base = parseUnary(state);
  if (base === null) return null;

  if (expectOp(state, '^')) {
    const exp = parseUnary(state);
    if (exp === null) return null;
    return Math.pow(base, exp);
  }
  return base;
}

function parseUnary(state: ParseState): number | null {
  const t = peek(state);
  if (t && t.kind === 'op' && t.value === '-') {
    state.pos++;
    const val = parseUnary(state);
    if (val === null) return null;
    return -val;
  }
  return parseAtom(state);
}

function parseAtom(state: ParseState): number | null {
  const t = peek(state);
  if (!t) return null;

  // Number
  if (t.kind === 'number') {
    state.pos++;
    return t.num ?? null;
  }

  // Variable
  if (t.kind === 'var') {
    state.pos++;
    const val = state.context.get(t.value);
    if (val === undefined) return null; // Unknown variable
    return val;
  }

  // Function call: func ( expr )
  if (t.kind === 'func') {
    state.pos++;
    const fname = t.value;
    const paren = peek(state);
    if (!paren || paren.kind !== 'paren' || paren.value !== '(') {
      // Function without parens — try to parse the next atom as argument
      const arg = parseAtom(state);
      if (arg === null) return null;
      return applyFunc(fname, arg);
    }
    state.pos++; // consume '('
    const arg = parseExpr(state);
    if (arg === null) return null;
    const closeParen = peek(state);
    if (!closeParen || closeParen.kind !== 'paren' || closeParen.value !== ')') return null;
    state.pos++; // consume ')'
    return applyFunc(fname, arg);
  }

  // Parenthesized expression
  if (t.kind === 'paren' && t.value === '(') {
    state.pos++;
    const val = parseExpr(state);
    if (val === null) return null;
    const closeParen = peek(state);
    if (!closeParen || closeParen.kind !== 'paren' || closeParen.value !== ')') return null;
    state.pos++; // consume ')'
    return val;
  }

  return null;
}

function applyFunc(name: string, arg: number): number | null {
  switch (name) {
    case 'sqrt': return arg < 0 ? null : Math.sqrt(arg);
    case 'abs': return Math.abs(arg);
    case 'sin': return Math.sin(arg);
    case 'cos': return Math.cos(arg);
    case 'tan': return Math.tan(arg);
    case 'log': return arg <= 0 ? null : Math.log10(arg);
    case 'ln': return arg <= 0 ? null : Math.log(arg);
    default: return null;
  }
}

export function evalTokens(tokens: Token[], context: Map<string, number>): number | null {
  try {
    if (!tokens || tokens.length === 0) return null;

    const state: ParseState = {
      tokens,
      pos: 0,
      context,
    };

    const result = parseExpr(state);
    if (result === null) return null;

    // All tokens must be consumed
    if (state.pos < state.tokens.length) return null;

    // Guard against non-finite results
    if (!isFinite(result)) return null;

    return result;
  } catch {
    return null;
  }
}

// ── 4. evaluate — public API ───────────────────────────────────────────────

const ASSIGNMENT_PATTERN = /^([a-zA-Z][a-zA-Z0-9 ]*?)\s*[=:]\s*(.+)/;

export function evaluate(
  text: string,
  context?: Map<string, number>,
): MathResult | null {
  try {
    const trimmed = text.trim();
    if (trimmed.length === 0) return null;

    const type = detectExpression(trimmed);

    // Plain text or pure numeric literal — skip
    if (type === 'plain' || type === 'numeric') return null;

    const ctx = context ?? new Map<string, number>();

    // Handle assignment
    if (type === 'assignment') {
      const match = trimmed.match(ASSIGNMENT_PATTERN);
      if (!match) return null;

      const varName = match[1].trim().toLowerCase();
      const exprText = match[2].trim();
      const tokens = tokenize(exprText);
      if (!tokens) return null;

      const result = evalTokens(tokens, ctx);
      if (result === null) return null;

      return {
        expression: exprText,
        result,
        variables: new Map(ctx),
        assignment: varName,
        displayResult: formatNumber(result),
      };
    }

    // Handle reference (lone variable name)
    if (type === 'reference') {
      const varName = trimmed.toLowerCase();
      const val = ctx.get(varName);
      if (val === undefined) return null;
      return {
        expression: trimmed,
        result: val,
        variables: new Map(ctx),
        displayResult: formatNumber(val),
      };
    }

    // Expression
    const tokens = tokenize(trimmed);
    if (!tokens) return null;

    const result = evalTokens(tokens, ctx);
    if (result === null) return null;

    return {
      expression: trimmed,
      result,
      variables: new Map(ctx),
      displayResult: formatNumber(result),
    };
  } catch {
    return null;
  }
}

// ── 5. buildPageContext ────────────────────────────────────────────────────

export function buildPageContext(blocks: Block[]): Map<string, number> {
  const context = new Map<string, number>();

  try {
    for (const block of blocks) {
      // Scan text content line by line
      if (block.content) {
        const lines = block.content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length === 0) continue;

          const type = detectExpression(trimmed);
          if (type === 'assignment') {
            const match = trimmed.match(ASSIGNMENT_PATTERN);
            if (match) {
              const varName = match[1].trim().toLowerCase();
              const exprText = match[2].trim();
              const tokens = tokenize(exprText);
              if (tokens) {
                const result = evalTokens(tokens, context);
                if (result !== null) {
                  context.set(varName, result);
                }
              }
            }
          }
        }
      }

      // Scan gridData cells
      if (block.gridData) {
        for (const row of block.gridData.rows) {
          for (const cell of row) {
            if (!cell.content) continue;
            const trimmed = cell.content.trim();
            const type = detectExpression(trimmed);
            if (type === 'assignment') {
              const match = trimmed.match(ASSIGNMENT_PATTERN);
              if (match) {
                const varName = match[1].trim().toLowerCase();
                const exprText = match[2].trim();
                const tokens = tokenize(exprText);
                if (tokens) {
                  const result = evalTokens(tokens, context);
                  if (result !== null) {
                    context.set(varName, result);
                  }
                }
              }
            }
          }
        }
      }

      // Scan mathBlockData rows — each row of cells joined as a string is a line
      if (block.mathBlockData) {
        const { rows, cols, cells } = block.mathBlockData;
        for (let r = 0; r < rows; r++) {
          let line = '';
          for (let c = 0; c < cols; c++) {
            line += cells[r * cols + c] ?? '';
          }
          const trimmed = line.trim();
          if (trimmed.length === 0) continue;
          const type = detectExpression(trimmed);
          if (type === 'assignment') {
            const match = trimmed.match(ASSIGNMENT_PATTERN);
            if (match) {
              const varName = match[1].trim().toLowerCase();
              const exprText = match[2].trim();
              const tokens = tokenize(exprText);
              if (tokens) {
                const result = evalTokens(tokens, context);
                if (result !== null) {
                  context.set(varName, result);
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // Never throw — return whatever context we have so far
  }

  return context;
}

// ── 6. formatNumber ────────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  try {
    if (!isFinite(n)) return String(n);

    // Integer
    if (Number.isInteger(n)) {
      return n.toLocaleString('en-US');
    }

    // Decimal: max 4 fractional digits
    const formatted = n.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });

    return formatted;
  } catch {
    return String(n);
  }
}
