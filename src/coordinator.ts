import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { v4 as uuid } from 'uuid';
import type {
  AgentConfig,
  ExperimentConfig,
  GameType,
  IterationType,
  KnowledgeLevel,
  ModelProvider,
  StakeSize,
} from './types.js';
import { DataStore } from './data/store.js';
import { AgentManager } from './agents/manager.js';
import { OperatorPool } from './agents/pool.js';
import { LLMRouter } from './llm/router.js';
import { createGame } from './games/factory.js';
import { generatePairs, generateGroups } from './games/engine.js';

interface ConditionMatrix {
  gameType: GameType;
  stake: StakeSize;
  iteration: IterationType;
}

export class Coordinator {
  private config: ExperimentConfig;
  private store: DataStore;
  private agentManager: AgentManager;
  private pool: OperatorPool;
  private llm: LLMRouter;
  private agents: AgentConfig[] = [];
  private experimentId: string = '';

  constructor(configPath: string) {
    const configYaml = readFileSync(configPath, 'utf-8');
    this.config = parseYaml(configYaml) as ExperimentConfig;
    this.store = new DataStore(`${this.config.name.replace(/\s+/g, '-').toLowerCase()}.db`);
    this.agentManager = new AgentManager(process.env.LF_OPERATOR_KEY || '');
    this.pool = new OperatorPool(this.agentManager, 1_000_000);
    this.llm = new LLMRouter();
  }

  async run(): Promise<void> {
    console.log(`\n=== ${this.config.name} ===`);
    console.log(`${this.config.description}\n`);

    try {
      await this.setup();
      await this.execute();
      await this.teardown();
    } catch (err) {
      console.error('Experiment failed:', err);
      this.store.updateExperimentPhase(this.experimentId, 'error');
      throw err;
    }
  }

  private async setup(): Promise<void> {
    console.log('--- Phase: Setup ---');

    // Create experiment record
    const configYaml = readFileSync(process.argv[3] || 'experiments/pilot.yaml', 'utf-8');
    this.experimentId = this.store.createExperiment(
      this.config.name,
      this.config.description,
      configYaml
    );

    // Verify operator balance
    const { balance, sufficient } = await this.pool.verifyOperatorBalance();
    console.log(`Operator balance: ${balance} sats (${sufficient ? 'sufficient' : 'INSUFFICIENT'})`);
    if (!sufficient) {
      throw new Error('Insufficient operator balance');
    }

    // Create agents
    this.agents = this.createAgentConfigs();
    console.log(`Created ${this.agents.length} agent configs across ${this.config.agents.groups.length} groups`);

    // Store agent configs
    let groupIdx = 0;
    for (const agent of this.agents) {
      this.store.createAgent({
        ...agent,
        experimentId: this.experimentId,
        groupIndex: Math.floor(groupIdx++ / this.config.agents.countPerGroup),
      });
    }

    // Create Lightning wallets
    const fundingPerAgent = Math.floor(900_000 / this.agents.length); // Leave 100k buffer
    await this.agentManager.setupExperimentAgents(this.agents, fundingPerAgent);

    // Update agent records with Lightning IDs
    for (const agent of this.agents) {
      const lnInfo = this.agentManager.getLightningInfo(agent.id);
      if (lnInfo) {
        this.store.updateAgentLightning(agent.id, lnInfo.lightningId, lnInfo.apiKey);
        agent.lightningAgentId = lnInfo.lightningId;
        agent.lightningApiKey = lnInfo.apiKey;
      }
    }

    this.store.updateExperimentPhase(this.experimentId, 'running');
    console.log('Setup complete.\n');
  }

