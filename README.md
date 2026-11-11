# UPSI Global Psychology Conference 2027 — Web Portal MVP

A GitHub-ready, standalone Google Apps Script web app that reuses **the existing** conference Google Forms, Google Sheet (`Master`) and Google Drive links. This app is designed as **a separate Apps Script project** so it does not overwrite the Form 1/2/3 scripts, duplicate triggers or collide with an existing `doGet()`.

## Features in this working MVP

| Audience | Features |
|---|---|
| Public participants | Links to existing Abstract Form 1 and Poster Form 2; no access to private data |
| Chief Reviewer | Dashboard counts; search/filter all posters; view PDF/video/receipts; validated scores and provisional category rankings; assign **one** eligible poster to its theme's co-chair without sending email |
| T01–T08 co-chairs | Signed-in reviewer dashboard; **only server-authorised assigned poster records returned**; open poster PDF/video; score six 1–5 criteria; submit once; scores saved to `EVALUATION_RESPONSES`, with assignment/master status updates |
| Data storage | Existing `MASTER_POSTERS`, `CONFIG`, `ASSIGNMENTS`, `EVALUATION_RESPONSES`; existing Google Drive file links |

### Not implemented yet

This MVP does **not** contain Chair accept/reject or payment approval buttons, reviewer notifications, score editing/reopening, published final results, a payment gateway, or automated Google Drive file-sharing. Keep using the existing Sheet menus for abstract and payment decisions. Rankings shown are **provisional** and based on valid evaluations; no final publication occurs.

## Recommended security and deployment model (UPSI internal users)

**Use Google Workspace domain-restricted deployment: `Execute as: Me` and `Who has access: Anyone within your UPSI organisation` (when offered).** The script uses `Session.getActiveUser().getEmail()` and rejects blank identities. Google notes that identity visibility is conditional; this usually works for accounts within the same Google Workspace domain but must be tested with an actual co-chair account. Access is checked on the server before every record read or write. **Do not deploy with public or anonymous access.**

This allows the master spreadsheet to remain private to the Chief/administrators. The web app runs under the deploying administrator's permissions. Store this Apps Script project only under an authorised institutional account.

**External co-chairs:** This package is NOT a complete external-user authentication solution. Before supporting reviewers outside the UPSI Workspace domain, add a properly verified Google Identity Services / OAuth ID-token flow or a dedicated secure identity provider. Do **not** use `Execute as me + Anyone` and assume the email is verified; do not grant reviewers edit access to the master spreadsheet as a workaround. Verify institution Workspace policy and access choices with your IT team.

Google Drive documents remain governed by separate Drive ACLs; if a co-chair cannot open a PDF, grant that co-chair access to **only their assigned files** via Drive sharing.

## One-time install — exact steps

