import dotenv from 'dotenv';
dotenv.config({ override: true });
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { v4 as uuid } from 'uuid';
import type {
  ArenaConfig,
  ArenaAgent,
  ArenaParsedAction,
  ArenaTransfer,
  ArenaMessage,
  ArenaRoundSummary,
} from './types.js';
import { DataStore } from '../data/store.js';
import { AgentManager } from '../agents/manager.js';
import { LLMRouter } from '../llm/router.js';
import { MessageRouter } from './message-router.js';
import { buildArenaPrompt, getPrimingText } from './prompts.js';
import { parseArenaActions, applyRateLimits } from './action-parser.js';
import { ArenaAnalyzer } from './analysis.js';

export class ArenaCoordinator {
  private config: ArenaConfig;
  private store: DataStore;
  private agentManager: AgentManager;
  private llm: LLMRouter;
  private messageRouter!: MessageRouter;
  private agents: ArenaAgent[] = [];
  private experimentId: string = '';
  private roundSummaries: ArenaRoundSummary[] = [];

  constructor(configPath: string) {
    const configYaml = readFileSync(configPath, 'utf-8');
    this.config = parseYaml(configYaml) as ArenaConfig;
    this.store = new DataStore(
      `arena-${this.config.name.replace(/\s+/g, '-').toLowerCase()}.db`
    );
    this.agentManager = new AgentManager(process.env.LF_OPERATOR_KEY || '');
    this.llm = new LLMRouter();
  }

  async run(): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  AI ECONOMIC ARENA: ${this.config.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`${this.config.description}\n`);

