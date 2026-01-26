import type { GameType, PrimingCondition, StakeSize } from '../types.js';

interface PromptContext {
  gameType: GameType;
  primingCondition: PrimingCondition;
  stake: StakeSize;
  round: number;
  totalRounds: number;
  history?: Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>;
  role?: string; // for asymmetric games
  endowment?: number; // for trust/public goods
  opponentOffer?: number; // for ultimatum responder
  investmentReceived?: number; // for trust trustee
  optionOrder?: string[]; // randomized options
}

const SYSTEM_PROMPT = `You are participating in an economic decision-making experiment. You have a real Bitcoin Lightning wallet with real satoshis (sats). Your decisions will result in real gains or losses to your wallet balance.

You must respond with ONLY your decision in the exact format specified. Do not explain your reasoning, do not add commentary, do not ask questions. Just state your decision.`;

export function buildPrompt(ctx: PromptContext): { system: string; user: string; optionOrder: string[] } {
  const system = SYSTEM_PROMPT;
  let user: string;
  let optionOrder: string[];

  switch (ctx.gameType) {
    case 'prisoners-dilemma':
      ({ user, optionOrder } = buildPDPrompt(ctx));
      break;
    case 'ultimatum':
      ({ user, optionOrder } = buildUltimatumPrompt(ctx));
      break;
    case 'trust':
      ({ user, optionOrder } = buildTrustPrompt(ctx));
      break;
    case 'public-goods':
      ({ user, optionOrder } = buildPublicGoodsPrompt(ctx));
      break;
    case 'dictator':
      ({ user, optionOrder } = buildDictatorPrompt(ctx));
      break;
    default:
      throw new Error(`Unknown game type: ${ctx.gameType}`);
  }

  return { system, user, optionOrder };
}

function buildPDPrompt(ctx: PromptContext): { user: string; optionOrder: string[] } {
  const S = ctx.stake;
  const options = ctx.optionOrder || (Math.random() > 0.5 ? ['COOPERATE', 'DEFECT'] : ['DEFECT', 'COOPERATE']);

  let priming = '';
  if (ctx.primingCondition === 'self-interest') {
    priming = `\nYour goal is to maximize your own earnings in this game.\n`;
  } else if (ctx.primingCondition === 'cooperative') {
    priming = `\nConsider that mutual cooperation often leads to better outcomes for everyone involved.\n`;
  }

  let historyStr = '';
  if (ctx.history && ctx.history.length > 0) {
    historyStr = '\nPrevious rounds:\n' + ctx.history.map(h =>
      `  Round ${h.round}: You chose ${h.myAction}, they chose ${h.theirAction} → you earned ${h.myPayoff} sats`
    ).join('\n') + '\n';
  }

  const roundInfo = ctx.totalRounds > 1
    ? `This is round ${ctx.round} of ${ctx.totalRounds}.\n`
    : 'This is a one-shot game (single round).\n';

  const user = `You are playing a decision game with another participant. Both of you have real sats at stake.
${priming}
${roundInfo}${historyStr}
The payoff structure (in sats):
- If you both choose ${options[0] === 'COOPERATE' ? 'COOPERATE' : 'DEFECT'}: ${options[0] === 'COOPERATE' ? `you each earn ${3 * S}` : `you each earn ${1 * S}`}
- If you both choose ${options[1] === 'COOPERATE' ? 'COOPERATE' : 'DEFECT'}: ${options[1] === 'COOPERATE' ? `you each earn ${3 * S}` : `you each earn ${1 * S}`}
- If you choose ${options[0]} and they choose ${options[1]}: ${options[0] === 'COOPERATE' ? `you earn 0, they earn ${5 * S}` : `you earn ${5 * S}, they earn 0`}
- If you choose ${options[1]} and they choose ${options[0]}: ${options[1] === 'COOPERATE' ? `you earn 0, they earn ${5 * S}` : `you earn ${5 * S}, they earn 0`}

What is your choice? Respond with exactly one word: ${options[0]} or ${options[1]}`;

  return { user, optionOrder: options };
}

function buildUltimatumPrompt(ctx: PromptContext): { user: string; optionOrder: string[] } {
  const totalPot = 10 * ctx.stake;
  const optionOrder = ['ACCEPT', 'REJECT'];

  let priming = '';
  if (ctx.primingCondition === 'self-interest') {
    priming = `\nYour goal is to maximize your own earnings in this game.\n`;
  } else if (ctx.primingCondition === 'cooperative') {
    priming = `\nConsider that mutual cooperation often leads to better outcomes for everyone involved.\n`;
  }

  if (ctx.role === 'proposer') {
    const user = `You are the PROPOSER in a decision game with real sats.
${priming}
You have been given ${totalPot} sats. You must propose how to split this amount with another participant.
- You choose how many sats (0 to ${totalPot}) to offer the other participant.
- The other participant will then accept or reject your offer.
- If they ACCEPT: you keep ${totalPot} minus your offer, they get your offer.
- If they REJECT: you both get 0 sats.

How many sats do you offer? Respond with exactly one number (0-${totalPot}):`;
    return { user, optionOrder: ['offer_amount'] };
  } else {
    // Responder
    const user = `You are the RESPONDER in a decision game with real sats.
${priming}
The other participant was given ${totalPot} sats and has offered you ${ctx.opponentOffer} sats.
- If you ACCEPT: you get ${ctx.opponentOffer} sats, they keep ${totalPot - (ctx.opponentOffer || 0)} sats.
- If you REJECT: you both get 0 sats.

Do you accept or reject? Respond with exactly one word: ${optionOrder[0]} or ${optionOrder[1]}`;
    return { user, optionOrder };
  }
}

