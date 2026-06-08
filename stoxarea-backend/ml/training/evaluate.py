"""
ml/training/evaluate.py
------------------------
Script evaluasi lengkap model XGBoost STOXAREA.

Output yang dihasilkan (disimpan ke reports/):
  1. classification_report.txt  — Accuracy, Precision, Recall, F1
  2. confusion_matrix.png       — Heatmap confusion matrix
  3. roc_curve.png              — AUC-ROC Curve
  4. feature_importance.png     — Top 11 fitur paling berpengaruh
  5. walkforward_results.png    — Performa tiap fold validasi
  6. evaluation_summary.json    — Semua metrik dalam format JSON

Cara menjalankan:
  cd stoxarea-backend
  python -m ml.training.evaluate
"""

import json
import logging
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix, roc_auc_score,
    roc_curve
)

# ── Setup ──────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

INPUT_PATH  = Path("data/processed/features_targets.csv")
MODEL_PATH  = Path("models/xgb_model.pkl")
REPORTS_DIR = Path("reports")

FEATURES = [
    "log_ret_1d", "log_ret_5d",
    "ma_20_dist", "ma_50_dist",
    "bb_width", "bb_position",
    "rsi_14",
    "macd_norm", "macd_signal_norm", "macd_hist_norm",
    "vol_ma_ratio",
]

FEATURE_LABELS = {
    "log_ret_1d":        "Return Harian",
    "log_ret_5d":        "Momentum 5 Hari",
    "ma_20_dist":        "Jarak ke MA20",
    "ma_50_dist":        "Jarak ke MA50",
    "bb_width":          "Lebar Bollinger Bands",
    "bb_position":       "Posisi Harga (BB)",
    "rsi_14":            "RSI 14",
    "macd_norm":         "MACD",
    "macd_signal_norm":  "MACD Signal",
    "macd_hist_norm":    "MACD Histogram",
    "vol_ma_ratio":      "Rasio Volume",
}

TARGET = "target_5d_up"


