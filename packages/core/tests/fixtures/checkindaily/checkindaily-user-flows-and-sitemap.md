# CheckInDaily — User Flows & Site Map (trimmed fixture)

**Product:** CheckInDaily — internal attendance, leave, and payroll workspace

---

## 1. Roles at a Glance

| Role | Purpose | Landing page |
|---|---|---|
| **Employee** | Marks own attendance, requests leave, views payslips | Home ("My Day") |
| **Team Lead** | Employee duties + approves Stage 1 requests | Home ("Team Overview") |
| **Manager** | Team Lead duties + manages people and teams | Home ("Management Overview") |
| **HR / Admin** | Full control: employees, payroll, offboarding | Home ("Operations Overview") |
| **Settled Alumni** | Read-only access to own payslips and profile | Alumni Vault |

Every route is guarded deny-by-default: if a role can't reach a path, the user is redirected to `/home`.

---

## 2. Site Map

| URL | Page | Roles | What it does |
|---|---|---|---|
| `/home` | Home cockpit | All | Role-aware dashboard |
| `/mark` | Mark Attendance | All | Month calendar; pick a status code |
| `/my-payslips` | My Payslips | All | List of own published payslips |
| `/report` | Attendance Report | Lead, Manager, HR | Spreadsheet grid, bulk edit |
| `/payroll-runs` | Payroll Runs | HR | Draft, finalize, publish lifecycle |

---

## 3. User Flows per Role

### 3.1 Employee — daily flow

```text
Sign in (/auth)
  → /home ("My Day")
  → /mark
      → Month calendar → tap today → pick a code → save
```
