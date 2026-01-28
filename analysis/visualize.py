#!/usr/bin/env python3
"""
Visualization script for AI Economic Arena experiments.
Generates publication-ready figures comparing Condition A (neutral baseline)
vs Condition B (mixed priming).
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from pathlib import Path

# Set style for publication
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 10
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['figure.dpi'] = 150

# Colors for priming conditions
PRIMING_COLORS = {
    'neutral': '#6b7280',      # gray
    'competitive': '#dc2626',  # red
    'cooperative': '#16a34a',  # green
    'strategic': '#2563eb',    # blue
}

MODEL_MARKERS = {
    'claude': 'o',
    'openai': 's',
}

OUTPUT_DIR = Path('figures')
OUTPUT_DIR.mkdir(exist_ok=True)


def load_data():
    """Load all experiment data."""
    bal_a = pd.read_csv('data/condition_a_balances.csv')
    bal_b = pd.read_csv('data/condition_b_balances.csv')
    trans_a = pd.read_csv('data/condition_a_transfers.csv')
    trans_b = pd.read_csv('data/condition_b_transfers.csv')
    return bal_a, bal_b, trans_a, trans_b


def calculate_gini(balances):
    """Calculate Gini coefficient for a list of balances."""
    balances = np.array(sorted(balances))
    n = len(balances)
    if n == 0 or balances.sum() == 0:
        return 0
    cumsum = np.cumsum(balances)
    return (n + 1 - 2 * np.sum(cumsum) / cumsum[-1]) / n


def plot_balance_trajectories(bal_a, bal_b):
    """Plot balance over time for both conditions, side by side."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5), sharey=True)

    # Condition A (all neutral)
    ax = axes[0]
    for agent in bal_a['agent_name'].unique():
        agent_data = bal_a[bal_a['agent_name'] == agent]
        ax.plot(agent_data['round'], agent_data['balance'],
                color=PRIMING_COLORS['neutral'], alpha=0.6, linewidth=1)
    ax.axhline(y=1000, color='black', linestyle='--', alpha=0.3, label='Starting balance')
    ax.set_xlabel('Round')
    ax.set_ylabel('Balance (sats)')
    ax.set_title('Condition A: All Neutral Priming')
    ax.set_xlim(0, 100)

    # Condition B (mixed priming)
    ax = axes[1]
    for agent in bal_b['agent_name'].unique():
        agent_data = bal_b[bal_b['agent_name'] == agent]
        priming = agent_data['priming'].iloc[0]
        ax.plot(agent_data['round'], agent_data['balance'],
                color=PRIMING_COLORS.get(priming, '#999'),
                alpha=0.7, linewidth=1.5)
    ax.axhline(y=1000, color='black', linestyle='--', alpha=0.3)
    ax.set_xlabel('Round')
    ax.set_title('Condition B: Mixed Priming')
    ax.set_xlim(0, 100)

    # Legend for Condition B
    patches = [mpatches.Patch(color=c, label=p.title())
               for p, c in PRIMING_COLORS.items()]
    ax.legend(handles=patches, loc='upper left')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / 'balance_trajectories.png', bbox_inches='tight')
    plt.savefig(OUTPUT_DIR / 'balance_trajectories.pdf', bbox_inches='tight')
    print('Saved: balance_trajectories.png/pdf')
    plt.close()


def plot_gini_over_time(bal_a, bal_b):
    """Plot Gini coefficient over rounds for both conditions."""
    gini_a = []
    gini_b = []

    for r in range(101):
        balances_a = bal_a[bal_a['round'] == r]['balance'].values
        balances_b = bal_b[bal_b['round'] == r]['balance'].values
        gini_a.append(calculate_gini(balances_a))
        gini_b.append(calculate_gini(balances_b))

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(range(101), gini_a, label='Condition A (All Neutral)',
            color='#6b7280', linewidth=2)
    ax.plot(range(101), gini_b, label='Condition B (Mixed Priming)',
            color='#dc2626', linewidth=2)
    ax.set_xlabel('Round')
    ax.set_ylabel('Gini Coefficient')
    ax.set_title('Wealth Inequality Over Time')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 0.6)
    ax.legend()
    ax.axhline(y=0, color='black', linestyle='-', alpha=0.2)

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / 'gini_over_time.png', bbox_inches='tight')
    plt.savefig(OUTPUT_DIR / 'gini_over_time.pdf', bbox_inches='tight')
    print('Saved: gini_over_time.png/pdf')
    plt.close()


