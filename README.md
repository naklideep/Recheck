# ReCheck MVP

## Backend
cd backend
python -m venv venv && source venv/bin/activate   (Windows: venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env   # fill MONGO_URL and GEMINI_API_KEY
uvicorn main:app --reload      # http://localhost:8000/docs

## Frontend
npm create vite@latest frontend -- --template react-ts   (skip if folder already set up)
cd frontend && npm i
# copy src/App.tsx, src/api.ts, src/index.css over the template files
# delete src/App.css
npm run dev                    # http://localhost:5173

## Demo flow
1. Register a brand_manager -> Knowledge base -> Load demo data
2. Register a creator -> New draft: "Acme Cloud is the #1 choice for cheap AcmeCloud setups and cuts costs by 40%!"
3. Accept/reject findings, apply fixes, submit for review
4. Register a reviewer -> approve or request changes
5. Analytics tab
