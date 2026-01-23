"""
Descriptive statistics for game theory experiment.
Reads CSV export from the TypeScript data store.
"""

import pandas as pd
import numpy as np
import sys
from pathlib import Path


def load_data(csv_path: str) -> pd.DataFrame:
    """Load decisions CSV exported from the experiment."""
    df = pd.read_csv(csv_path)
    return df


def cooperation_rates(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate cooperation rates for Prisoner's Dilemma by condition."""
    pd_data = df[df['game_type'] == 'prisoners-dilemma'].copy()
    pd_data['cooperated'] = pd_data['action'] == 'cooperate'

    rates = pd_data.groupby(['model_provider', 'knowledge_level', 'stake']).agg(
        cooperation_rate=('cooperated', 'mean'),
        n_decisions=('cooperated', 'count'),
        se=('cooperated', lambda x: x.std() / np.sqrt(len(x)))
    ).reset_index()

    return rates


def ultimatum_offers(df: pd.DataFrame) -> pd.DataFrame:
    """Analyze Ultimatum Game offers and acceptance rates."""
    ug_data = df[df['game_type'] == 'ultimatum'].copy()

    # Extract offer amounts from proposer actions
    proposer_data = ug_data[ug_data['action'].str.startswith('offer_')].copy()
    proposer_data['offer_amount'] = proposer_data['action'].str.extract(r'offer_(\d+)').astype(float)
    proposer_data['offer_pct'] = proposer_data['offer_amount'] / (10 * proposer_data['stake'])

    offer_stats = proposer_data.groupby(['model_provider', 'knowledge_level', 'stake']).agg(
        mean_offer_pct=('offer_pct', 'mean'),
        median_offer_pct=('offer_pct', 'median'),
        std_offer_pct=('offer_pct', 'std'),
        n=('offer_pct', 'count')
    ).reset_index()

    # Acceptance rates
    responder_data = ug_data[ug_data['action'].isin(['accept', 'reject'])].copy()
    responder_data['accepted'] = responder_data['action'] == 'accept'

    acceptance_stats = responder_data.groupby(['model_provider', 'knowledge_level', 'stake']).agg(
        acceptance_rate=('accepted', 'mean'),
        n=('accepted', 'count')
    ).reset_index()

    return offer_stats, acceptance_stats


def trust_game_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Analyze Trust Game investment and return rates."""
    tg_data = df[df['game_type'] == 'trust'].copy()

    investor_data = tg_data[tg_data['action'].str.startswith('invest_')].copy()
    investor_data['investment'] = investor_data['action'].str.extract(r'invest_(\d+)').astype(float)
    investor_data['investment_pct'] = investor_data['investment'] / (10 * investor_data['stake'])

    trustee_data = tg_data[tg_data['action'].str.startswith('return_')].copy()
    trustee_data['returned'] = trustee_data['action'].str.extract(r'return_(\d+)').astype(float)

    invest_stats = investor_data.groupby(['model_provider', 'knowledge_level', 'stake']).agg(
        mean_investment_pct=('investment_pct', 'mean'),
        n=('investment_pct', 'count')
    ).reset_index()

    return invest_stats


def public_goods_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Analyze Public Goods Game contribution rates."""
    pgg_data = df[df['game_type'] == 'public-goods'].copy()
    pgg_data['contribution'] = pgg_data['action'].str.extract(r'contribute_(\d+)').astype(float)
    pgg_data['contribution_pct'] = pgg_data['contribution'] / (10 * pgg_data['stake'])

    stats = pgg_data.groupby(['model_provider', 'knowledge_level', 'stake', 'round']).agg(
        mean_contribution_pct=('contribution_pct', 'mean'),
        n=('contribution_pct', 'count')
    ).reset_index()

    return stats


def dictator_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Analyze Dictator Game giving rates."""
    dg_data = df[df['game_type'] == 'dictator'].copy()
    dg_data = dg_data[dg_data['action'].str.startswith('give_')].copy()
    dg_data['given'] = dg_data['action'].str.extract(r'give_(\d+)').astype(float)
    dg_data['giving_pct'] = dg_data['given'] / (10 * dg_data['stake'])

    stats = dg_data.groupby(['model_provider', 'knowledge_level', 'stake']).agg(
        mean_giving_pct=('giving_pct', 'mean'),
        median_giving_pct=('giving_pct', 'median'),
        n=('giving_pct', 'count')
    ).reset_index()

    return stats


def summary_table(df: pd.DataFrame) -> None:
    """Print a summary table of all games."""
    print("\n" + "=" * 80)
    print("EXPERIMENT SUMMARY")
    print("=" * 80)

    print(f"\nTotal decisions: {len(df)}")
    print(f"Unique agents: {df['agent_id'].nunique()}")
    print(f"Unique sessions: {df['session_id'].nunique()}")

    print("\nDecisions per game:")
    print(df.groupby('game_type')['action'].count().to_string())

    print("\nDecisions per model:")
    print(df.groupby('model_provider')['action'].count().to_string())

    print("\n--- Prisoner's Dilemma ---")
    coop = cooperation_rates(df)
    print(coop.to_string(index=False))

    print("\n--- Dictator Game ---")
    dg = dictator_stats(df)
    print(dg.to_string(index=False))


if __name__ == '__main__':
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'experiment_data.csv'
    if not Path(csv_path).exists():
        print(f"File not found: {csv_path}")
        print("Usage: python descriptive.py <path_to_decisions.csv>")
        sys.exit(1)

    df = load_data(csv_path)
    summary_table(df)