def run():
    # ── Setup matplotlib non-GUI ───────────────────────────────────────────────
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.ticker as mticker
    from matplotlib.colors import LinearSegmentedColormap
    import seaborn as sns

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load Data ──────────────────────────────────────────────────────────────
    if not INPUT_PATH.exists():
        logger.error(f"File {INPUT_PATH} tidak ditemukan. Jalankan feature_engineering.py dulu.")
        return

    logger.info("Memuat dataset...")
    df = pd.read_csv(INPUT_PATH)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)

    train_df = df[~df["is_latest"]].dropna(subset=[TARGET] + FEATURES).copy()
    X = train_df[FEATURES]
    y = train_df[TARGET]

    logger.info(f"Total sampel: {len(X):,}")
    logger.info(f"  Class 0 (tidak naik): {(y==0).sum():,} ({(y==0).mean()*100:.1f}%)")
    logger.info(f"  Class 1 (naik ≥5%)  : {(y==1).sum():,} ({(y==1).mean()*100:.1f}%)")

    # ── Load Model ─────────────────────────────────────────────────────────────
    if not MODEL_PATH.exists():
        logger.error(f"Model {MODEL_PATH} tidak ditemukan. Jalankan train_xgboost.py dulu.")
        return

    logger.info("Memuat model XGBoost...")
    model = joblib.load(MODEL_PATH)

    # ── 1. Walk-Forward Validation ─────────────────────────────────────────────
    logger.info("\n📊 Walk-Forward Validation (5 Fold)...")
    tscv = TimeSeriesSplit(n_splits=5)

    fold_results = []
    import xgboost as xgb
    n_neg = int((y == 0).sum())
    n_pos = int((y == 1).sum())
    spw   = n_neg / n_pos

    for fold, (tr_idx, te_idx) in enumerate(tscv.split(X)):
        X_tr, X_te = X.iloc[tr_idx], X.iloc[te_idx]
        y_tr, y_te = y.iloc[tr_idx], y.iloc[te_idx]

        fold_model = xgb.XGBClassifier(
            n_estimators=100, max_depth=4, learning_rate=0.05,
            objective="binary:logistic", eval_metric="logloss",
            scale_pos_weight=spw, random_state=42, n_jobs=-1
        )
        fold_model.fit(X_tr, y_tr)
        preds = fold_model.predict(X_te)
        proba = fold_model.predict_proba(X_te)[:, 1]

        acc  = accuracy_score(y_te, preds)
        prec = precision_score(y_te, preds, zero_division=0)
        rec  = recall_score(y_te, preds, zero_division=0)
        f1   = f1_score(y_te, preds, zero_division=0)
        auc  = roc_auc_score(y_te, proba)

        fold_results.append({
            "fold": fold + 1,
            "train_size": len(X_tr),
            "test_size":  len(X_te),
            "accuracy":   round(acc,  4),
            "precision":  round(prec, 4),
            "recall":     round(rec,  4),
            "f1":         round(f1,   4),
            "auc":        round(auc,  4),
        })
        logger.info(
            f"  Fold {fold+1} | Acc={acc:.4f} Prec={prec:.4f} "
            f"Rec={rec:.4f} F1={f1:.4f} AUC={auc:.4f}"
        )

    df_folds = pd.DataFrame(fold_results)
    mean_row = df_folds[["accuracy","precision","recall","f1","auc"]].mean().round(4)
    logger.info(f"\n  Rata-rata: {mean_row.to_dict()}")

    # ── Plot Walk-Forward ──────────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(10, 5))
    metrics = ["accuracy", "precision", "recall", "f1", "auc"]
    colors  = ["#2196F3", "#4CAF50", "#FF5722", "#9C27B0", "#FF9800"]

    for metric, color in zip(metrics, colors):
        ax.plot(df_folds["fold"], df_folds[metric], marker="o",
                linewidth=2, markersize=8, label=metric.capitalize(), color=color)
        ax.annotate(f"{df_folds[metric].mean():.3f}",
                    xy=(5.15, df_folds[metric].iloc[-1]),
                    fontsize=8, color=color, va="center")

    ax.set_xlabel("Fold", fontsize=12)
    ax.set_ylabel("Score", fontsize=12)
    ax.set_title("Walk-Forward Validation — Performa per Fold", fontsize=14, fontweight="bold")
    ax.set_ylim(0, 1.05)
    ax.set_xticks(range(1, 6))
    ax.legend(loc="lower left", fontsize=10)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "walkforward_results.png", dpi=150)
    plt.close()
    logger.info("  ✅ walkforward_results.png disimpan")

    # ── 2. Evaluasi Model Final di Seluruh Data ────────────────────────────────
    logger.info("\n📊 Evaluasi Model Final...")
    y_proba = model.predict_proba(X)[:, 1]
    y_pred_default = model.predict(X)   # threshold default 0.5

    # Metrik dengan threshold default (0.5) — untuk laporan formal
    acc_d  = accuracy_score(y, y_pred_default)
    prec_d = precision_score(y, y_pred_default, zero_division=0)
    rec_d  = recall_score(y, y_pred_default, zero_division=0)
    f1_d   = f1_score(y, y_pred_default, zero_division=0)
    auc    = roc_auc_score(y, y_proba)

    # Cari threshold optimal berdasarkan F1-Score terbaik
    best_thresh, best_f1 = 0.5, 0.0
    for thresh in np.arange(0.30, 0.71, 0.01):
        preds_t = (y_proba >= thresh).astype(int)
        f1_t = f1_score(y, preds_t, zero_division=0)
        if f1_t > best_f1:
            best_f1 = f1_t
            best_thresh = round(float(thresh), 2)

    y_pred_opt = (y_proba >= best_thresh).astype(int)
    acc  = accuracy_score(y, y_pred_opt)
    prec = precision_score(y, y_pred_opt, zero_division=0)
    rec  = recall_score(y, y_pred_opt, zero_division=0)
    f1   = f1_score(y, y_pred_opt, zero_division=0)

    logger.info(f"  Threshold default (0.50): Acc={acc_d:.4f} Prec={prec_d:.4f} Rec={rec_d:.4f} F1={f1_d:.4f}")
    logger.info(f"  Threshold optimal ({best_thresh}): Acc={acc:.4f}  Prec={prec:.4f}  Rec={rec:.4f}  F1={f1:.4f}")
    logger.info(f"  AUC-ROC: {auc:.4f}")

    # Gunakan threshold default untuk classification report (standar akademik)
    y_pred = y_pred_default
    acc, prec, rec, f1 = acc_d, prec_d, rec_d, f1_d

    report_str = classification_report(y, y_pred, target_names=["Tidak Naik (0)", "Naik ≥5% (1)"])
    logger.info(f"\n{report_str}")

    # Simpan classification report ke txt
    with open(REPORTS_DIR / "classification_report.txt", "w", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write("LAPORAN EVALUASI MODEL XGBOOST — STOXAREA\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Dataset    : {len(X):,} sampel\n")
        f.write(f"Class 0    : {(y==0).sum():,} ({(y==0).mean()*100:.1f}%)\n")
        f.write(f"Class 1    : {(y==1).sum():,} ({(y==1).mean()*100:.1f}%)\n\n")
        f.write("METRIK EVALUASI:\n")
        f.write(f"  Accuracy : {acc*100:.2f}%\n")
        f.write(f"  Precision: {prec*100:.2f}%\n")
        f.write(f"  Recall   : {rec*100:.2f}%\n")
        f.write(f"  F1-Score : {f1*100:.2f}%\n")
        f.write(f"  AUC-ROC  : {auc:.4f}\n\n")
        f.write("CLASSIFICATION REPORT:\n")
        f.write(report_str)
        f.write("\n\nWALK-FORWARD VALIDATION:\n")
        f.write(df_folds.to_string(index=False))
    logger.info("  ✅ classification_report.txt disimpan")

    # ── 3. Confusion Matrix ────────────────────────────────────────────────────
    cm = confusion_matrix(y, y_pred)
    tn, fp, fn, tp = cm.ravel()

    fig, ax = plt.subplots(figsize=(7, 6))
    cmap = LinearSegmentedColormap.from_list("custom", ["#FFFFFF", "#2255AA"])
    sns.heatmap(
        cm, annot=True, fmt=",d", cmap=cmap,
        xticklabels=["Prediksi: Tidak Naik", "Prediksi: Naik ≥5%"],
        yticklabels=["Aktual: Tidak Naik", "Aktual: Naik ≥5%"],
        linewidths=2, linecolor="white", ax=ax,
        annot_kws={"size": 16, "weight": "bold"}
    )
    ax.set_title("Confusion Matrix — Model XGBoost STOXAREA", fontsize=13, fontweight="bold", pad=15)
    ax.set_ylabel("Nilai Aktual", fontsize=12)
    ax.set_xlabel("Nilai Prediksi", fontsize=12)

    # Tambah keterangan
    stats = f"TN={tn:,}  FP={fp:,}  FN={fn:,}  TP={tp:,}\nAccuracy={acc*100:.1f}%  Precision={prec*100:.1f}%  Recall={rec*100:.1f}%"
    ax.text(0.5, -0.12, stats, transform=ax.transAxes,
            fontsize=10, ha="center", color="#555555")

    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "confusion_matrix.png", dpi=150)
    plt.close()
    logger.info("  ✅ confusion_matrix.png disimpan")

    # ── 4. ROC Curve ──────────────────────────────────────────────────────────
    fpr, tpr, _ = roc_curve(y, y_proba)

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(fpr, tpr, color="#2255AA", linewidth=2.5,
            label=f"XGBoost (AUC = {auc:.4f})")
    ax.plot([0, 1], [0, 1], "k--", linewidth=1.5, alpha=0.5, label="Random Classifier")
    ax.fill_between(fpr, tpr, alpha=0.08, color="#2255AA")

    ax.set_xlabel("False Positive Rate", fontsize=12)
    ax.set_ylabel("True Positive Rate", fontsize=12)
    ax.set_title("ROC Curve — Model XGBoost STOXAREA", fontsize=13, fontweight="bold")
    ax.legend(fontsize=11, loc="lower right")
    ax.grid(True, alpha=0.3)
    ax.set_xlim([0, 1])
    ax.set_ylim([0, 1.02])

    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "roc_curve.png", dpi=150)
    plt.close()
    logger.info("  ✅ roc_curve.png disimpan")

    # ── 5. Feature Importance ─────────────────────────────────────────────────
    if hasattr(model, "calibrated_classifiers_"):
        base = model.calibrated_classifiers_[0].estimator
    else:
        base = model

    importances = base.feature_importances_
    feat_df = pd.DataFrame({
        "feature": FEATURES,
        "label":   [FEATURE_LABELS[f] for f in FEATURES],
        "importance": importances
    }).sort_values("importance", ascending=True)

    fig, ax = plt.subplots(figsize=(9, 6))
    colors_bar = ["#2255AA" if v > feat_df["importance"].median() else "#90A4AE"
                  for v in feat_df["importance"]]
    bars = ax.barh(feat_df["label"], feat_df["importance"],
                   color=colors_bar, edgecolor="white", height=0.6)

    for bar, val in zip(bars, feat_df["importance"]):
        ax.text(val + 0.002, bar.get_y() + bar.get_height() / 2,
                f"{val:.4f}", va="center", fontsize=9, color="#333333")

    ax.set_xlabel("Feature Importance Score", fontsize=12)
    ax.set_title("Feature Importance — Model XGBoost STOXAREA", fontsize=13, fontweight="bold")
    ax.grid(True, alpha=0.2, axis="x")
    ax.set_xlim(0, feat_df["importance"].max() * 1.2)
    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "feature_importance.png", dpi=150)
    plt.close()
    logger.info("  ✅ feature_importance.png disimpan")

    # ── 6. Simpan Summary JSON ─────────────────────────────────────────────────
    summary = {
        "model": "XGBoost Classifier + Isotonic Calibration",
        "dataset": {
            "total_samples":    int(len(X)),
            "class_0_count":    int((y == 0).sum()),
            "class_1_count":    int((y == 1).sum()),
            "positive_rate":    round(float((y == 1).mean() * 100), 2),
        },
        "parameters": {
            "n_estimators": 150,
            "max_depth": 4,
            "learning_rate": 0.05,
            "scale_pos_weight": round(spw, 4),
            "calibration": "isotonic",
            "validation": "TimeSeriesSplit (5 fold)",
            "optimal_threshold": best_thresh,
        },
        "metrics_final_model": {
            "accuracy":  round(acc * 100, 2),
            "precision": round(prec * 100, 2),
            "recall":    round(rec * 100, 2),
            "f1_score":  round(f1 * 100, 2),
            "auc_roc":   round(auc, 4),
        },
        "confusion_matrix": {
            "true_negative":  int(tn),
            "false_positive": int(fp),
            "false_negative": int(fn),
            "true_positive":  int(tp),
        },
        "walkforward_per_fold": fold_results,
        "walkforward_mean": {k: round(float(v), 4) for k, v in mean_row.items()},
        "top3_features": feat_df.tail(3)[["feature", "importance"]].to_dict("records"),
    }

    with open(REPORTS_DIR / "evaluation_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    logger.info("  ✅ evaluation_summary.json disimpan")

    # ── Ringkasan Akhir ────────────────────────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info("✅ EVALUASI SELESAI")
    logger.info(f"   Accuracy  : {acc*100:.2f}%")
    logger.info(f"   Precision : {prec*100:.2f}%")
    logger.info(f"   Recall    : {rec*100:.2f}%")
    logger.info(f"   F1-Score  : {f1*100:.2f}%")
    logger.info(f"   AUC-ROC   : {auc:.4f}")
    logger.info(f"\n   Semua output disimpan di folder: {REPORTS_DIR.resolve()}")
    logger.info("=" * 60)


if __name__ == "__main__":
    run()
