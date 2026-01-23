import type { GameType } from '../types.js';

export interface ParseResult {
  valid: boolean;
  action: string;
  parsedValue: Record<string, unknown>;
  error?: string;
}

export function parseResponse(gameType: GameType, response: string, context: {
  role?: string;
  maxAmount?: number;
  options?: string[];
}): ParseResult {
  const cleaned = response.trim().toUpperCase();

  switch (gameType) {
    case 'prisoners-dilemma':
      return parsePDResponse(cleaned);
    case 'ultimatum':
      return parseUltimatumResponse(cleaned, context);
    case 'trust':
      return parseTrustResponse(cleaned, context);
    case 'public-goods':
      return parsePublicGoodsResponse(cleaned, context);
    case 'dictator':
      return parseDictatorResponse(cleaned, context);
    default:
      return { valid: false, action: 'unknown', parsedValue: {}, error: `Unknown game type: ${gameType}` };
  }
}

function parsePDResponse(response: string): ParseResult {
  // Try exact match first
  if (response === 'COOPERATE') {
    return { valid: true, action: 'cooperate', parsedValue: { choice: 'cooperate' } };
  }
  if (response === 'DEFECT') {
    return { valid: true, action: 'defect', parsedValue: { choice: 'defect' } };
  }

  // Try to find the word in a longer response
  const lower = response.toLowerCase();
  if (lower.includes('cooperate') && !lower.includes('defect')) {
    return { valid: true, action: 'cooperate', parsedValue: { choice: 'cooperate' } };
  }
  if (lower.includes('defect') && !lower.includes('cooperate')) {
    return { valid: true, action: 'defect', parsedValue: { choice: 'defect' } };
  }

  // Check for first word
  const firstWord = response.split(/\s+/)[0].replace(/[^A-Z]/g, '');
  if (firstWord === 'COOPERATE') {
    return { valid: true, action: 'cooperate', parsedValue: { choice: 'cooperate' } };
  }
  if (firstWord === 'DEFECT') {
    return { valid: true, action: 'defect', parsedValue: { choice: 'defect' } };
  }

  return {
    valid: false,
    action: 'unparseable',
    parsedValue: { raw: response },
    error: `Could not parse PD response: "${response.slice(0, 100)}"`,
  };
}

function parseUltimatumResponse(response: string, context: {
  role?: string;
  maxAmount?: number;
}): ParseResult {
  if (context.role === 'proposer') {
    return parseNumericResponse(response, 0, context.maxAmount || 10000, 'offer');
  }

  // Responder: accept or reject
  if (response === 'ACCEPT' || response.startsWith('ACCEPT')) {
    return { valid: true, action: 'accept', parsedValue: { accept: true } };
  }
  if (response === 'REJECT' || response.startsWith('REJECT')) {
    return { valid: true, action: 'reject', parsedValue: { accept: false } };
  }

  const lower = response.toLowerCase();
  if (lower.includes('accept') && !lower.includes('reject')) {
    return { valid: true, action: 'accept', parsedValue: { accept: true } };
  }
  if (lower.includes('reject') && !lower.includes('accept')) {
    return { valid: true, action: 'reject', parsedValue: { accept: false } };
  }

  return {
    valid: false,
    action: 'unparseable',
    parsedValue: { raw: response },
    error: `Could not parse ultimatum response: "${response.slice(0, 100)}"`,
  };
}

function parseTrustResponse(response: string, context: {
  role?: string;
  maxAmount?: number;
}): ParseResult {
  const label = context.role === 'investor' ? 'investment' : 'return';
  return parseNumericResponse(response, 0, context.maxAmount || 10000, label);
}

function parsePublicGoodsResponse(response: string, context: {
  maxAmount?: number;
}): ParseResult {
  return parseNumericResponse(response, 0, context.maxAmount || 10000, 'contribution');
}

function parseDictatorResponse(response: string, context: {
  maxAmount?: number;
}): ParseResult {
  return parseNumericResponse(response, 0, context.maxAmount || 10000, 'give');
}

function parseNumericResponse(
  response: string,
  min: number,
  max: number,
  label: string
): ParseResult {
  // Try to extract a number from the response
  const numbers = response.match(/\d+/g);
  if (!numbers || numbers.length === 0) {
    return {
      valid: false,
      action: 'unparseable',
      parsedValue: { raw: response },
      error: `No number found in response: "${response.slice(0, 100)}"`,
    };
  }

  // Use the first number found
  const value = parseInt(numbers[0], 10);

  if (isNaN(value)) {
    return {
      valid: false,
      action: 'unparseable',
      parsedValue: { raw: response },
      error: `Invalid number in response`,
    };
  }

  // Clamp to valid range
  const clamped = Math.max(min, Math.min(max, value));

  return {
    valid: true,
    action: `${label}_${clamped}`,
    parsedValue: { [label]: clamped, original: value, clamped: value !== clamped },
  };
}

export function isRetryable(result: ParseResult): boolean {
  return !result.valid && result.action === 'unparseable';
}

export function buildRetryPrompt(gameType: GameType, originalResponse: string, context: {
  role?: string;
}): string {
  switch (gameType) {
    case 'prisoners-dilemma':
      return `Your previous response "${originalResponse.slice(0, 50)}" was not in the correct format. Please respond with exactly one word: COOPERATE or DEFECT`;
    case 'ultimatum':
      if (context.role === 'proposer') {
        return `Your previous response was not in the correct format. Please respond with exactly one number representing your offer.`;
      }
      return `Your previous response was not in the correct format. Please respond with exactly one word: ACCEPT or REJECT`;
    case 'trust':
      return `Your previous response was not in the correct format. Please respond with exactly one number.`;
    case 'public-goods':
      return `Your previous response was not in the correct format. Please respond with exactly one number representing your contribution.`;
    case 'dictator':
      return `Your previous response was not in the correct format. Please respond with exactly one number representing how many sats you give.`;
    default:
      return `Please respond with a single value as instructed.`;
  }
}