def plot_final_balance_by_priming(bal_b):
    """Bar chart of average final balance by priming condition."""
    final = bal_b[bal_b['round'] == 100].copy()

    # Calculate means and std by priming
    stats = final.groupby('priming')['balance'].agg(['mean', 'std']).reset_index()
    stats = stats.sort_values('mean', ascending=False)

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(stats['priming'].str.title(), stats['mean'],
                  yerr=stats['std'], capsize=5,
                  color=[PRIMING_COLORS[p] for p in stats['priming']],
                  edgecolor='black', linewidth=0.5)

    ax.axhline(y=1000, color='black', linestyle='--', alpha=0.5,
               label='Starting balance')
    ax.set_ylabel('Final Balance (sats)')
    ax.set_title('Average Final Balance by Priming Condition')
    ax.legend()

    # Add value labels on bars
    for bar, val in zip(bars, stats['mean']):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 50,
                f'{val:.0f}', ha='center', va='bottom', fontsize=10)

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / 'final_balance_by_priming.png', bbox_inches='tight')
    plt.savefig(OUTPUT_DIR / 'final_balance_by_priming.pdf', bbox_inches='tight')
    print('Saved: final_balance_by_priming.png/pdf')
    plt.close()


def plot_transfer_flow_matrix(trans_b):
    """Heatmap of transfer volume between priming conditions."""
    # Aggregate transfers by priming pair
    flow = trans_b.groupby(['from_priming', 'to_priming'])['amount'].sum().reset_index()

    # Create matrix
    primings = ['competitive', 'strategic', 'neutral', 'cooperative']
    matrix = np.zeros((4, 4))
    for _, row in flow.iterrows():
        if row['from_priming'] in primings and row['to_priming'] in primings:
            i = primings.index(row['from_priming'])
            j = primings.index(row['to_priming'])
            matrix[i, j] = row['amount']

    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(matrix, cmap='YlOrRd')

    # Labels
    ax.set_xticks(range(4))
    ax.set_yticks(range(4))
    ax.set_xticklabels([p.title() for p in primings])
    ax.set_yticklabels([p.title() for p in primings])
    ax.set_xlabel('To (Recipient)')
    ax.set_ylabel('From (Sender)')
    ax.set_title('Transfer Volume by Priming Condition (sats)')

    # Add text annotations
    for i in range(4):
        for j in range(4):
            val = matrix[i, j]
            color = 'white' if val > matrix.max() * 0.6 else 'black'
            ax.text(j, i, f'{val:.0f}', ha='center', va='center', color=color)

    plt.colorbar(im, ax=ax, label='Total sats transferred')
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / 'transfer_flow_matrix.png', bbox_inches='tight')
    plt.savefig(OUTPUT_DIR / 'transfer_flow_matrix.pdf', bbox_inches='tight')
    print('Saved: transfer_flow_matrix.png/pdf')
    plt.close()