  private async execute(): Promise<void> {
    console.log('--- Phase: Execute ---');
    const conditions = this.generateConditionMatrix();
    console.log(`Total conditions: ${conditions.length}`);

    let conditionIdx = 0;
    for (const condition of conditions) {
      conditionIdx++;
      console.log(`\nCondition ${conditionIdx}/${conditions.length}: ${condition.gameType} | ${condition.stake}s | ${condition.iteration}`);

      const game = createGame(
        {
          gameType: condition.gameType,
          stake: condition.stake,
          iteration: condition.iteration,
          randomizeOptions: this.config.randomizeOptionOrder,
        },
        this.llm,
        this.store,
        this.agentManager
      );

      // Generate matchings based on game type
      if (game.playersPerSession === 4) {
        const groups = generateGroups(this.agents, 4);
        for (const group of groups) {
          const groupAgents = group.players.map(id => this.agents.find(a => a.id === id)!);
          await game.runSession(this.experimentId, groupAgents, conditionIdx);
          await sleep(500); // Rate limiting
        }
      } else {
        const pairs = generatePairs(this.agents);
        for (const pair of pairs) {
          const pairAgents = [
            this.agents.find(a => a.id === pair.player1)!,
            this.agents.find(a => a.id === pair.player2)!,
          ];
          await game.runSession(this.experimentId, pairAgents, conditionIdx);
          await sleep(500); // Rate limiting
        }
      }

      // Rebalance between conditions
      const targetBalance = Math.floor(900_000 / this.agents.length);
      await this.agentManager.rebalanceAgents(this.agents, targetBalance);

      // Log progress
      const state = this.store.getExperimentState(this.experimentId);
      console.log(`  Progress: ${state?.progress.completedSessions} sessions, ${state?.progress.completedDecisions} decisions`);
    }

    const stats = this.llm.getStats();
    console.log(`\nLLM Stats:`, stats);
  }

  private async teardown(): Promise<void> {
    console.log('\n--- Phase: Teardown ---');

    // Sweep all agent balances
    const swept = await this.pool.recoverAll(this.agents);
    console.log(`Swept ${swept} sats back to operator`);

    // Reconcile
    const reconciliation = await this.pool.getReconciliation(this.agents);
    console.log('Reconciliation:', reconciliation);

    if (Math.abs(reconciliation.discrepancy) > 100) {
      console.warn(`WARNING: Balance discrepancy of ${reconciliation.discrepancy} sats`);
    }

    this.store.updateExperimentPhase(this.experimentId, 'completed');

    // Print summary
    const counts = this.store.getDecisionCounts(this.experimentId);
    console.log('\nDecision Counts:');
    for (const row of counts) {
      console.log(`  ${row.game_type} | ${row.action}: ${row.count}`);
    }

    // Print LLM cost estimate
    const llmStats = this.llm.getStats();
    console.log(`\nEstimated LLM cost: $${llmStats.estimatedCost.total}`);

    this.store.close();
    console.log('\nExperiment complete.');
  }

  private createAgentConfigs(): AgentConfig[] {
    const agents: AgentConfig[] = [];
    let agentNum = 0;

    for (const group of this.config.agents.groups) {
      for (let i = 0; i < this.config.agents.countPerGroup; i++) {
        agentNum++;
        agents.push({
          id: uuid(),
          name: `${group.model}-${group.knowledgeLevel}-${String(i + 1).padStart(2, '0')}`,
          model: group.model as ModelProvider,
          modelId: group.modelId,
          knowledgeLevel: group.knowledgeLevel as KnowledgeLevel,
        });
      }
    }

    return agents;
  }

  private generateConditionMatrix(): ConditionMatrix[] {
    const conditions: ConditionMatrix[] = [];

    for (const gameType of this.config.games) {
      for (const stake of this.config.stakes) {
        for (const iteration of this.config.iterations) {
          conditions.push({ gameType, stake, iteration });
        }
      }
    }

    // Counterbalance game order if configured
    if (this.config.counterbalanceGameOrder) {
      return shuffleArray(conditions);
    }

    return conditions;
  }
}

// --- Entry point ---

async function main(): Promise<void> {
  const configPath = process.argv.find(a => a.startsWith('--config='))?.split('=')[1]
    || process.argv[3]
    || 'experiments/pilot.yaml';

  console.log(`Loading config: ${configPath}`);
  const coordinator = new Coordinator(configPath);
  await coordinator.run();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

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