1. **Back up the spreadsheet**. Keep the original `Master` spreadsheet and existing Apps Script project. Do not delete any Form triggers.
2. Visit [script.google.com](https://script.google.com/home/projects/create) and choose **New project**. Name it `UPSI Conference Portal 2027`. This must be a **new standalone project**, not a new code file inside the existing bound project.
3. Replace the generated `Code.gs` content with **`Backend.gs`** (you can rename the file `Backend` within Apps Script).
4. Click `+` next to Files → **HTML**; name it **`Index`**. Paste all of `Index.html` into it. Do not name it `Dashboard_UI` because the backend explicitly loads `Index`.
5. Open **Project Settings** and enable **Show `appsscript.json` manifest file in editor**. Replace manifest with the supplied `appsscript.json` (optional, but recommended for predictable scopes). Save.
6. In **Project Settings → Script Properties**, add:

   | Property | Value |
   |---|---|
   | `SHEET_ID` | The existing `Master` spreadsheet ID between `/d/` and `/edit` in its URL |
   | `PORTAL_ADMIN_EMAILS` | Comma-separated full Google emails for Chief Reviewer/authorised admins (e.g., `chair@your-university-domain`) |

   Keep the spreadsheet ID and emails in Script Properties — **not** in GitHub source. **No other properties are required.**
7. Verify these existing sheet tabs are present: `MASTER_POSTERS`, `CONFIG`, `ASSIGNMENTS`, `EVALUATION_RESPONSES`. Their headers should match the current system's headers. Confirm that `CONFIG` has `Theme Code`, `Co-chair Name`, `Co-chair Email` for T01–T08. The app does not create/replace any tabs.
8. In the Apps Script editor, select **`portal27HealthCheck`** and click **Run** using your Chief Reviewer account once to authorise the script. Check its log or result; if authorization is denied, confirm scopes and spreadsheet permission.
9. Select **Deploy → Test deployments → Web app** for initial owner-only testing, then **Deploy → New deployment → Web app** for the shared version. Choose **Execute as: Me** (institutional administrator) and **Who has access: Anyone within your organisation**. If that option is unavailable, **stop** and have UPSI IT check Workspace configuration; do not make it anonymous/public. Copy the web app URL.
10. Open the URL in a browser while signed into the Chief Reviewer account; test the overview and submissions. Then test using an **authorised UPSI co-chair account** in an incognito window; the account must be in `CONFIG` or listed as reviewer in `ASSIGNMENTS`. If the email isn't available, the app denies access by design.
11. **Only after** verified payment and Form 2 completion, the Chief Reviewer can assign one eligible poster in the portal. The assignment goes into `ASSIGNMENTS` and `MASTER_POSTERS` and **does not send email**. The reviewer then reopens the portal, selects the poster and submits the six ratings.

## Controlled test scenario

1. Use a **genuinely verified paid poster** in the production Sheet, or make a **staging copy of the Master spreadsheet** and set its new ID in a separate test web app project. Never mark dummy payments `VERIFIED` in production.
2. Check `MASTER_POSTERS`: `Screening = ACCEPTED`, `Payment Verified = VERIFIED`, `Poster Submission Status = RECEIVED - PAYMENT REVIEW`, Form 2 Response ID/PDF/video/receipt populated.
3. Check `CONFIG`: correct T08 email in `Co-chair Email`.
4. As Chief Reviewer: open the poster in the dashboard and choose **Assign to theme reviewer**. Confirm exactly one row appears in `ASSIGNMENTS` with `Status = PENDING`, `Notification Status = NOT SENT`.
5. As T08 co-chair: sign in on the web app URL, view **only your assigned posters**, open PDF/video and choose six ratings. Submit once; verify **`EVALUATION_RESPONSES` has `Validation Status = VALID`**, its `Form Response ID` starts with `WEB-`, and `ASSIGNMENTS.Status = COMPLETED`.
6. As Chief: refresh the dashboard. Confirm the score and comments appear under **Evaluations & results**; check that repeating the submission is blocked.
7. Validate with a second co-chair account: posters from other themes must not be exposed through the portal. Also test an unauthorised internal account: it must see an access-denied message.

### Score rule

`score = (15*Relevance + 20*Originality + 25*Methodology + 20*PosterClarity + 10*VideoPresentation + 10*Impact)/5`

Every score is 1–5; resulting totals are **20–100**. A different zero-anchored scale would need a deliberate rubric change.

### Existing Form 3

Your existing Form 3 trigger continues to work in the **original project**. The new reviewer dashboard writes to the same `EVALUATION_RESPONSES` sheet using IDs beginning `WEB-`. Use **one channel per poster/reviewer**; the dashboard prevents a second valid evaluation for the same reviewer/poster. Form 3's own validation must remain active if you continue accepting legacy Form 3 responses.

## GitHub source control

This ZIP includes the entire deployable source. Create a **private GitHub repository**, e.g. `upsi-conference-portal-2027`, and upload `Backend.gs`, `Index.html`, `appsscript.json`, and this README. Do **not** commit spreadsheet exports, receipts, participant personal information, project Script Properties, login tokens, or a `.clasp.json` that reveals identifiers. GitHub holds **source code only**; Google Apps Script hosts the live web app.

Optional CLI flow for experienced maintainers: install `@google/clasp`, `clasp login`, `clasp create --type standalone`, then `clasp push`. The manual steps above are easier for initial installation.

## Troubleshooting

- **Access denied / blank email** — Confirm same-Workspace account, correct `Execute as`/domain deployment, and `PORTAL_ADMIN_EMAILS`. If `Session.getActiveUser()` returns blank in your environment, do not bypass the check: use UPSI IT and a stronger authentication design.
- **No reviewer posters** — Check `ASSIGNMENTS` row, `Reviewer Email`, and signed-in account; `CONFIG` reviewer email alone grants login but **does not create an assignment**.
- **Cannot open PDF** — Google Drive sharing is separate; grant access to that specific file. Do not publicly share all receipts.
- **Cannot assign** — Ensure one correct Poster ID, `ACCEPTED`, `VERIFIED`, `RECEIVED - PAYMENT REVIEW`, complete Form 2 evidence, and T01–T08 co-chair config. Check existing `ASSIGNMENTS` for duplicates.
- **Cannot evaluate** — Confirm exactly one assignment for that poster/reviewer; assignment status PENDING; poster remains accepted and verified; no existing valid evaluation. Inspect `Executions` in Apps Script for server errors.
- **No data / column error** — Compare headers in sheet to the exact names in `Backend.gs`. This app deliberately fails rather than guessing mismatched columns.
- **Changed HTML doesn't appear** — Redeploy with **Manage deployments → Edit → New version** and refresh.

## Official references

- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Session / identity limitations: https://developers.google.com/apps-script/reference/base/session
- HTML Service calls: https://developers.google.com/apps-script/guides/html/communication

## Optional public submission website on GitHub Pages

This repository also includes **`docs/index.html`**, a self-contained public landing page containing **only** the two existing Google Form links. It has no personal data and does not expose the private management dashboard.

To publish it through GitHub Pages after pushing the repository: Repository → **Settings → Pages → Build and deployment → Deploy from a branch → main → /docs → Save**. Share the published `https://<organisation>.github.io/<repository>/` link with participants. **Only the landing page is hosted by GitHub Pages; the private Chief/Reviewer app is hosted by Google Apps Script.**
