import type { ArenaParsedAction, ArenaActionType } from './types.js';

/**
 * Parse a multi-line LLM response into structured arena actions.
 *
 * Expected formats:
 *   SEND <amount> TO <agent-name>
 *   MESSAGE <agent-name> "<text>"
 *   BROADCAST "<text>"
 *   PASS
 */
export function parseArenaActions(
  response: string,
  validAgentNames: string[],
  ownName: string
): ArenaParsedAction[] {
  const lines = response
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return [{ type: 'pass', raw: '', valid: true }];
  }

  const actions: ArenaParsedAction[] = [];

  for (const line of lines) {
    const action = parseSingleAction(line, validAgentNames, ownName);
    if (action) {
      actions.push(action);
    }
  }

  // If no valid actions were parsed, treat as PASS
  if (actions.length === 0) {
    return [{ type: 'pass', raw: response.slice(0, 200), valid: true }];
  }

  return actions;
}

function parseSingleAction(
  line: string,
  validAgentNames: string[],
  ownName: string
): ArenaParsedAction | null {
  const upper = line.toUpperCase().trim();

  // Skip obvious non-action lines (reasoning, commentary)
  if (upper.startsWith('//') || upper.startsWith('#') || upper.startsWith('*')) {
    return null;
  }

  // PASS
  if (upper === 'PASS' || upper.startsWith('PASS ')) {
    return { type: 'pass', raw: line, valid: true };
  }

  // SEND <amount> TO <agent-name>
  const sendMatch = line.match(/^SEND\s+(\d+)\s+TO\s+(Agent-\d+)/i);
  if (sendMatch) {
    const amount = parseInt(sendMatch[1], 10);
    const targetName = normalizeAgentName(sendMatch[2], validAgentNames);

    if (!targetName) {
      return {
        type: 'send',
        amount,
        targetName: sendMatch[2],
        raw: line,
        valid: false,
        error: `Unknown agent: ${sendMatch[2]}`,
      };
    }

    if (targetName === ownName) {
      return {
        type: 'send',
        amount,
        targetName,
        raw: line,
        valid: false,
        error: 'Cannot send to yourself',
      };
    }

    if (amount <= 0) {
      return {
        type: 'send',
        amount,
        targetName,
        raw: line,
        valid: false,
        error: 'Amount must be positive',
      };
    }

    return {
      type: 'send',
      amount,
      targetName,
      raw: line,
      valid: true,
    };
  }

  // MESSAGE <agent-name> "<text>"
  const msgMatch = line.match(/^MESSAGE\s+(Agent-\d+)\s+"([^"]*(?:"[^"]*)*?)"\s*$/i)
    || line.match(/^MESSAGE\s+(Agent-\d+)\s+(.+)$/i);
  if (msgMatch) {
    const targetName = normalizeAgentName(msgMatch[1], validAgentNames);
    // Strip surrounding quotes if present
    let content = msgMatch[2];
    if (content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }

    if (!targetName) {
      return {
        type: 'message',
        targetName: msgMatch[1],
        content,
        raw: line,
        valid: false,
        error: `Unknown agent: ${msgMatch[1]}`,
      };
    }

    if (targetName === ownName) {
      return {
        type: 'message',
        targetName,
        content,
        raw: line,
        valid: false,
        error: 'Cannot message yourself',
      };
    }

    return {
      type: 'message',
      targetName,
      content: content.slice(0, 500), // Cap message length
      raw: line,
      valid: true,
    };
  }

  // BROADCAST "<text>"
  const broadcastMatch = line.match(/^BROADCAST\s+"([^"]*(?:"[^"]*)*?)"\s*$/i)
    || line.match(/^BROADCAST\s+(.+)$/i);
  if (broadcastMatch) {
    let content = broadcastMatch[1];
    if (content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }

    return {
      type: 'broadcast',
      content: content.slice(0, 500),
      raw: line,
      valid: true,
    };
  }

  // Line doesn't match any known action format - skip it
  // (could be LLM reasoning/commentary)
  return null;
}

/**
 * Case-insensitive agent name matching.
 * Returns the correctly-cased name or null if not found.
 */
function normalizeAgentName(input: string, validNames: string[]): string | null {
  const lower = input.toLowerCase().trim();
  return validNames.find(n => n.toLowerCase() === lower) || null;
}

/**
 * Apply rate limits to a list of parsed actions.
 * Returns the actions that pass rate limiting, with excess marked invalid.
 */
export function applyRateLimits(
  actions: ArenaParsedAction[],
  rules: { maxTransfers: number; maxPrivateMessages: number; maxBroadcasts: number }
): { allowed: ArenaParsedAction[]; rejected: ArenaParsedAction[] } {
  const allowed: ArenaParsedAction[] = [];
  const rejected: ArenaParsedAction[] = [];

  let transfers = 0;
  let privateMessages = 0;
  let broadcasts = 0;

  for (const action of actions) {
    if (!action.valid) {
      rejected.push(action);
      continue;
    }

    switch (action.type) {
      case 'send':
        if (transfers < rules.maxTransfers) {
          allowed.push(action);
          transfers++;
        } else {
          rejected.push({ ...action, valid: false, error: 'Transfer rate limit exceeded' });
        }
        break;

      case 'message':
        if (privateMessages < rules.maxPrivateMessages) {
          allowed.push(action);
          privateMessages++;
        } else {
          rejected.push({ ...action, valid: false, error: 'Private message rate limit exceeded' });
        }
        break;

      case 'broadcast':
        if (broadcasts < rules.maxBroadcasts) {
          allowed.push(action);
          broadcasts++;
        } else {
          rejected.push({ ...action, valid: false, error: 'Broadcast rate limit exceeded' });
        }
        break;

      case 'pass':
        allowed.push(action);
        break;
    }
  }

  return { allowed, rejected };
}
