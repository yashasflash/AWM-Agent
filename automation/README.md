# AWM Agent — Autonomous n8n Workflow Integration

## Overview

The **Autonomous Waste Management (AWM) Agent** connects citizen incident reports directly to an **n8n AI orchestration workflow** for autonomous categorization, urgency triage, priority scoring, and department routing.

---

## 1. Webhook Endpoint Specification

* **Protocol**: HTTP POST
* **Default URL**: `http://localhost:5678/webhook/awm-waste-report`
* **Configurable Env**: `N8N_WEBHOOK_URL` in `backend/.env`
* **Timeout**: 30 seconds

---

## 2. Inbound Payload (Sent by FastAPI Backend)

When a citizen files a waste report, the FastAPI backend immediately dispatches the following JSON payload to the n8n webhook:

```json
{
  "report_uuid": "e2156416-6f66-44dc-ac37-a87f1d8b1258",
  "report_id": 142,
  "issue_type": "Illegal Dumping / Plastic Waste",
  "description": "Large overflow of industrial plastic bags blocking the main drainage canal near Ward 4 market.",
  "ward": "Ward 4",
  "location": "42 Cross Road, Ward 4"
}
```

---

## 3. Expected Outbound Response (Returned to FastAPI Backend)

The n8n workflow uses an AI Model node (e.g. Google Gemini 1.5/2.0 or OpenAI) to analyze the text and image context, returning structured JSON:

```json
{
  "waste_category": "Industrial Plastic Waste",
  "priority": "HIGH",
  "recommended_action": "Urgent canal clearance to prevent monsoon water logging and drainage overflow.",
  "assigned_department": "Drainage & Heavy Cleansing Division",
  "reason": "High hazard risk: plastic obstruction in water canal could cause neighborhood flooding within 24 hours."
}
```

### Response Validation Rules
The backend validates that the response contains all five required string attributes:
1. `waste_category` (string, non-empty)
2. `priority` (`"LOW"`, `"MEDIUM"`, or `"HIGH"`)
3. `recommended_action` (string, actionable dispatch directive)
4. `assigned_department` (string, municipal department)
5. `reason` (string, justification)

---

## 4. Fallback Behavior

If the n8n service is offline or unreachable:
* The citizen's waste report is **safely committed to Supabase** (no data loss).
* The backend logs an `N8N TIMEOUT` / `N8N HTTP ERROR`.
* The report status is set to `Submitted` with default prioritization so Operations Managers can manually triage the task via the Manager Console.

---

## 5. Setting Up n8n Locally

1. **Install and Run n8n**:
   ```bash
   npx n8n
   # Or via Docker:
   docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
   ```
2. **Access n8n Web Console**: Open `http://localhost:5678`.
3. **Import or Build Workflow**:
   - Add a **Webhook** node (`POST`, path: `awm-waste-report`).
   - Add an **AI Agent / LLM Chain** node (prompted to return the structured JSON schema defined above).
   - Add a **Respond to Webhook** node returning the LLM JSON output.
4. **Activate the Workflow**.
