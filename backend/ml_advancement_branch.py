from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.linear_model import LogisticRegression
import numpy as np
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler

from progressionAnalysis import _normalized_timeline_dataframe, load_advancements


def save_confusion_matrix_png(
    cm: Any,
    display_labels: list[str],
    out_path: Path,
    *,
    title: str = "Test set: true vs predicted advancement branch",
) -> None:
    """Write a confusion matrix (rows = true label, columns = predicted)."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    n = len(display_labels)
    fig, ax = plt.subplots(figsize=(max(6.0, n * 1.15), max(5.0, n * 1.0)))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=display_labels)
    disp.plot(ax=ax, cmap="Blues", values_format="d", colorbar=False)
    ax.set_title(title, fontsize=11)
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
    fig.colorbar(disp.im_, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def coarse_category(advancement: str) -> str:
    """First segment of advancement id (e.g. story/mine_stone -> story)."""
    adv = (advancement or "").strip().lower()
    if not adv or adv == "unknown":
        return "other"
    if "/" in adv:
        return adv.split("/")[0]
    return "other"


def build_event_table(raw_df: pd.DataFrame) -> pd.DataFrame:
    """One row per criterion unlock, sorted by time, drop invalid timestamps."""
    df = _normalized_timeline_dataframe(raw_df)
    if df.empty:
        return df
    
    return df.sort_values(by=["timestamp", "advancement", "criterion"], kind="mergesort").reset_index(drop=True)


def build_supervised_frame(df: pd.DataFrame) -> pd.DataFrame:
    """
    Each row: features computed from all events before this unlock,
    label = coarse_category(advancement) of this unlock.
    """
    rows: list[dict[str, Any]] = []
    n = len(df)
    for i in range(1, n):
        prev = df.iloc[:i]
        cur = df.iloc[i]
        adv = str(cur.get("advancement", "") or "")
        label = coarse_category(adv)
        t_prev = prev["timestamp"].iloc[-1]
        t_cur = cur["timestamp"]
        t0 = df["timestamp"].iloc[0]
        hours_from_start_prev = max((t_prev - t0).total_seconds() / 3600.0, 0.0)
        delta_hours = max((t_cur - t_prev).total_seconds() / 3600.0, 0.0)
        pa = prev["advancement"].fillna("").str.lower()
        known_prefix = (
            pa.str.startswith("story/")
            | pa.str.startswith("nether/")
            | pa.str.startswith("end/")
            | pa.str.startswith("adventure/")
            | pa.str.startswith("husbandry/")
            | pa.str.startswith("recipes/")
        )
        rows.append(
            {
                "label": label,
                "n_distinct_advancements": prev["advancement"].nunique(),
                "cnt_story": int(pa.str.startswith("story/").sum()),
                "cnt_nether": int(pa.str.startswith("nether/").sum()),
                "cnt_end": int(pa.str.startswith("end/").sum()),
                "cnt_adventure": int(pa.str.startswith("adventure/").sum()),
                "cnt_husbandry": int(pa.str.startswith("husbandry/").sum()),
                "cnt_recipes": int(pa.str.startswith("recipes/").sum()),
                "cnt_other_prefix": int((~known_prefix).sum()),
                "hours_from_start_prev": hours_from_start_prev,
                "delta_hours_since_prev": delta_hours,
            }
        )
    return pd.DataFrame(rows)


def merge_rare_labels(series: pd.Series, min_count: int = 3) -> pd.Series:
    counts = series.value_counts()
    rare = counts[counts < min_count].index
    return series.where(~series.isin(rare), other="other")


def compute_advancement_ml_metrics(
    events: pd.DataFrame,
    *,
    train_fraction: float = 0.8,
    min_rows: int = 15,
    rare_label_min: int = 3,
) -> dict[str, Any]:
    """
    Train/test on chronological advancement-derived rows. Raises ValueError if
    there is not enough data.
    """
    if len(events) < min_rows:
        raise ValueError(
            f"Need at least {min_rows} dated advancement events after cleaning; got {len(events)}."
        )

    supervised = build_supervised_frame(events)
    supervised["label"] = merge_rare_labels(supervised["label"], min_count=rare_label_min)

    feature_cols = [c for c in supervised.columns if c != "label"]
    X = supervised[feature_cols].astype(float)
    y = supervised["label"]

    split_idx = max(int(len(supervised) * train_fraction), 1)
    split_idx = min(split_idx, len(supervised) - 1)

    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    train_classes = set(y_train.unique())
    mask = y_test.isin(train_classes)
    dropped = int((~mask).sum())
    X_test, y_test = X_test[mask], y_test[mask]

    if len(X_test) == 0:
        raise ValueError("No test rows left after filtering to labels seen in training.")

    le = LabelEncoder()
    y_train_e = le.fit_transform(y_train)
    y_test_e = le.transform(y_test)

    clf = make_pipeline(
        StandardScaler(),
        LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            solver="lbfgs",
        ),
    )
    clf.fit(X_train, y_train_e)
    pred = clf.predict(X_test)

    acc = float(accuracy_score(y_test_e, pred))
    report = classification_report(
        y_test_e, pred, target_names=le.classes_, zero_division=0
    )
    label_list = list(le.classes_)
    label_idx = list(range(len(label_list)))
    cm = confusion_matrix(y_test_e, pred, labels=label_idx)

    prec, rec, f1, sup = precision_recall_fscore_support(
        y_test_e, pred, labels=label_idx, zero_division=0
    )
    macro_p, macro_r, macro_f, _ = precision_recall_fscore_support(
        y_test_e, pred, average="macro", zero_division=0
    )

    per_class = [
        {
            "label": label_list[i],
            "precision": float(prec[i]),
            "recall": float(rec[i]),
            "f1": float(f1[i]),
            "support": int(sup[i]),
        }
        for i in range(len(label_list))
    ]

    return {
        "n_events": len(events),
        "n_supervised_rows": len(supervised),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "dropped_test_unseen_label": dropped,
        "accuracy": acc,
        "precision_macro": float(macro_p),
        "recall_macro": float(macro_r),
        "f1_macro": float(macro_f),
        "classification_report": report,
        "confusion_matrix": [[int(x) for x in row] for row in cm],
        "label_names": label_list,
        "feature_names": feature_cols,
        "per_class": per_class,
    }


def advancement_branch_ml_for_api(file_obj: Any) -> dict[str, Any]:
    """JSON-safe payload for FastAPI."""
    try:
        raw = load_advancements(file_obj)
        events = build_event_table(raw)
        metrics = compute_advancement_ml_metrics(events)
    except ValueError as exc:
        return {"ok": False, "reason": str(exc)}
    out = {
        k: v
        for k, v in metrics.items()
        if k not in ("classification_report", "feature_names")
    }
    return {"ok": True, **out}


def run_experiment(
    advancements_path: Path,
    *,
    train_fraction: float = 0.8,
    min_rows: int = 15,
    rare_label_min: int = 3,
    cm_png_out: Path | None = None,
    save_cm_png: bool = True,
) -> dict[str, Any]:
    with advancements_path.open(encoding="utf-8") as f:
        raw = load_advancements(f)

    events = build_event_table(raw)
    metrics = compute_advancement_ml_metrics(
        events,
        train_fraction=train_fraction,
        min_rows=min_rows,
        rare_label_min=rare_label_min,
    )

    label_list = metrics["label_names"]
    cm_arr = np.asarray(metrics["confusion_matrix"])
    cm_png_path: str | None = None
    if save_cm_png:
        png = cm_png_out or (advancements_path.parent / f"{advancements_path.stem}.confusion_matrix.png")
        save_confusion_matrix_png(cm_arr, label_list, png)
        cm_png_path = str(png.resolve())

    return {
        **metrics,
        "confusion_matrix": cm_arr,
        "confusion_matrix_png": cm_png_path,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Train/evaluate advancement-branch classifier (see module docstring)."
    )
    parser.add_argument(
        "advancements_json",
        type=Path,
        help="Path to Minecraft player advancements .json",
    )
    parser.add_argument(
        "--train-fraction",
        type=float,
        default=0.8,
        help="Fraction of chronological rows for training (default 0.8)",
    )
    parser.add_argument(
        "--cm-png",
        type=Path,
        default=None,
        help="Where to save confusion matrix PNG (default: <json_stem>.confusion_matrix.png)",
    )
    parser.add_argument(
        "--no-cm-png",
        action="store_true",
        help="Do not write confusion matrix PNG",
    )
    args = parser.parse_args()

    path = args.advancements_json
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    try:
        result = run_experiment(
            path,
            train_fraction=args.train_fraction,
            cm_png_out=args.cm_png,
            save_cm_png=not args.no_cm_png,
        )
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1

    print("\n=== Advancement branch experiment ===\n")
    print(
        "Choice: predict the coarse branch (first path segment) of each unlock\n"
        "using only prior progression features; time-ordered train/test split.\n"
    )
    print(f"Events (after cleaning): {result['n_events']}")
    print(f"Supervised rows:         {result['n_supervised_rows']}")
    print(f"Train / test:            {result['n_train']} / {result['n_test']}")
    if result["dropped_test_unseen_label"]:
        print(f"Test rows dropped (label never in train): {result['dropped_test_unseen_label']}")
    print(f"\nTest accuracy: {result['accuracy']:.4f}")
    print("\nClassification report (test):\n")
    print(result["classification_report"])
    print("Confusion matrix (rows=true, cols=predicted):")
    print(result["label_names"])
    print(result["confusion_matrix"])
    if result.get("confusion_matrix_png"):
        print(f"\nConfusion matrix PNG:      {result['confusion_matrix_png']}")
        print(
            """
How to read it:
  - Rows:    true branch (what actually unlocked on the held-out tail of your timeline).
  - Columns: what the model predicted.
  - Diagonal: correct predictions; off-diagonal: confusions between branches.
  - Darker color = higher count (see color scale). A row/column of all zeros means no
    test events had that label after filtering.
  - This reflects the test slice only, not universal truth about Minecraft; with one
    player, use it to discuss patterns (e.g. story vs nether confused) and limits.
""".strip()
        )

    print(
        "\nLimitations: single world, autocorrelated timeline, labels grouped/rare-merged;\n"
        "accuracy is illustrative, not a claim about other players.\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
