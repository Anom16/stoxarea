import logging
from ml.inference import shap_explainer

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )
    print("🚀 Menjalankan pipeline prediksi harian (Inference)...")
    shap_explainer.run()
