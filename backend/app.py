import os
import shutil
import subprocess
import cv2
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from rapidfuzz import process, fuzz
from ultralytics import YOLO

BASE = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="MediVision AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained weights directly from the backend folder; never fetch model weights.
model_path = os.path.join(BASE, "best (1).pt")
if not os.path.isfile(model_path):
    raise FileNotFoundError(f"Medicine detection model not found: {model_path}")

detector = YOLO(model_path)
tesseract_path = shutil.which("tesseract")
if not tesseract_path:
    raise RuntimeError(
        "Tesseract OCR was not found. Install Tesseract and make sure it is on PATH."
    )
medicine_data = pd.read_csv(os.path.join(BASE, "drug_info.csv")).fillna("")

# Match OCR text against medicine names and brand names in the local CSV.
terms, term_idx = [], []
for i, row in medicine_data.iterrows():
    name = str(row["name"]).strip()
    brands = [brand.strip() for brand in str(row["brands"]).split("|")]
    for term in [name] + [brand for brand in brands if len(brand) > 3]:
        if term:
            terms.append(term)
            term_idx.append(i)

DISCLAIMER = "For information only. Always follow a doctor's or pharmacist's advice."


def match_drug(text, min_score=75):
    m = process.extractOne(text, terms, scorer=fuzz.WRatio, score_cutoff=min_score)
    return (term_idx[m[2]], float(m[1])) if m else (None, 0.0)


def read_text(image):
    success, encoded_image = cv2.imencode(".png", image)
    if not success:
        raise HTTPException(status_code=500, detail="Could not prepare the image for text recognition.")

    result = subprocess.run(
        [tesseract_path, "stdin", "stdout", "-l", "eng", "--psm", "6"],
        input=encoded_image.tobytes(),
        capture_output=True,
        check=False,
    )
    if result.returncode:
        details = result.stderr.decode("utf-8", errors="replace").strip()
        raise HTTPException(
            status_code=500,
            detail=f"Text recognition failed: {details or 'Tesseract returned an error.'}",
        )
    return result.stdout.decode("utf-8", errors="replace").strip()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "medicine_count": len(medicine_data),
        "model": os.path.basename(model_path),
    }


@app.post("/api/identify")
def identify(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    img = cv2.imdecode(np.frombuffer(file.file.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not read the image.")

    # shrink very large photos so processing stays fast
    h, w = img.shape[:2]
    if max(h, w) > 1600:
        s = 1600 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)))
        h, w = img.shape[:2]

    # The local YOLO model locates the medicine name; system Tesseract reads the label.
    res = detector.predict(img, conf=0.15, verbose=False)[0]
    texts = []
    for x1, y1, x2, y2 in res.boxes.xyxy.cpu().numpy().astype(int):
        crop = img[max(y1 - 5, 0):min(y2 + 5, h), max(x1 - 5, 0):min(x2 + 5, w)]
        text = read_text(crop)
        if text:
            texts.append(text)
    if not texts:
        texts.append(read_text(img))

    # Match OCR output against the local medicine CSV; no database server is used.
    best_idx, best_score, best_text = None, 0.0, ""
    for t in texts:
        i, s = match_drug(t)
        if s > best_score:
            best_idx, best_score, best_text = i, s, t

    if best_idx is None:
        return {"found": False, "text_read": " | ".join(texts), "disclaimer": DISCLAIMER}

    row = medicine_data.iloc[best_idx]
    return {
        "found": True,
        "name": row["name"],
        "category": row["category"],
        "brands": [brand.strip() for brand in str(row["brands"]).split("|") if brand.strip()],
        "uses": row["uses"],
        "side_effects": row["side_effects"],
        "extra_information": row.get("extra_information", ""),
        "match_score": round(best_score),
        "text_read": best_text,
        "disclaimer": DISCLAIMER,
    }