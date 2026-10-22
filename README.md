# MediVision AI

MediVision AI identifies medicine packaging from an uploaded image. It uses a locally stored YOLO model to locate the medicine name, Tesseract OCR to read the label, and a local CSV file to show the matching medicine's brands, uses, side effects, and additional information.

> **Medical information notice:** This project provides general reference information, not a diagnosis or treatment recommendation. Always consult a doctor or pharmacist before making decisions about medication.

## Features

- Upload or drag and drop a medicine image.
- Detect the medicine label with the included trained model.
- Read the label with locally installed Tesseract OCR.
- Match the recognized name against the local medicine list.
- Display matching brands, uses, possible side effects, and additional information.
- Start a new scan to clear the selected image and results.
- No database server or model-weight download is required.

## Project structure

```text
medicine-app/
├── backend/
│   ├── app.py
│   ├── best (1).pt
│   ├── drug_info.csv
│   └── requirements.txt
└── frontend/
    ├── package.json
    └── src/
```

## Requirements

- Python 3.10 or newer
- Node.js compatible with Vite 8
- Tesseract OCR installed on your computer and available on `PATH`

The backend loads `backend/best (1).pt` directly. Tesseract is used for OCR; EasyOCR and its separately downloaded weights are not used.

### Install Tesseract on Windows

Install Tesseract OCR for Windows and ensure its installation directory is on `PATH`. Open a new terminal and check that it is available:

```powershell
tesseract --version
```

The backend reports an explicit startup error if Tesseract cannot be found.

## Run locally

Open two terminals from the project root.

### 1. Start the backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks virtual-environment activation, run the backend interpreter directly instead:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

The model and CSV are loaded from the backend folder when the app starts. Keep `best (1).pt` and `drug_info.csv` in that folder.

### 2. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. During development, Vite forwards `/api` requests to the backend at `http://127.0.0.1:8000`.

## API

- `GET /api/health` — reports backend health, loaded model name, and medicine count.
- `POST /api/identify` — accepts an image as multipart form data in the `file` field.

A successful match includes the medicine name, category, brands, uses, side effects, additional information, OCR text, and match score. An unrecognized image returns `found: false` and the text read from the image.

## Medicine CSV

The local `backend/drug_info.csv` file supplies the reference information. It should include these columns:

| Column | Description |
| --- | --- |
| `name` | Generic medicine name used for matching |
| `category` | Medicine category shown with the result |
| `brands` | Optional brand names, separated by `\|` |
| `uses` | Common uses shown in the result |
| `side_effects` | Possible side effects shown in the result |
| `extra_information` | Optional additional notes in a collapsible section |

No SQL or hosted database is involved. After changing the CSV, restart the backend to reload it.

## Frontend checks

Run from the `frontend` directory:

```powershell
npm run lint
npm run build
```
