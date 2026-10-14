# CheckInDaily — Test Specifications & Role Journeys (trimmed fixture)

**Purpose:** reference document for the automated test suite. Each journey lists preconditions, steps, and assertions.

**Timezone:** Asia/Kolkata (IST) for all date logic

---

## 2. Roles & Access Matrix

| Capability                       | Employee | Team Lead | Manager        | HR/Admin | Alumni (settled)     |
| -------------------------------- | -------- | --------- | -------------- | -------- | -------------------- |
| Mark own attendance / punch      | ✅       | ✅        | ✅             | ✅       | ❌                   |
| View own payslips & profile      | ✅       | ✅        | ✅             | ✅       | ✅ (read-only vault) |
| View team report                 | ❌       | Own team  | Assigned teams | All      | ❌                   |
| Run / finalize / publish payroll | ❌       | ❌        | ❌             | ✅       | ❌                   |

**Enforcement points:**

1. **Route layer** — deny-by-default; alumni restricted to `/home`, `/my-payslips`, `/profile`; unauthorized users are redirected to `/home`.
2. **Data layer** — row-level security; a route guard alone is never sufficient.

---

## 3. Site Map (route → roles → test coverage)

| Route                | Page                               | Roles               | Existing tests                        |
| -------------------- | ---------------------------------- | ------------------- | ------------------------------------- |
| `/home`              | Role-specific cockpit              | all signed-in       | E2E-01, a11y                          |
| `/mark`              | Mark Attendance + WorkClock        | all active          | E2E-01, E2E-07, a11y                  |
| `/report`            | Attendance report grid + bulk edit | lead / manager / HR | E2E-07, a11y                          |
| `/my-payslips`       | Own payslips + YTD + tax           | all + alumni        | E2E-06                                |
| `/payroll-runs`      | Payroll run management             | HR                  | E2E-06                                |
| `/profile`           | Own profile                        | all + alumni        | a11y                                  |
| `/api/public/health` | Health endpoint                    | public (no data)    | integration: scheduled-route-failures |

---

## 4. Role Journeys (E2E specs)

### 4.1 Employee — Aarav Sharma

**Journey E1: First login & daily attendance** _(E2E-01)_

- Preconditions: HR has onboarded the employee; invite email sent.
- Steps: open invite → `/set-password` → set compliant password → land on `/home` → go to `/mark` → mark today `P`.
- Assert: password complexity enforced server-side; land on /home with the employee cockpit; attendance entry visible; future dates not markable.

**Journey E2: Leave application** _(E2E-03, employee half)_

- Steps: `/requests` → new request → pick `CL` → pick working days → submit.
- Assert: non-working days filtered out; balance shown; status "Applied"; request appears in approver's queue.

**Negative specs:** cannot open `/report`, `/payroll-runs`, `/employees` (redirect to `/home` — E2E-08); cannot edit another employee's attendance (RLS).

### 4.2 Team Lead — Priya Patel

**Journey TL2: First-stage approval** _(E2E-03, approver half)_

- Steps: `/approvals` → open pending request → approve with comment.
- Assert: request advances to next chain stage; on final approval an attendance row is written and leave balance decremented; audit event recorded.

### 4.5 HR/Admin — Kiran Deshmukh

**Journey H2: Full payroll cycle** _(E2E-06)_

- Steps: `/payroll-runs` → create run (month, scope) → calculate → review warnings → finalize → publish → verify payslips.
- Assert: overlap with an existing run blocked; finalize and publish disabled while conflicts shown; post-publish payslips immutable; net pay ≥ 0; future-month runs rejected.

### 4.6 Alumni (settled) — any settled employee

**Journey A1: Vault access**

- Steps: sign in after settlement → land on `/home` (alumni view) → open `/my-payslips`, `/profile`.
- Assert: only the three allowed routes reachable; everything else redirects; all data read-only.
