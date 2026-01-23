"""
Publication-quality figures for game theory experiment.
Generates the 6 key figures outlined in the research plan.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import sys
from pathlib import Path

# Style settings for publication
plt.rcParams.update({
    'font.size': 11,
    'font.family': 'serif',
    'axes.labelsize': 12,
    'axes.titlesize': 13,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 10,
    'figure.dpi': 150,
    'savefig.dpi': 300,
    'savefig.bbox': 'tight',
})

CLAUDE_COLOR = '#D97706'  # Orange
OPENAI_COLOR = '#7C3AED'  # Purple
HUMAN_COLOR = '#6B7280'   # Gray


def load_data(csv_path: str) -> pd.DataFrame:
    return pd.read_csv(csv_path)


def fig1_cooperation_heatmap(df: pd.DataFrame, output_dir: str) -> None:
    """Figure 1: Cooperation heatmap - Models x Games."""
    games = ['prisoners-dilemma', 'public-goods', 'dictator', 'trust', 'ultimatum']
    game_labels = ['Prisoner\'s\nDilemma', 'Public\nGoods', 'Dictator', 'Trust', 'Ultimatum']
    models = ['claude', 'openai']
    model_labels = ['Claude 4.5', 'GPT-5.2']

    # Calculate "prosocial" rate per game per model
    data = np.zeros((len(models), len(games)))
    for i, model in enumerate(models):
        for j, game in enumerate(games):
            subset = df[(df['model_provider'] == model) & (df['game_type'] == game)]
            if game == 'prisoners-dilemma':
                rate = (subset['action'] == 'cooperate').mean()
            elif game == 'public-goods':
                contribs = subset['action'].str.extract(r'contribute_(\d+)').astype(float)
                rate = (contribs / (10 * subset['stake'].values.reshape(-1, 1))).mean().iloc[0] if len(contribs) > 0 else 0
            elif game == 'dictator':
                gives = subset[subset['action'].str.startswith('give_')]
                if len(gives) > 0:
                    amounts = gives['action'].str.extract(r'give_(\d+)').astype(float)
                    rate = (amounts / (10 * gives['stake'].values.reshape(-1, 1))).mean().iloc[0]
                else:
                    rate = 0
            elif game == 'trust':
                invests = subset[subset['action'].str.startswith('invest_')]
                if len(invests) > 0:
                    amounts = invests['action'].str.extract(r'invest_(\d+)').astype(float)
                    rate = (amounts / (10 * invests['stake'].values.reshape(-1, 1))).mean().iloc[0]
                else:
                    rate = 0
            elif game == 'ultimatum':
                offers = subset[subset['action'].str.startswith('offer_')]
                if len(offers) > 0:
                    amounts = offers['action'].str.extract(r'offer_(\d+)').astype(float)
                    rate = (amounts / (10 * offers['stake'].values.reshape(-1, 1))).mean().iloc[0]
                else:
                    rate = 0
            data[i, j] = rate if not np.isnan(rate) else 0

    fig, ax = plt.subplots(figsize=(8, 3.5))
    im = ax.imshow(data, cmap='RdYlGn', vmin=0, vmax=1, aspect='auto')

    ax.set_xticks(range(len(games)))
    ax.set_xticklabels(game_labels)
    ax.set_yticks(range(len(models)))
    ax.set_yticklabels(model_labels)

    # Add text annotations
    for i in range(len(models)):
        for j in range(len(games)):
            text = f'{data[i, j]:.2f}'
            color = 'white' if data[i, j] < 0.3 or data[i, j] > 0.7 else 'black'
            ax.text(j, i, text, ha='center', va='center', color=color, fontweight='bold')

    plt.colorbar(im, ax=ax, label='Prosocial Rate', shrink=0.8)
    ax.set_title('Prosocial Behavior by Model and Game')
    plt.savefig(f'{output_dir}/fig1_cooperation_heatmap.png')
    plt.close()
    print('  Generated fig1_cooperation_heatmap.png')


def fig2_stake_sensitivity(df: pd.DataFrame, output_dir: str) -> None:
    """Figure 2: Stake sensitivity curves."""
    pd_data = df[df['game_type'] == 'prisoners-dilemma'].copy()
    pd_data['cooperated'] = (pd_data['action'] == 'cooperate').astype(int)

    fig, ax = plt.subplots(figsize=(7, 5))

    for model, color, label in [('claude', CLAUDE_COLOR, 'Claude 4.5'), ('openai', OPENAI_COLOR, 'GPT-5.2')]:
        model_data = pd_data[pd_data['model_provider'] == model]
        rates = model_data.groupby('stake')['cooperated'].agg(['mean', 'sem']).reset_index()
        ax.errorbar(rates['stake'], rates['mean'], yerr=1.96*rates['sem'],
                    color=color, marker='o', linewidth=2, capsize=4, label=label)

    ax.axhline(y=0.5, color=HUMAN_COLOR, linestyle='--', alpha=0.7, label='Human benchmark (~50%)')
    ax.axhline(y=0, color='red', linestyle=':', alpha=0.5, label='Nash equilibrium (0%)')

    ax.set_xscale('log')
    ax.set_xlabel('Stake Size (sats)')
    ax.set_ylabel('Cooperation Rate')
    ax.set_title('PD Cooperation Rate by Stake Size')
    ax.set_ylim(-0.05, 1.05)
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.savefig(f'{output_dir}/fig2_stake_sensitivity.png')
    plt.close()
    print('  Generated fig2_stake_sensitivity.png')


def fig3_learning_trajectories(df: pd.DataFrame, output_dir: str) -> None:
    """Figure 3: Round-by-round cooperation in iterated PD."""
    iterated = df[(df['game_type'] == 'prisoners-dilemma') & (df['total_rounds'] > 1)].copy()
    iterated['cooperated'] = (iterated['action'] == 'cooperate').astype(int)

    fig, ax = plt.subplots(figsize=(8, 5))

    for model, color, label in [('claude', CLAUDE_COLOR, 'Claude 4.5'), ('openai', OPENAI_COLOR, 'GPT-5.2')]:
        model_data = iterated[iterated['model_provider'] == model]
        round_rates = model_data.groupby('round')['cooperated'].agg(['mean', 'sem']).reset_index()
        ax.plot(round_rates['round'], round_rates['mean'], color=color, linewidth=2, label=label)
        ax.fill_between(round_rates['round'],
                        round_rates['mean'] - 1.96 * round_rates['sem'],
                        round_rates['mean'] + 1.96 * round_rates['sem'],
                        color=color, alpha=0.15)

    ax.set_xlabel('Round')
    ax.set_ylabel('Cooperation Rate')
    ax.set_title('Cooperation Rate Over Rounds (Iterated PD)')
    ax.set_ylim(-0.05, 1.05)
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.savefig(f'{output_dir}/fig3_learning_trajectories.png')
    plt.close()
    print('  Generated fig3_learning_trajectories.png')


def fig4_ultimatum_distributions(df: pd.DataFrame, output_dir: str) -> None:
    """Figure 4: Ultimatum Game offer distributions vs human benchmark."""
    ug_data = df[df['game_type'] == 'ultimatum'].copy()
    proposer_data = ug_data[ug_data['action'].str.startswith('offer_')].copy()
    proposer_data['offer_pct'] = proposer_data['action'].str.extract(r'offer_(\d+)').astype(float) / (10 * proposer_data['stake'])

    fig, axes = plt.subplots(1, 2, figsize=(10, 4), sharey=True)

    for ax, (model, color, label) in zip(axes, [('claude', CLAUDE_COLOR, 'Claude 4.5'), ('openai', OPENAI_COLOR, 'GPT-5.2')]):
        model_offers = proposer_data[proposer_data['model_provider'] == model]['offer_pct']
        if len(model_offers) > 0:
            ax.hist(model_offers, bins=np.arange(0, 1.05, 0.1), color=color, alpha=0.7, edgecolor='white')
            ax.axvline(x=model_offers.mean(), color=color, linestyle='-', linewidth=2, label=f'Mean: {model_offers.mean():.2f}')
        ax.axvline(x=0.4, color=HUMAN_COLOR, linestyle='--', linewidth=2, label='Human mean (~40%)')
        ax.set_xlabel('Offer (fraction of pot)')
        ax.set_title(label)
        ax.legend(fontsize=9)
        ax.set_xlim(0, 1)

    axes[0].set_ylabel('Count')
    fig.suptitle('Ultimatum Game Offer Distributions', fontsize=13)
    plt.tight_layout()
    plt.savefig(f'{output_dir}/fig4_ultimatum_distributions.png')
    plt.close()
    print('  Generated fig4_ultimatum_distributions.png')


def fig5_trust_scatter(df: pd.DataFrame, output_dir: str) -> None:
    """Figure 5: Trust Game investment vs return scatter."""
    tg_data = df[df['game_type'] == 'trust'].copy()

    fig, ax = plt.subplots(figsize=(7, 6))

    for model, color, label in [('claude', CLAUDE_COLOR, 'Claude 4.5'), ('openai', OPENAI_COLOR, 'GPT-5.2')]:
        model_data = tg_data[tg_data['model_provider'] == model]
        investments = model_data[model_data['action'].str.startswith('invest_')].copy()
        investments['amount'] = investments['action'].str.extract(r'invest_(\d+)').astype(float)
        investments['pct'] = investments['amount'] / (10 * investments['stake'])

        returns = model_data[model_data['action'].str.startswith('return_')].copy()
        returns['amount'] = returns['action'].str.extract(r'return_(\d+)').astype(float)

        # Match by session
        if len(investments) > 0 and len(returns) > 0:
            ax.scatter(investments['pct'].values[:len(returns)],
                       returns['amount'].values[:len(investments)] if len(returns) >= len(investments) else returns['amount'].values,
                       color=color, alpha=0.5, label=label, s=40)

    ax.set_xlabel('Investment (fraction of endowment)')
    ax.set_ylabel('Amount Returned (sats)')
    ax.set_title('Trust Game: Investment vs. Return')
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.savefig(f'{output_dir}/fig5_trust_scatter.png')
    plt.close()
    print('  Generated fig5_trust_scatter.png')


def fig6_pgg_decay(df: pd.DataFrame, output_dir: str) -> None:
    """Figure 6: Public Goods Game contribution decay."""
    pgg_data = df[(df['game_type'] == 'public-goods') & (df['total_rounds'] > 1)].copy()
    pgg_data['contribution'] = pgg_data['action'].str.extract(r'contribute_(\d+)').astype(float)
    pgg_data['contribution_pct'] = pgg_data['contribution'] / (10 * pgg_data['stake'])

    fig, ax = plt.subplots(figsize=(8, 5))

    for model, color, label in [('claude', CLAUDE_COLOR, 'Claude 4.5'), ('openai', OPENAI_COLOR, 'GPT-5.2')]:
        model_data = pgg_data[pgg_data['model_provider'] == model]
        round_rates = model_data.groupby('round')['contribution_pct'].agg(['mean', 'sem']).reset_index()
        ax.plot(round_rates['round'], round_rates['mean'], color=color, linewidth=2, label=label)
        ax.fill_between(round_rates['round'],
                        round_rates['mean'] - 1.96 * round_rates['sem'],
                        round_rates['mean'] + 1.96 * round_rates['sem'],
                        color=color, alpha=0.15)

    ax.axhline(y=0.5, color=HUMAN_COLOR, linestyle='--', alpha=0.7, label='Human initial (~50%)')
    ax.set_xlabel('Round')
    ax.set_ylabel('Contribution Rate')
    ax.set_title('Public Goods Contribution Over Rounds')
    ax.set_ylim(-0.05, 1.05)
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.savefig(f'{output_dir}/fig6_pgg_decay.png')
    plt.close()
    print('  Generated fig6_pgg_decay.png')


def generate_all_figures(csv_path: str, output_dir: str = 'figures') -> None:
    """Generate all 6 publication figures."""
    Path(output_dir).mkdir(exist_ok=True)
    df = load_data(csv_path)

    print(f'\nGenerating figures from {len(df)} decisions...')
    fig1_cooperation_heatmap(df, output_dir)
    fig2_stake_sensitivity(df, output_dir)
    fig3_learning_trajectories(df, output_dir)
    fig4_ultimatum_distributions(df, output_dir)
    fig5_trust_scatter(df, output_dir)
    fig6_pgg_decay(df, output_dir)
    print(f'\nAll figures saved to {output_dir}/')


if __name__ == '__main__':
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'experiment_data.csv'
    output_dir = sys.argv[2] if len(sys.argv) > 2 else 'figures'

    if not Path(csv_path).exists():
        print(f"File not found: {csv_path}")
        sys.exit(1)

    generate_all_figures(csv_path, output_dir)