def plot_model_comparison(bal_b):
    """Compare Claude vs GPT performance by priming condition."""
    final = bal_b[bal_b['round'] == 100].copy()
    final['delta'] = final['balance'] - 1000

    # Group by model and priming
    stats = final.groupby(['model', 'priming'])['delta'].mean().unstack(fill_value=0)

    fig, ax = plt.subplots(figsize=(10, 5))
    x = np.arange(len(stats.columns))
    width = 0.35

    bars1 = ax.bar(x - width/2, stats.loc['claude'], width, label='Claude',
                   color='#7c3aed', edgecolor='black', linewidth=0.5)
    bars2 = ax.bar(x + width/2, stats.loc['openai'], width, label='GPT-4o',
                   color='#10b981', edgecolor='black', linewidth=0.5)

    ax.set_ylabel('Average Balance Change (sats)')
    ax.set_title('Performance by Model and Priming Condition')
    ax.set_xticks(x)
    ax.set_xticklabels([p.title() for p in stats.columns])
    ax.legend()
    ax.axhline(y=0, color='black', linestyle='-', alpha=0.3)

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / 'model_comparison.png', bbox_inches='tight')
    plt.savefig(OUTPUT_DIR / 'model_comparison.pdf', bbox_inches='tight')
    print('Saved: model_comparison.png/pdf')
    plt.close()


def plot_transfer_volume_over_time(trans_a, trans_b):
    """Line chart of transfer volume per round."""
    vol_a = trans_a.groupby('round')['amount'].sum()
    vol_b = trans_b.groupby('round')['amount'].sum()

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(vol_a.index, vol_a.values, label='Condition A',
            color='#6b7280', linewidth=1.5, alpha=0.8)
    ax.plot(vol_b.index, vol_b.values, label='Condition B',
            color='#dc2626', linewidth=1.5, alpha=0.8)

    ax.set_xlabel('Round')
    ax.set_ylabel('Total Transfer Volume (sats)')
    ax.set_title('Economic Activity Over Time')
    ax.legend()
    ax.set_xlim(0, 100)

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / 'transfer_volume.png', bbox_inches='tight')
    plt.savefig(OUTPUT_DIR / 'transfer_volume.pdf', bbox_inches='tight')
    print('Saved: transfer_volume.png/pdf')
    plt.close()


def generate_summary_stats(bal_a, bal_b, trans_a, trans_b):
    """Generate summary statistics table."""
    final_a = bal_a[bal_a['round'] == 100]['balance']
    final_b = bal_b[bal_b['round'] == 100]['balance']

    stats = {
        'Metric': [
            'Agents',
            'Rounds',
            'Starting Balance',
            'Final Gini Coefficient',
            'Total Transfers',
            'Total Volume (sats)',
            'Eliminations',
            'Max Final Balance',
            'Min Final Balance',
            'Std Dev of Final Balance',
        ],
        'Condition A': [
            16,
            100,
            1000,
            f'{calculate_gini(final_a.values):.4f}',
            len(trans_a),
            trans_a['amount'].sum(),
            (final_a == 0).sum(),
            final_a.max(),
            final_a.min(),
            f'{final_a.std():.1f}',
        ],
        'Condition B': [
            16,
            100,
            1000,
            f'{calculate_gini(final_b.values):.4f}',
            len(trans_b),
            trans_b['amount'].sum(),
            (final_b == 0).sum(),
            final_b.max(),
            final_b.min(),
            f'{final_b.std():.1f}',
        ],
    }

    df = pd.DataFrame(stats)
    df.to_csv(OUTPUT_DIR / 'summary_stats.csv', index=False)
    print('Saved: summary_stats.csv')
    print('\n' + df.to_string(index=False))
    return df


def main():
    print('Loading data...')
    bal_a, bal_b, trans_a, trans_b = load_data()

    print(f'Condition A: {len(bal_a)} balance records, {len(trans_a)} transfers')
    print(f'Condition B: {len(bal_b)} balance records, {len(trans_b)} transfers')

    print('\nGenerating figures...')
    plot_balance_trajectories(bal_a, bal_b)
    plot_gini_over_time(bal_a, bal_b)
    plot_final_balance_by_priming(bal_b)
    plot_transfer_flow_matrix(trans_b)
    plot_model_comparison(bal_b)
    plot_transfer_volume_over_time(trans_a, trans_b)

    print('\nGenerating summary statistics...')
    generate_summary_stats(bal_a, bal_b, trans_a, trans_b)

    print('\nDone! All figures saved to figures/')


if __name__ == '__main__':
    main()
