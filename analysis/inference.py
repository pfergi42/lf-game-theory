"""
Statistical inference for game theory experiment.
Mixed-effects models, ANOVAs, pairwise comparisons.
"""

import pandas as pd
import numpy as np
from scipy import stats
import sys
from pathlib import Path


def load_data(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    return df


def pd_cooperation_test(df: pd.DataFrame) -> dict:
    """Test cooperation rates against Nash (0%) and human benchmarks (50%)."""
    pd_data = df[df['game_type'] == 'prisoners-dilemma'].copy()
    pd_data['cooperated'] = (pd_data['action'] == 'cooperate').astype(int)

    overall_rate = pd_data['cooperated'].mean()
    n = len(pd_data)

    # One-sample t-test vs 0 (Nash)
    t_nash, p_nash = stats.ttest_1samp(pd_data['cooperated'], 0)

    # One-sample t-test vs 0.5 (human benchmark)
    t_human, p_human = stats.ttest_1samp(pd_data['cooperated'], 0.5)

    return {
        'overall_cooperation_rate': overall_rate,
        'n': n,
        'vs_nash': {'t': t_nash, 'p': p_nash, 'sig': p_nash < 0.05},
        'vs_human_50pct': {'t': t_human, 'p': p_human, 'sig': p_human < 0.05},
    }


def stake_effect_test(df: pd.DataFrame, game_type: str = 'prisoners-dilemma') -> dict:
    """Test whether stake size affects cooperation/contribution rates."""
    game_data = df[df['game_type'] == game_type].copy()

    if game_type == 'prisoners-dilemma':
        game_data['outcome'] = (game_data['action'] == 'cooperate').astype(int)
    elif game_type == 'public-goods':
        game_data['outcome'] = game_data['action'].str.extract(r'contribute_(\d+)').astype(float)
        game_data['outcome'] = game_data['outcome'] / (10 * game_data['stake'])
    elif game_type == 'dictator':
        game_data = game_data[game_data['action'].str.startswith('give_')].copy()
        game_data['outcome'] = game_data['action'].str.extract(r'give_(\d+)').astype(float)
        game_data['outcome'] = game_data['outcome'] / (10 * game_data['stake'])
    else:
        return {'error': f'Unsupported game type for stake analysis: {game_type}'}

    groups = [g['outcome'].values for _, g in game_data.groupby('stake')]
    if len(groups) < 2:
        return {'error': 'Need at least 2 stake levels'}

    # Kruskal-Wallis (non-parametric ANOVA)
    h_stat, p_value = stats.kruskal(*groups)

    # Effect size (eta-squared approximation)
    n_total = sum(len(g) for g in groups)
    eta_sq = (h_stat - len(groups) + 1) / (n_total - len(groups))

    # Pairwise comparisons (Mann-Whitney U)
    stakes = sorted(game_data['stake'].unique())
    pairwise = []
    for i in range(len(stakes)):
        for j in range(i + 1, len(stakes)):
            g1 = game_data[game_data['stake'] == stakes[i]]['outcome']
            g2 = game_data[game_data['stake'] == stakes[j]]['outcome']
            u_stat, p = stats.mannwhitneyu(g1, g2, alternative='two-sided')
            pairwise.append({
                'stake_1': stakes[i],
                'stake_2': stakes[j],
                'u_stat': u_stat,
                'p_value': p,
                'mean_1': g1.mean(),
                'mean_2': g2.mean(),
            })

    return {
        'game_type': game_type,
        'kruskal_wallis': {'h': h_stat, 'p': p_value, 'sig': p_value < 0.05},
        'eta_squared': eta_sq,
        'pairwise': pairwise,
    }


def model_comparison_test(df: pd.DataFrame, game_type: str = 'prisoners-dilemma') -> dict:
    """Test whether model provider affects behavior."""
    game_data = df[df['game_type'] == game_type].copy()

    if game_type == 'prisoners-dilemma':
        game_data['outcome'] = (game_data['action'] == 'cooperate').astype(int)
    elif game_type == 'dictator':
        game_data = game_data[game_data['action'].str.startswith('give_')].copy()
        game_data['outcome'] = game_data['action'].str.extract(r'give_(\d+)').astype(float)
        game_data['outcome'] = game_data['outcome'] / (10 * game_data['stake'])
    else:
        game_data['outcome'] = game_data['payoff']

    claude_data = game_data[game_data['model_provider'] == 'claude']['outcome']
    openai_data = game_data[game_data['model_provider'] == 'openai']['outcome']

    if len(claude_data) == 0 or len(openai_data) == 0:
        return {'error': 'Need data from both models'}

    u_stat, p_value = stats.mannwhitneyu(claude_data, openai_data, alternative='two-sided')

    # Cohen's d effect size
    pooled_std = np.sqrt((claude_data.std()**2 + openai_data.std()**2) / 2)
    cohens_d = (claude_data.mean() - openai_data.mean()) / pooled_std if pooled_std > 0 else 0

    return {
        'game_type': game_type,
        'claude_mean': claude_data.mean(),
        'openai_mean': openai_data.mean(),
        'claude_n': len(claude_data),
        'openai_n': len(openai_data),
        'mann_whitney_u': u_stat,
        'p_value': p_value,
        'significant': p_value < 0.05,
        'cohens_d': cohens_d,
    }


def knowledge_effect_test(df: pd.DataFrame, game_type: str = 'prisoners-dilemma') -> dict:
    """Test whether knowledge level affects behavior."""
    game_data = df[df['game_type'] == game_type].copy()

    if game_type == 'prisoners-dilemma':
        game_data['outcome'] = (game_data['action'] == 'cooperate').astype(int)
    else:
        game_data['outcome'] = game_data['payoff']

    groups = {level: g['outcome'].values for level, g in game_data.groupby('knowledge_level')}
    if len(groups) < 2:
        return {'error': 'Need at least 2 knowledge levels'}

    h_stat, p_value = stats.kruskal(*groups.values())

    return {
        'game_type': game_type,
        'means': {k: v.mean() for k, v in groups.items()},
        'ns': {k: len(v) for k, v in groups.items()},
        'kruskal_wallis': {'h': h_stat, 'p': p_value, 'sig': p_value < 0.05},
    }


def learning_analysis(df: pd.DataFrame) -> dict:
    """Analyze round-by-round changes in iterated games."""
    pd_data = df[(df['game_type'] == 'prisoners-dilemma') & (df['total_rounds'] > 1)].copy()
    pd_data['cooperated'] = (pd_data['action'] == 'cooperate').astype(int)

    round_rates = pd_data.groupby('round').agg(
        cooperation_rate=('cooperated', 'mean'),
        n=('cooperated', 'count')
    ).reset_index()

    # Spearman correlation (round vs cooperation)
    if len(round_rates) > 2:
        rho, p = stats.spearmanr(round_rates['round'], round_rates['cooperation_rate'])
    else:
        rho, p = 0, 1

    return {
        'round_rates': round_rates.to_dict('records'),
        'trend': {'spearman_rho': rho, 'p_value': p, 'direction': 'increasing' if rho > 0 else 'decreasing'},
    }


def run_all_tests(df: pd.DataFrame) -> None:
    """Run all statistical tests and print results."""
    print("\n" + "=" * 80)
    print("STATISTICAL INFERENCE RESULTS")
    print("=" * 80)

    print("\n--- PD Cooperation vs Benchmarks ---")
    pd_results = pd_cooperation_test(df)
    print(f"  Overall cooperation rate: {pd_results['overall_cooperation_rate']:.3f} (n={pd_results['n']})")
    print(f"  vs Nash (0%): t={pd_results['vs_nash']['t']:.3f}, p={pd_results['vs_nash']['p']:.4f} {'*' if pd_results['vs_nash']['sig'] else ''}")
    print(f"  vs Human (50%): t={pd_results['vs_human_50pct']['t']:.3f}, p={pd_results['vs_human_50pct']['p']:.4f} {'*' if pd_results['vs_human_50pct']['sig'] else ''}")

    print("\n--- Stake Size Effect (PD) ---")
    stake_results = stake_effect_test(df, 'prisoners-dilemma')
    if 'error' not in stake_results:
        print(f"  Kruskal-Wallis: H={stake_results['kruskal_wallis']['h']:.3f}, p={stake_results['kruskal_wallis']['p']:.4f}")
        print(f"  Effect size (eta^2): {stake_results['eta_squared']:.4f}")

    print("\n--- Model Comparison (PD) ---")
    model_results = model_comparison_test(df, 'prisoners-dilemma')
    if 'error' not in model_results:
        print(f"  Claude mean: {model_results['claude_mean']:.3f}, OpenAI mean: {model_results['openai_mean']:.3f}")
        print(f"  Mann-Whitney U: {model_results['mann_whitney_u']:.1f}, p={model_results['p_value']:.4f}")
        print(f"  Cohen's d: {model_results['cohens_d']:.3f}")

    print("\n--- Knowledge Level Effect (PD) ---")
    knowledge_results = knowledge_effect_test(df, 'prisoners-dilemma')
    if 'error' not in knowledge_results:
        print(f"  Means: {knowledge_results['means']}")
        print(f"  Kruskal-Wallis: H={knowledge_results['kruskal_wallis']['h']:.3f}, p={knowledge_results['kruskal_wallis']['p']:.4f}")

    print("\n--- Learning Analysis (Iterated PD) ---")
    learning = learning_analysis(df)
    print(f"  Trend: {learning['trend']['direction']} (rho={learning['trend']['spearman_rho']:.3f}, p={learning['trend']['p_value']:.4f})")


if __name__ == '__main__':
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'experiment_data.csv'
    if not Path(csv_path).exists():
        print(f"File not found: {csv_path}")
        sys.exit(1)

    df = load_data(csv_path)
    run_all_tests(df)
