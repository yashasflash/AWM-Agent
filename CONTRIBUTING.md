# Contributing to AWM Agent

Thank you for your interest in contributing to the **Autonomous Waste Management (AWM) Agent Platform**!

---

## Code of Conduct

Please maintain a respectful, inclusive, and professional environment across all issues, pull requests, and discussions.

---

## Development Setup

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/<your-username>/AWM.git
   cd AWM
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   cp .env.example .env
   # Populate SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY in .env
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env
   # Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   npm run dev
   ```

---

## Testing & Quality Assurance

Before submitting a pull request, ensure all tests pass:

- **Frontend Build**:
  ```bash
  cd frontend
  npm run build
  ```

- **Backend RBAC & Portal Test Suites**:
  ```bash
  cd backend
  python test_three_role_login.py
  python test_portal_combinations.py
  python test_complete_workflow_suite.py
  ```

---

## Git Workflow & Pull Requests

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Commit changes with clear, descriptive messages.
3. Push to your branch: `git push origin feature/your-feature-name`
4. Open a Pull Request targeting `main`.

---

## Security Notice

- **Never** commit real `.env` files, Supabase `service_role` keys, database files, or sensitive personal data.
- All secrets are excluded via `.gitignore`.
