# Optional Google Apps Script mirror (an EXTRA copy)

> Want Apps Script as the **main** store instead (no Google Cloud needed)? That is a different, fuller setup: see `GO_LIVE_GOOGLE_SHEETS.md`, **Option A**, and `apps-script/Code.gs`. This page is only about sending a second copy to a script of your own.

The application is stored in Google Sheets through a **service account** (see GOOGLE_SHEETS_SETUP.md); that is the primary store and needs no script. If you also want each submission pushed to a Google Apps Script web app (for example to send an email or write to another sheet), set `GOOGLE_SCRIPT_URL`.

Behaviour: after a successful save the server POSTs JSON `{kind: "application"|"mentor", secret, receivedAt, data}` (text/plain, 8 s timeout). If the script is slow or fails, the applicant's submission still succeeds and the error is logged.

Minimal script (Extensions → Apps Script → Deploy → Web app, access "Anyone"):
```js
const SECRET = "same value as GOOGLE_SCRIPT_SECRET";
function doPost(e) {
  const msg = JSON.parse(e.postData.contents);
  if (msg.secret !== SECRET) return ContentService.createTextOutput("forbidden");
  SpreadsheetApp.getActive().getSheetByName("Mirror")
    .appendRow([msg.receivedAt, msg.kind, JSON.stringify(msg.data)]);
  return ContentService.createTextOutput("ok");
}
```
Only a summary is sent (reference, date, state, applicant contact block, business name). Never put secrets in the sheet.
