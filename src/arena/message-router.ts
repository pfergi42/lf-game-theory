import { v4 as uuid } from 'uuid';
import type { ArenaAgent, ArenaMessage } from './types.js';

/**
 * Manages public and private messaging between arena agents.
 * Messages are stored in memory during the experiment and persisted to DB by the coordinator.
 */
export class MessageRouter {
  private messages: ArenaMessage[] = [];
  private agentMap: Map<string, ArenaAgent> = new Map(); // id -> agent
  private nameMap: Map<string, ArenaAgent> = new Map(); // anonymousName -> agent

  constructor(agents: ArenaAgent[]) {
    for (const agent of agents) {
      this.agentMap.set(agent.id, agent);
      this.nameMap.set(agent.anonymousName, agent);
    }
  }

  /**
   * Add a public broadcast message.
   */
  addBroadcast(round: number, fromAgentId: string, content: string): ArenaMessage {
    const from = this.agentMap.get(fromAgentId);
    if (!from) throw new Error(`Unknown agent ID: ${fromAgentId}`);

    const msg: ArenaMessage = {
      id: uuid(),
      round,
      fromAgentId,
      fromName: from.anonymousName,
      toAgentId: null,
      toName: null,
      content,
      type: 'public',
    };

    this.messages.push(msg);
    return msg;
  }

  /**
   * Add a private message from one agent to another (by anonymous name).
   */
  addPrivateMessage(
    round: number,
    fromAgentId: string,
    toName: string,
    content: string
  ): ArenaMessage | null {
    const from = this.agentMap.get(fromAgentId);
    const to = this.nameMap.get(toName);
    if (!from) throw new Error(`Unknown agent ID: ${fromAgentId}`);
    if (!to) return null; // Invalid target

    const msg: ArenaMessage = {
      id: uuid(),
      round,
      fromAgentId,
      fromName: from.anonymousName,
      toAgentId: to.id,
      toName: to.anonymousName,
      content,
      type: 'private',
    };

    this.messages.push(msg);
    return msg;
  }

  /**
   * Get public messages from the last N rounds (for prompt building).
   */
  getPublicMessages(currentRound: number, lookbackRounds: number): ArenaMessage[] {
    const minRound = Math.max(1, currentRound - lookbackRounds);
    return this.messages
      .filter(m => m.type === 'public' && m.round >= minRound && m.round < currentRound)
      .sort((a, b) => a.round - b.round);
  }

  /**
   * Get private messages TO a specific agent from the last N rounds.
   */
  getPrivateMessagesFor(
    agentId: string,
    currentRound: number,
    lookbackRounds: number
  ): ArenaMessage[] {
    const minRound = Math.max(1, currentRound - lookbackRounds);
    return this.messages
      .filter(
        m => m.type === 'private' && m.toAgentId === agentId &&
             m.round >= minRound && m.round < currentRound
      )
      .sort((a, b) => a.round - b.round);
  }

  /**
   * Get all messages for a specific round.
   */
  getMessagesForRound(round: number): ArenaMessage[] {
    return this.messages.filter(m => m.round === round);
  }

  /**
   * Get all messages in the experiment.
   */
  getAllMessages(): ArenaMessage[] {
    return [...this.messages];
  }

  /**
   * Resolve an anonymous name to an agent ID.
   */
  resolveAgentName(name: string): string | null {
    return this.nameMap.get(name)?.id || null;
  }

  /**
   * Get agent by ID.
   */
  getAgent(id: string): ArenaAgent | undefined {
    return this.agentMap.get(id);
  }

  /**
   * Get all anonymous names.
   */
  getAllNames(): string[] {
    return [...this.nameMap.keys()];
  }
}
