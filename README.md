# 🚛 TMS: Next-Gen Transport Management System

## 📖 Overview

This project represents a digital transformation for organizations trapped in "Excel Hell." We have replaced hundreds of disconnected `.xlsx` files with a centralized, intelligent platform that manages driver fleets, vehicle movement, and logistics optimization in real-time.

---

## 🛠 Tech Stack

* **Frontend:** React (Vite) with Tailwind CSS for a responsive, driver-first UI.
* **Language:** TypeScript for type-safe data handling (crucial when migrating messy Excel data).
* **AI Engine:** **Google AI Studio (Gemini API)**.
* Used for intelligent route optimization.
* Automated parsing and cleaning of legacy Excel "messy" data.
* Natural language querying (e.g., *"Show me all drivers near Chicago who are under their hours limit"*).


* **Prompt Engineering:** Custom system instructions designed to handle complex logistics logic and data extraction from unstructured spreadsheets.

---

## 🧠 AI & Prompt Engineering

We leverage **Google AI Studio** to bridge the gap between human intuition and logistics data.

### How we use Prompt Engineering:

1. **Data Normalization:** A specialized prompt pipeline that takes rows from your "hundreds of Excel files" and transforms them into valid JSON objects matching our TypeScript interfaces.
2. **Constraint-Based Dispatching:** Prompts that factor in driver fatigue laws, vehicle capacity, and delivery windows to suggest the best driver for a load.
3. **Anomaly Detection:** AI-driven scanning of logs to find "ghost" entries or duplicate fuel receipts inherited from the old system.

---

## 📹 System Preview & Demo

[Video of transport management system software demo with AI integration]

*Above: A walkthrough showing the Excel migration tool in action, followed by the real-time driver tracking dashboard.*

---

## 🚀 Migration Features (The Excel Killer)

Moving from **hundreds of files** to **one source of truth**:

* **The "Mass Importer":** Drag and drop your folder of Excel files. Our AI-backed service identifies column headers (even if they are inconsistent) and maps them to the central database.
* **Conflict Resolution:** When the AI finds two different phone numbers for the same driver across two files, it flags it for human review.
* **Historical Audit:** All old Excel data is archived but searchable within the new system.

---

## ⚙️ Installation

1. **Clone the Repository:**
```bash
git clone https://github.com/your-org/tms-ai-core.git

```


2. **Environment Setup:**
Create a `.env` file and add your Google AI Studio API Key:
```env
VITE_GEMINI_API_KEY=your_key_here
DATABASE_URL=your_db_url

```


3. **Install & Run:**
```bash
npm install
npm run dev

```



