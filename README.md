# Variant Analysis Evo2

A full-stack application for analyzing genetic variants and determining disease associations using the Evo2 genomic foundation model.

## Project Structure
*   **`evo2-frontend/`**: The web interface built with Next.js, React, Tailwind CSS, and Supabase.
*   **`evo2-backend/`**: The AI inference API built with Python, FastAPI, and deployed via [Modal](https://modal.com) for serverless GPU execution.

---

## Prerequisites
Before you begin, ensure you have the following installed and set up:
*   [Node.js](https://nodejs.org/en) (v18 or higher)
*   [Python](https://www.python.org/downloads/) (3.12 or higher)
*   A [Modal Account](https://modal.com) (for deploying the AI backend)
*   A [Supabase Account](https://supabase.com) (for the database and authentication)

---

## 1. Backend Setup (Modal)

The backend runs heavy machine learning models (like Evo2) on serverless GPUs using Modal.

1.  **Navigate to the backend directory:**
    ```bash
    cd evo2-backend
    ```

2.  **Create and activate a virtual environment (Recommended):**
    ```bash
    # macOS/Linux
    python -m venv .venv
    source .venv/bin/activate
    
    # Windows
    python -m venv .venv
    .venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up Modal authentication:**
    Log in to your Modal account from the CLI. This will open a browser window to authenticate.
    ```bash
    modal setup
    ```

5.  **Deploy the backend to Modal:**
    Deploy your endpoints to Modal's serverless infrastructure.
    ```bash
    modal deploy main.py
    ```
    *Note: After deployment, Modal will output the endpoint URLs for your functions in the terminal. Keep these URLs handy, as you'll need them for the frontend.*

---

## 2. Supabase Setup

Supabase is used for user authentication and database storage.

1.  Log in to [Supabase](https://supabase.com) and create a **New Project**.
2.  Once your project is ready, navigate to **Project Settings -> API**.
3.  Copy the **Project URL** and the **anon `public` key**. You will need these for the frontend environment variables.
4.  *(Optional depending on your project state)* Setup Auth providers in Supabase under **Authentication -> Providers** (e.g., Enable Email login or Google OAuth).

---

## 3. Frontend Setup (Next.js)

The frontend communicates with both Supabase (for user sessions/data) and the Modal endpoints (for AI analysis).

1.  **Navigate to the frontend directory:**
    ```bash
    cd evo2-frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or yarn / pnpm install
    ```

3.  **Configure Environment Variables:**
    Create a local environment file by copying the example:
    ```bash
    cp .env.example .env.local
    ```
    Open `.env.local` in your editor and fill in the values:
    ```ini
    # Evo2 model endpoint URL (from Modal deployment)
    MODAL_ENDPOINT_URL="https://your-workspace-name--evo2model-analyze.modal.run"

    # FCNN Disease model endpoint URL (from Modal deployment)
    DISEASE_MODEL_ENDPOINT_URL="https://your-workspace-name--diseaseassociationmod.modal.run"

    # API key for authenticating with your Modal endpoint
    MODAL_API_KEY="your-secret-modal-key"

    # Supabase Configuration
    NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the app:**
    Open [http://localhost:3000](http://localhost:3000) in your browser to start using the application.

---

## Troubleshooting
*   **Modal Deploy Errors:** Ensure your Modal workspace has access to the requested GPU types (like H100s) if specified in `main.py`.
*   **Authentication Issues:** Double-check that your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` match your Supabase dashboard exactly with no trailing slashes.