    try {
      await this.setup();
      await this.executeRounds();
      await this.teardown();
    } catch (err) {
      console.error('Arena failed:', err);
      this.store.updateExperimentPhase(this.experimentId, 'error');
      throw err;
    }
  }

  // ─── Setup ───────────────────────────────────────────────────────

  private async setup(): Promise<void> {
    console.log('--- Phase: Setup ---');

    // Create experiment record
    const configYaml = readFileSync(
      process.argv.find(a => a.startsWith('--config='))?.split('=')[1]
        || process.argv[3]
        || 'experiments/arena-pilot.yaml',
      'utf-8'
    );
    this.experimentId = this.store.createExperiment(
      this.config.name,
      this.config.description,
      configYaml
    );

    // Check operator balance
    const totalAgents = this.config.agents.reduce((sum, g) => sum + g.count, 0);
    const totalRequired = this.config.agents.reduce(
      (sum, g) => sum + g.count * (g.startingBalance ?? this.config.startingBalance),
      0
    );
    const actualBalance = await this.agentManager.checkOperatorBalance();

    console.log(`Operator balance: ${actualBalance} sats`);
    console.log(`Required: ${totalRequired} sats (${totalAgents} agents)`);

    if (actualBalance < totalRequired * 1.1) { // 10% buffer
      throw new Error(
        `Insufficient balance: have ${actualBalance}, need ${Math.ceil(totalRequired * 1.1)} (includes 10% buffer)`
      );
    }

    // Create agent configs and shuffle for anonymous assignment
    this.agents = this.createAgents();
    console.log(`Created ${this.agents.length} agents (shuffled for anonymous assignment)`);

    // Print agent mapping (for researcher reference, not shown to agents)
    console.log('\nAgent Identity Map (CONFIDENTIAL):');
    for (const agent of this.agents) {
      console.log(`  ${agent.anonymousName} -> ${agent.model} (${agent.modelId}) [${agent.primingCondition}]`);
    }
    console.log('');

    // Store agent configs in DB
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      this.store.createAgent({
        id: agent.id,
        name: agent.anonymousName,
        model: agent.model,
        modelId: agent.modelId,
        primingCondition: agent.primingCondition,
        experimentId: this.experimentId,
        groupIndex: i,
      });
    }

    // Create Lightning wallets and fund
    console.log('Creating Lightning wallets and funding agents...');
    for (const agent of this.agents) {
      const startBal = this.getStartingBalance(agent);
      const lfAgent = await this.agentManager.createLightningAgent(
        `arena-${agent.id.slice(0, 8)}-${agent.anonymousName}`
      );
      await this.agentManager.fundAgent(lfAgent.id, startBal);

      agent.lightningAgentId = lfAgent.id;
      agent.lightningApiKey = lfAgent.apiKey;
      agent.balance = startBal;

      // Update DB with Lightning info
      this.store.updateAgentLightning(agent.id, lfAgent.id, lfAgent.apiKey);

      console.log(`  ${agent.anonymousName}: LN#${lfAgent.id}, funded ${startBal} sats [${agent.primingCondition}]`);
      await sleep(200);
    }

    // Initialize message router
    this.messageRouter = new MessageRouter(this.agents);

    // Record initial balances
    for (const agent of this.agents) {
      this.store.recordArenaBalance(this.experimentId, 0, agent.id, agent.balance);
    }

    this.store.updateExperimentPhase(this.experimentId, 'running');
    this.store.log(this.experimentId, 'info', 'Arena setup complete', {
      agents: this.agents.length,
      defaultStartingBalance: this.config.startingBalance,
      totalFunded: totalRequired,
      totalRounds: this.config.totalRounds,
    });
    console.log('\nSetup complete. Starting arena...\n');
  }

  // ─── Round execution ─────────────────────────────────────────────

  private async executeRounds(): Promise<void> {
    console.log('--- Phase: Execute ---');

    for (let round = 1; round <= this.config.totalRounds; round++) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`  Round ${round} of ${this.config.totalRounds}`);
      console.log(`${'─'.repeat(50)}`);

      const summary = await this.executeOneRound(round);
      this.roundSummaries.push(summary);

      // Print round summary
      this.printRoundSummary(summary);

      // Rate limit between rounds
      await sleep(1000);
    }
  }

  private async executeOneRound(round: number): Promise<ArenaRoundSummary> {
    const isFinalRound = round === this.config.totalRounds && this.config.rules.announceFinalRound;

    // 1. Snapshot current balances from Lightning
    const balanceBefore = new Map<string, number>();
    for (const agent of this.agents) {
      if (agent.lightningAgentId) {
        const bal = await this.agentManager.getAgentBalance(agent.lightningAgentId);
        agent.balance = bal;
      }
      balanceBefore.set(agent.id, agent.balance);
      await sleep(50);
    }

    // 2. Determine eliminated agents (0 balance)
    const eliminatedNames = this.agents
      .filter(a => a.balance === 0)
      .map(a => a.anonymousName);

    // 3. Query all agents for actions
    const allAgentNames = this.agents.map(a => a.anonymousName);
    const agentActions = new Map<string, ArenaParsedAction[]>();

    // Batch queries with concurrency limit
    const CONCURRENCY = 4;
    for (let i = 0; i < this.agents.length; i += CONCURRENCY) {
      const batch = this.agents.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(agent => this.queryAgent(agent, round, isFinalRound, allAgentNames, eliminatedNames))
      );
      for (let j = 0; j < batch.length; j++) {
        agentActions.set(batch[j].id, results[j]);
      }
    }

    // 4. Execute transfers
    const transfers: ArenaTransfer[] = [];
    // Shuffle agent order for fair transfer execution
    const shuffledAgents = shuffleArray([...this.agents]);

    for (const agent of shuffledAgents) {
      const actions = agentActions.get(agent.id) || [];
      const sendActions = actions.filter(a => a.type === 'send' && a.valid);

      for (const action of sendActions) {
        const transfer = await this.executeTransfer(
          round, agent, action.targetName!, action.amount!
        );
        transfers.push(transfer);
      }
    }

    // 5. Route messages
    const messages: ArenaMessage[] = [];
    for (const agent of this.agents) {
      const actions = agentActions.get(agent.id) || [];

      for (const action of actions) {
        if (action.type === 'broadcast' && action.valid && action.content) {
          const msg = this.messageRouter.addBroadcast(round, agent.id, action.content);
          messages.push(msg);
        } else if (action.type === 'message' && action.valid && action.targetName && action.content) {
          const msg = this.messageRouter.addPrivateMessage(
            round, agent.id, action.targetName, action.content
          );
          if (msg) messages.push(msg);
        }
      }
    }

    // 6. Snapshot balances after actions
    const balanceAfter = new Map<string, number>();
    for (const agent of this.agents) {
      if (agent.lightningAgentId) {
        const bal = await this.agentManager.getAgentBalance(agent.lightningAgentId);
        agent.balance = bal;
      }
      balanceAfter.set(agent.id, agent.balance);
      this.store.recordArenaBalance(this.experimentId, round, agent.id, agent.balance);
      await sleep(50);
    }

    // 7. Detect newly eliminated agents
    const newlyEliminated = this.agents
      .filter(a => a.balance === 0 && (balanceBefore.get(a.id) || 0) > 0)
      .map(a => a.id);

    // 8. Persist round data to DB
    this.store.recordArenaRound(this.experimentId, round, {
      transferCount: transfers.filter(t => t.success).length,
      messageCount: messages.length,
      eliminatedCount: newlyEliminated.length,
    });

    for (const transfer of transfers) {
      this.store.recordArenaTransfer(this.experimentId, transfer);
    }

    for (const message of messages) {
      this.store.recordArenaMessage(this.experimentId, message);
    }

    this.store.log(this.experimentId, 'info', `Round ${round} complete`, {
      transfers: transfers.filter(t => t.success).length,
      messages: messages.length,
      eliminated: newlyEliminated.length,
    });

    return {
      round,
      balanceBefore,
      balanceAfter,
      actions: agentActions,
      transfers,
      messages,
      eliminatedThisRound: newlyEliminated,
    };
  }

  private async queryAgent(
    agent: ArenaAgent,
    round: number,
    isFinalRound: boolean,
    allAgentNames: string[],
    eliminatedNames: string[]
  ): Promise<ArenaParsedAction[]> {
    // Build prompt context
    const publicMessages = this.messageRouter.getPublicMessages(
      round, this.config.publicMessageHistory
    );
    const privateMessages = this.messageRouter.getPrivateMessagesFor(
      agent.id, round, this.config.privateMessageHistory
    );

    const { system, user } = buildArenaPrompt({
      agentName: agent.anonymousName,
      agentModel: this.config.revealModelType ? agent.model : undefined,
      balance: agent.balance,
      round,
      totalRounds: this.config.totalRounds,
      allAgentNames,
      eliminatedNames,
      publicMessages,
      privateMessages,
      rules: this.config.rules,
      isFinalRound,
      primingText: getPrimingText(agent.primingCondition),
    });

    try {
      const response = await this.llm.query({
        model: agent.model,
        modelId: agent.modelId,
        prompt: user,
        systemPrompt: system,
        temperature: this.config.temperature,
        maxTokens: 300,
      });

      // Parse actions
      const rawActions = parseArenaActions(
        response.content,
        allAgentNames,
        agent.anonymousName
      );

      // Apply rate limits
      const { allowed, rejected } = applyRateLimits(rawActions, {
        maxTransfers: this.config.rules.maxTransfersPerRound,
        maxPrivateMessages: this.config.rules.maxPrivateMessagesPerRound,
        maxBroadcasts: this.config.rules.maxBroadcastsPerRound,
      });

      // Log rejected actions
      for (const r of rejected) {
        this.store.log(this.experimentId, 'warn', `Action rejected for ${agent.anonymousName}`, {
          action: r.raw,
          error: r.error,
        });
      }

      // Record raw response in DB
      this.store.recordArenaAction(this.experimentId, round, agent.id, {
        rawResponse: response.content,
        parsedActions: allowed,
        prompt: user,
        responseTimeMs: response.responseTimeMs,
        tokensInput: response.tokensUsed.input,
        tokensOutput: response.tokensUsed.output,
      });

      return allowed;
    } catch (err) {
      console.error(`  Error querying ${agent.anonymousName}:`, err instanceof Error ? err.message : 'unknown');
      this.store.log(this.experimentId, 'error', `Query failed for ${agent.anonymousName}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return [{ type: 'pass', raw: 'ERROR', valid: true }];
    }
  }

  private async executeTransfer(
    round: number,
    fromAgent: ArenaAgent,
    toName: string,
    amount: number
  ): Promise<ArenaTransfer> {
    const toAgentId = this.messageRouter.resolveAgentName(toName);
    const toAgent = toAgentId ? this.messageRouter.getAgent(toAgentId) : undefined;

    if (!toAgent || !fromAgent.lightningAgentId || !toAgent.lightningAgentId) {
      return {
        id: uuid(),
        round,
        fromAgentId: fromAgent.id,
        fromName: fromAgent.anonymousName,
        toAgentId: toAgentId || 'unknown',
        toName,
        amount,
        success: false,
        errorMessage: 'Invalid agent or missing Lightning wallet',
      };
    }

    // Check minimum transfer amount
    if (amount < this.config.rules.minTransferAmount) {
      return {
        id: uuid(),
        round,
        fromAgentId: fromAgent.id,
        fromName: fromAgent.anonymousName,
        toAgentId: toAgent.id,
        toName,
        amount,
        success: false,
        errorMessage: `Below minimum transfer (${this.config.rules.minTransferAmount} sats)`,
      };
    }

    // Check balance
    if (fromAgent.balance < amount) {
      return {
        id: uuid(),
        round,
        fromAgentId: fromAgent.id,
        fromName: fromAgent.anonymousName,
        toAgentId: toAgent.id,
        toName,
        amount,
        success: false,
        errorMessage: `Insufficient balance (have ${fromAgent.balance}, need ${amount})`,
      };
    }

    try {
      await this.agentManager.transferBetweenAgents(
        fromAgent.lightningAgentId,
        toAgent.lightningAgentId,
        amount
      );

      // Update local balance tracking
      fromAgent.balance -= amount;
      toAgent.balance += amount;

      console.log(`  Transfer: ${fromAgent.anonymousName} -> ${toName}: ${amount} sats`);

      return {
        id: uuid(),
        round,
        fromAgentId: fromAgent.id,
        fromName: fromAgent.anonymousName,
        toAgentId: toAgent.id,
        toName,
        amount,
        success: true,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`  Transfer failed: ${fromAgent.anonymousName} -> ${toName}: ${errorMsg}`);

      return {
        id: uuid(),
        round,
        fromAgentId: fromAgent.id,
        fromName: fromAgent.anonymousName,
        toAgentId: toAgent.id,
        toName,
        amount,
        success: false,
        errorMessage: errorMsg,
      };
    }
  }

  // ─── Teardown ────────────────────────────────────────────────────

  private async teardown(): Promise<void> {
    console.log('\n--- Phase: Teardown ---');

    // Final balance snapshot
    console.log('\nFinal Balances:');
    const finalBalances = new Map<string, number>();
    for (const agent of this.agents) {
      if (agent.lightningAgentId) {
        agent.balance = await this.agentManager.getAgentBalance(agent.lightningAgentId);
      }
      finalBalances.set(agent.id, agent.balance);
      console.log(`  ${agent.anonymousName} (${agent.model}): ${agent.balance} sats`);
      await sleep(50);
    }

    // Run analysis
    console.log('\n--- Analysis ---');
    const analyzer = new ArenaAnalyzer(
      this.agents,
      this.roundSummaries,
      this.messageRouter.getAllMessages()
    );

    const gini = analyzer.giniCoefficient();
    console.log(`Gini coefficient: ${gini.toFixed(4)} (0=equal, 1=one-agent-has-all)`);

    const network = analyzer.transferNetwork();
    console.log(`\nTransfer Network (total volume: ${network.totalVolume} sats):`);
    for (const edge of network.edges.slice(0, 10)) {
      console.log(`  ${edge.from} -> ${edge.to}: ${edge.totalAmount} sats (${edge.count} transfers)`);
    }

    const factions = analyzer.factionAnalysis();
    console.log('\nFaction Analysis:');
    console.log(`  Intra-Claude transfers: ${factions.intraClaude.count} (${factions.intraClaude.volume} sats)`);
    console.log(`  Intra-GPT transfers: ${factions.intraGPT.count} (${factions.intraGPT.volume} sats)`);
    console.log(`  Cross-faction transfers: ${factions.cross.count} (${factions.cross.volume} sats)`);

    const balanceTrajectories = analyzer.balanceTrajectories();
    console.log('\nBalance Trajectories (start -> end):');
    for (const [name, trajectory] of balanceTrajectories) {
      const start = trajectory[0]?.balance ?? 0;
      const end = trajectory[trajectory.length - 1]?.balance ?? 0;
      const delta = end - start;
      console.log(`  ${name}: ${start} -> ${end} (${delta >= 0 ? '+' : ''}${delta})`);
    }

    // Sweep all balances back
    console.log('\nSweeping agent balances back to operator...');
    let totalSwept = 0;
    for (const agent of this.agents) {
      if (!agent.lightningAgentId) continue;
      try {
        const balance = await this.agentManager.getAgentBalance(agent.lightningAgentId);
        if (balance > 0) {
          await this.agentManager.sweepAgent(agent.lightningAgentId, balance);
          totalSwept += balance;
        }
        await sleep(100);
      } catch (err) {
        console.error(`  Failed to sweep ${agent.anonymousName}:`, err instanceof Error ? err.message : 'unknown');
      }
    }
    console.log(`Total swept: ${totalSwept} sats`);

    // LLM stats
    const llmStats = this.llm.getStats();
    console.log(`\nLLM Stats:`);
    console.log(`  Claude calls: ${llmStats.calls.claude}, OpenAI calls: ${llmStats.calls.openai}`);
    console.log(`  Estimated cost: $${llmStats.estimatedCost.total}`);

    // Export analysis data
    const exportData = analyzer.exportForVisualization();
    this.store.log(this.experimentId, 'info', 'Arena analysis complete', {
      giniCoefficient: gini,
      totalTransfers: network.totalVolume,
      factions,
      llmStats: llmStats.estimatedCost,
    });

    this.store.updateExperimentPhase(this.experimentId, 'completed');
    this.store.close();

    console.log('\nArena experiment complete.');
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private getStartingBalance(agent: ArenaAgent): number {
    // Find the group config that matches this agent's model+modelId+primingCondition
    for (const group of this.config.agents) {
      if (
        group.model === agent.model &&
        group.modelId === agent.modelId &&
        (group.primingCondition || 'neutral') === agent.primingCondition
      ) {
        return group.startingBalance ?? this.config.startingBalance;
      }
    }
    return this.config.startingBalance;
  }

  private createAgents(): ArenaAgent[] {
    const agents: ArenaAgent[] = [];

    for (const group of this.config.agents) {
      for (let i = 0; i < group.count; i++) {
        agents.push({
          id: uuid(),
          anonymousName: '', // assigned after shuffle
          model: group.model,
          modelId: group.modelId,
          primingCondition: group.primingCondition || 'neutral',
          balance: 0,
        });
      }
    }

    // Shuffle for random anonymous name assignment
    const shuffled = shuffleArray(agents);
    for (let i = 0; i < shuffled.length; i++) {
      shuffled[i].anonymousName = `Agent-${i + 1}`;
    }

    return shuffled;
  }

  private printRoundSummary(summary: ArenaRoundSummary): void {
    const successfulTransfers = summary.transfers.filter(t => t.success);
    const publicMsgs = summary.messages.filter(m => m.type === 'public');
    const privateMsgs = summary.messages.filter(m => m.type === 'private');

    console.log(`  Transfers: ${successfulTransfers.length} successful`);
    console.log(`  Messages: ${publicMsgs.length} public, ${privateMsgs.length} private`);

    if (summary.eliminatedThisRound.length > 0) {
      const names = summary.eliminatedThisRound.map(id => {
        const agent = this.agents.find(a => a.id === id);
        return agent?.anonymousName || id;
      });
      console.log(`  Eliminated: ${names.join(', ')}`);
    }

    // Top 3 balances
    const balances = [...summary.balanceAfter.entries()]
      .map(([id, bal]) => ({
        name: this.agents.find(a => a.id === id)?.anonymousName || id,
        balance: bal,
      }))
      .sort((a, b) => b.balance - a.balance);

    console.log(`  Top 3: ${balances.slice(0, 3).map(b => `${b.name}=${b.balance}`).join(', ')}`);
  }
}

// ─── Entry point ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const configPath = process.argv.find(a => a.startsWith('--config='))?.split('=')[1]
    || process.argv[3]
    || 'experiments/arena-pilot.yaml';

  console.log(`Loading arena config: ${configPath}`);
  const coordinator = new ArenaCoordinator(configPath);
  await coordinator.run();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// ─── Utilities ───────────────────────────────────────────────────

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
