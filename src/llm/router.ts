import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { LLMRequest, LLMResponse, ModelProvider } from '../types.js';

export class LLMRouter {
  private claude: Anthropic;
  private openai: OpenAI;
  private callCount = { claude: 0, openai: 0 };
  private tokenCount = { claude: { input: 0, output: 0 }, openai: { input: 0, output: 0 } };

  constructor() {
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async query(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      if (request.model === 'claude') {
        return await this.queryClaude(request, startTime);
      } else {
        return await this.queryOpenAI(request, startTime);
      }
    } catch (err) {
      // Retry once with exponential backoff
      await sleep(2000);
      if (request.model === 'claude') {
        return await this.queryClaude(request, Date.now());
      } else {
        return await this.queryOpenAI(request, Date.now());
      }
    }
  }

  private async queryClaude(request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: request.prompt },
    ];

    const response = await this.claude.messages.create({
      model: request.modelId,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: request.systemPrompt || undefined,
      messages,
    });

    const responseTimeMs = Date.now() - startTime;
    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.TextBlock).text)
      .join('');

    const tokensUsed = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    };

    this.callCount.claude++;
    this.tokenCount.claude.input += tokensUsed.input;
    this.tokenCount.claude.output += tokensUsed.output;

    return {
      content,
      model: response.model,
      tokensUsed,
      responseTimeMs,
      finishReason: response.stop_reason || 'unknown',
    };
  }

  private async queryOpenAI(request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const response = await this.openai.chat.completions.create({
      model: request.modelId,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages,
    });

    const responseTimeMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';

    const tokensUsed = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
    };

    this.callCount.openai++;
    this.tokenCount.openai.input += tokensUsed.input;
    this.tokenCount.openai.output += tokensUsed.output;

    return {
      content,
      model: response.model,
      tokensUsed,
      responseTimeMs,
      finishReason: response.choices[0]?.finish_reason || 'unknown',
    };
  }

  getStats(): {
    calls: Record<ModelProvider, number>;
    tokens: Record<ModelProvider, { input: number; output: number }>;
    estimatedCost: { claude: number; openai: number; total: number };
  } {
    // Rough cost estimates (per million tokens)
    const claudeInputCost = 3.0; // $/M tokens for Sonnet
    const claudeOutputCost = 15.0;
    const openaiInputCost = 2.5; // $/M tokens for GPT-4.1
    const openaiOutputCost = 10.0;

    const claudeCost =
      (this.tokenCount.claude.input / 1_000_000) * claudeInputCost +
      (this.tokenCount.claude.output / 1_000_000) * claudeOutputCost;
    const openaiCost =
      (this.tokenCount.openai.input / 1_000_000) * openaiInputCost +
      (this.tokenCount.openai.output / 1_000_000) * openaiOutputCost;

    return {
      calls: this.callCount,
      tokens: this.tokenCount,
      estimatedCost: {
        claude: Math.round(claudeCost * 100) / 100,
        openai: Math.round(openaiCost * 100) / 100,
        total: Math.round((claudeCost + openaiCost) * 100) / 100,
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