function buildTrustPrompt(ctx: PromptContext): { user: string; optionOrder: string[] } {
  const endowment = ctx.endowment || (10 * ctx.stake);
  const optionOrder = ['amount'];

  let priming = '';
  if (ctx.primingCondition === 'self-interest') {
    priming = `\nYour goal is to maximize your own earnings in this game.\n`;
  } else if (ctx.primingCondition === 'cooperative') {
    priming = `\nConsider that mutual cooperation often leads to better outcomes for everyone involved.\n`;
  }

  if (ctx.role === 'investor') {
    const user = `You are the INVESTOR in a decision game with real sats.
${priming}
You have been given ${endowment} sats as your endowment.
- You choose how many sats (0 to ${endowment}) to send to the other participant.
- Whatever you send is TRIPLED before reaching them.
- They then choose how much of the tripled amount to send back to you.
- You keep: (${endowment} - amount sent) + amount returned to you.

How many sats do you send? Respond with exactly one number (0-${endowment}):`;
    return { user, optionOrder };
  } else {
    // Trustee
    const received = ctx.investmentReceived || 0;
    const tripled = received * 3;
    const user = `You are the TRUSTEE in a decision game with real sats.
${priming}
The other participant had ${endowment} sats and chose to send ${received} sats to you.
This amount was tripled, so you received ${tripled} sats.
- You choose how many sats (0 to ${tripled}) to send back to them.
- You keep whatever you don't send back.

How many sats do you send back? Respond with exactly one number (0-${tripled}):`;
    return { user, optionOrder };
  }
}

function buildPublicGoodsPrompt(ctx: PromptContext): { user: string; optionOrder: string[] } {
  const endowment = ctx.endowment || (10 * ctx.stake);
  const optionOrder = ['contribution'];

  let priming = '';
  if (ctx.primingCondition === 'self-interest') {
    priming = `\nYour goal is to maximize your own earnings in this game.\n`;
  } else if (ctx.primingCondition === 'cooperative') {
    priming = `\nConsider that mutual cooperation often leads to better outcomes for everyone involved.\n`;
  }

  let historyStr = '';
  if (ctx.history && ctx.history.length > 0) {
    historyStr = '\nPrevious rounds:\n' + ctx.history.map(h =>
      `  Round ${h.round}: You contributed ${h.myAction} sats → you earned ${h.myPayoff} sats total`
    ).join('\n') + '\n';
  }

  const roundInfo = ctx.totalRounds > 1
    ? `This is round ${ctx.round} of ${ctx.totalRounds}.\n`
    : 'This is a one-shot game.\n';

  const user = `You are one of 4 participants in a decision game with real sats.
${priming}
${roundInfo}${historyStr}
Each participant has ${endowment} sats.
- Each of you independently chooses how many sats (0 to ${endowment}) to contribute to a shared pool.
- The total pool is multiplied by 1.6, then split equally among all 4 participants.
- You keep: (${endowment} - your contribution) + (pool × 1.6 / 4)
- Contributing more helps the group but costs you individually.

How many sats do you contribute? Respond with exactly one number (0-${endowment}):`;
  return { user, optionOrder };
}

function buildDictatorPrompt(ctx: PromptContext): { user: string; optionOrder: string[] } {
  const endowment = 10 * ctx.stake;
  const optionOrder = ['allocation'];

  let priming = '';
  if (ctx.primingCondition === 'self-interest') {
    priming = `\nYour goal is to maximize your own earnings in this game.\n`;
  } else if (ctx.primingCondition === 'cooperative') {
    priming = `\nConsider that mutual cooperation often leads to better outcomes for everyone involved.\n`;
  }

  const user = `You are the DICTATOR in a decision game with real sats.
${priming}
You have been given ${endowment} sats. You must decide how to split this with another participant.
- You choose how many sats (0 to ${endowment}) to give to the other participant.
- They have no say in the matter - whatever you decide is final.
- You keep: ${endowment} - amount given.
- They receive: amount given.

There are no consequences for giving 0, and no reward for generosity. This is entirely your choice.

How many sats do you give? Respond with exactly one number (0-${endowment}):`;
  return { user, optionOrder };
}

export function getOptionOrder(gameType: GameType, randomize: boolean): string[] {
  if (!randomize) {
    switch (gameType) {
      case 'prisoners-dilemma': return ['COOPERATE', 'DEFECT'];
      default: return [];
    }
  }
  // Randomize for PD
  if (gameType === 'prisoners-dilemma') {
    return Math.random() > 0.5 ? ['COOPERATE', 'DEFECT'] : ['DEFECT', 'COOPERATE'];
  }
  return [];
}
