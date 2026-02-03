
# CarbonAI – Neural Sustainability Platform

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5.0-purple)
![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-orange)
![Supabase](https://img.shields.io/badge/Backend-Supabase-green)

**CarbonAI** is an enterprise-grade, AI-powered sustainability auditing platform. It utilizes Google's **Gemini Multimodal models** to analyze Scope 1, 2, and 3 emissions, process utility bills via computer vision, and generate predictive neural forecasts for net-zero strategies.

---

## 🧠 Core Features

### 1. Neural Impact Dashboard
Real-time visualization of carbon trajectories.
- **Aggregated Impact:** Live tracking of CO2e across all scopes.
- **Longitudinal Trajectory:** Historical analysis using Recharts.
- **System Diagnostics:** Connection status to the Neural Database.

### 2. AI-Powered Profiler (Scopes 1-3)
- **Scope 1 (Kinetic):** Vehicle fleet tracking with **PUC Certificate OCR** scanning.
- **Scope 2 (Energy):** Electricity consumption with **Solar Offset** calculations and **Bill Scanning**.
- **Scope 3 (Supply Chain):** Analysis of travel, material flow, and lifestyle choices.

### 3. Vision Scanner (Audit Vision)
- **Gemini Vision Integration:** Photograph receipts, utility bills, or vehicle certificates.
- **Auto-Extraction:** Automatically extracts vendors, dates, kWh, and emission factors.
- **Image Lab:** AI-driven image transformation and analysis.

### 4. Strategic Sandbox ("What-If" Simulations)
- **Predictive Modeling:** Adjust sliders (EV Transition, Renewable Adoption, Remote Work) to simulate future carbon reduction.
- **Gemini 3.0 Reasoning:** Generates optimized pathways and ROI summaries based on simulation variables.

### 5. Geospatial Intelligence
- **Google Maps Grounding:** Search for sustainability facilities or recycling centers.
- **Location Telemetry:** Retrieval of facility contact info and review snippets.

### 6. Authority Console (Admin)
- **Master Control:** Calibrate global emission factors (S1, S2, S3) that propagate to all users.
- **Blackbox Logs:** View system-wide security and activity logs.
- **Live Briefing:** Real-time voice conversation with the database using Gemini Live API.

---

## 🛠 Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS (Custom "Neural" Dark Theme)
- **AI Engine:** Google GenAI SDK (`@google/genai`)
  - Models: `gemini-3-flash-preview`, `gemini-2.5-flash-image`, `veo-3.1` (video), `gemini-2.5-flash-native-audio` (Live).
- **Backend / Auth:** Supabase (PostgreSQL, Auth, Realtime)
- **Visualization:** Recharts
- **Deployment:** Vercel / Netlify

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A Google Cloud Project with Gemini API enabled.
- A Supabase Project.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/carbon-ai.git
   cd carbon-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:

   ```env
   # Google Gemini API Key
   API_KEY=your_google_gemini_api_key

   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

---

## 🔐 Authority Access (Master Credentials)

The system includes a specialized lock screen. To access the **Authority Console** (Admin View):

- **Master Email:** `rautom508@gmail.com`
- **Master Password / Seed:** `OMRAUT`
- **Project Number (Alternate Token):** `1084459329478`

*Note: Standard users can register via the "Initialize Node" option on the lock screen.*

---

## 💾 Database Schema (Supabase)

Ensure your Supabase project has the following tables:

1. **profiles**: `id` (uuid, PK), `email`, `full_name`, `role`, `provider`, `phone`.
2. **emissions**: `id`, `user_id` (FK), `scope1`, `scope2`, `scope3`, `total`, `ai_insights`, `created_at`.
3. **activity_logs**: `id`, `user_id`, `user_name`, `action`, `details`, `created_at`.

---

## 📦 Deployment

### Vercel
1. Import project to Vercel.
2. Add Environment Variables in Vercel Project Settings.
3. Deploy (Framework Preset: Vite).

### Netlify
1. Connect via Git.
2. Set Environment Variables.
3. Build command: `npm run build`, Publish directory: `dist`.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**CarbonAI** — *Neural Persistence Protocol: ONLINE* 🟢
