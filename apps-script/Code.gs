/**
 * Google Sheets backend for the repair-tracker app (white-label: set APP_NAME below).
 *
 * Setup:
 *  1. Create a Google Sheet. Open Extensions → Apps Script and paste this file.
 *  2. Run setup() once (authorise when asked). It writes the header row and creates a
 *     random shared secret. Open View → Logs and copy the secret it prints
 *     (run showSecret() any time to print it again).
 *  3. Deploy → New deployment → type "Web app", Execute as: Me, Access: Anyone.
 *     (Access must be "Anyone" so the phone can reach it; every request is still
 *     rejected unless it carries the shared secret.)
 *  4. In the app: Settings → paste the /exec URL and the secret.
 *
 * Your data tab: "Service_Log" (created for you). If you already typed rows on another tab, as
 * long as its first row has the Ticket_ID header the script finds it. Columns can be in any order.
 *
 * Security notes:
 *  - Requests without the correct secret are rejected.
 *  - Photos are saved to a PRIVATE Drive folder; only the Sheet owner can open them.
 *  - Rows you type directly into the Sheet are picked up by the app on its next sync
 *    (blank Ticket_ID / Date_In are filled in for you). Use the dropdowns for status columns.
 *  - Every value is written as plain text, so "=FORMULA()" typed by a customer
 *    can never execute.
 *  - To rotate the secret: run resetSecret(), then update the app.
 */
var APP_NAME = "Infizo"; // ← white-label: set to the customer's app name
var SHEET_NAME = "Service_Log";
var PHOTO_FOLDER = APP_NAME + " Photos";
var MAX_BODY = 2500000; // ~2.5 MB: two compressed photos + a row
var COLUMNS = [
  "Ticket_ID", "Date_In", "Customer_Name", "Customer_Phone", "Laptop_Brand_Model", "Serial_Number",
  "Issues_Reported_Voice_Text", "Adapter_Included", "Bag_Included", "Physical_Condition_Notes",
  "Photo_URL_Front", "Photo_URL_Label", "Assigned_Technician", "Repair_Status", "Estimated_Cost",
  "Final_Bill", "Payment_Status", "Date_Repaired", "Date_Delivered", "Customer_Signature_Status"
];
var NUMERIC = { Estimated_Cost: true, Final_Bill: true };
// Helper column maintained by the script (and by onEdit for hand edits). The app uses it to ask only for
// rows that changed since its last sync. It's added to your Sheet automatically; you may hide it.
var STAMP = "Updated_At";
var MAX_PHOTO_BYTES = 1500000;

var STATUSES = ["Received", "Diagnosing", "Spare Parts Pending", "Repaired & Testing", "Ready for Delivery", "Delivered"];
var PAYMENTS = ["Unpaid", "Partial Advance", "Fully Paid"];
var VALIDATED = { Adapter_Included: ["Yes", "No"], Bag_Included: ["Yes", "No"], Repair_Status: STATUSES, Payment_Status: PAYMENTS };

// Dropdowns for the columns the app reads back, so hand-typed rows stay valid.
function applyValidation_(sh, idx) {
  Object.keys(VALIDATED).forEach(function (name) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(VALIDATED[name], true).setAllowInvalid(false).build();
    sh.getRange(2, idx[name] + 1, 2000, 1).setDataValidation(rule);
  });
}

function headerOf_(sh) {
  var w = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, w).getValues()[0].map(function (h) { return String(h).trim(); });
}

/**
 * Finds the data tab: "Service_Log" if it exists, otherwise the first tab whose header row
 * contains Ticket_ID (so data typed into e.g. "Sheet1" with our headers still works),
 * otherwise a new "Service_Log" tab is created.
 */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getLastRow() > 0 && headerOf_(all[i]).indexOf("Ticket_ID") >= 0) { sh = all[i]; break; }
    }
  }
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

/**
 * Column layout by header NAME (any order, extra columns tolerated). Missing headers are added
 * at the end. Returns { idx: {Header: zeroBasedIndex}, width }.
 */
function layout_(sh) {
  var first = sh.getLastRow() === 0;
  var head = first ? [] : headerOf_(sh);
  var idx = {}, added = [];
  head.forEach(function (h, i) { if (h && !(h in idx)) idx[h] = i; });
  COLUMNS.concat([STAMP]).forEach(function (c) {
    if (!(c in idx)) { idx[c] = head.length; head.push(c); added.push(c); }
  });
  if (added.length) {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    sh.setFrozenRows(1);
    // Format only the columns we just added. Columns the customer already had keep their formatting
    // (re-formatting a column of real dates as plain text would show them as serial numbers).
    added.forEach(function (c) {
      sh.getRange(2, idx[c] + 1, 2000, 1).setNumberFormat(NUMERIC[c] ? "0" : "@"); // plain text for typed rows too
    });
    applyValidation_(sh, idx);
  }
  return { idx: idx, width: head.length };
}

function setup() {
  var sh = sheet_(), L = layout_(sh);
  applyValidation_(sh, L.idx);
  var s = props_().getProperty("SHARED_SECRET") || newSecret_();
  Logger.log("Using tab: " + sh.getName());
  Logger.log("SHARED SECRET (paste into the app's Settings): " + s);
}

function props_() { return PropertiesService.getScriptProperties(); }

function newSecret_() {
  var s = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  props_().setProperty("SHARED_SECRET", s);
  return s;
}

function showSecret() { Logger.log("SHARED SECRET: " + props_().getProperty("SHARED_SECRET")); }
function resetSecret() { Logger.log("NEW SHARED SECRET: " + newSecret_()); }

function authorized_(secret) {
  var s = props_().getProperty("SHARED_SECRET");
  if (!s || typeof secret !== "string" || secret.length !== s.length) return false;
  var diff = 0; // constant-time compare
  for (var i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function savephoto_(dataUrl, name) {
  var m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+\/=]+)$/.exec(dataUrl);
  if (!m) return "";
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name + ".jpg");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); // never public
  return file.getUrl();
}

function nextTicketId_(ids) {
  var max = 1000;
  for (var i = 0; i < ids.length; i++) {
    var n = parseInt(String(ids[i][0]).replace(/\D/g, ""), 10);
    if (n > max) max = n;
  }
  return "TKT-" + (max + 1);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var raw = (e && e.postData && e.postData.contents) || "";
    if (raw.length > MAX_BODY) return json_({ ok: false, code: "too_large", error: "Request too large" });
    var req = JSON.parse(raw);
    if (!authorized_(req.secret)) return json_({ ok: false, code: "unauthorized", error: "Unauthorized" });
    if (req.action === "ping") return json_({ ok: true, service: APP_NAME });
    if (req.action === "list") return json_(list_(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(String(req.since || "")) ? req.since : null));
    if (req.action === "photo_put") return json_(photoPut_(req));
    if (req.action === "photo_get") return json_(photoGet_(req));
    if (req.action !== "upsert" || !req.row || !req.row.Ticket_ID) return json_({ ok: false, code: "unknown_action", error: "Bad request" });

    var row = req.row, out = { ok: true };
    var sh = sheet_(), L = layout_(sh), idx = L.idx;
    var last = sh.getLastRow();
    var ids = last > 1 ? sh.getRange(2, idx.Ticket_ID + 1, last - 1, 1).getValues() : [];
    var at = -1;
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === String(row.Ticket_ID)) { at = i + 2; break; }

    var existing = at > 0 ? sh.getRange(at, 1, 1, L.width).getValues()[0] : null;

    // Ticket-number collision: same ID but a different job (another device) → ask the client to renumber.
    if (existing) {
      var inCell = existing[idx.Date_In];
      var exIn = inCell instanceof Date ? inCell.toISOString() : String(inCell);
      if (exIn !== "" && exIn !== String(row.Date_In)) {
        return json_({ ok: false, code: "conflict", error: "Ticket ID already used", nextId: nextTicketId_(ids) });
      }
    }

    var photos = req.photos || {};
    if (photos.front) { out.photoFront = savephoto_(photos.front, row.Ticket_ID + "-front"); row.Photo_URL_Front = out.photoFront; }
    if (photos.label) { out.photoLabel = savephoto_(photos.label, row.Ticket_ID + "-label"); row.Photo_URL_Label = out.photoLabel; }

    var values = existing ? existing.slice() : [];
    while (values.length < L.width) values.push("");
    var formats = [];
    for (var k = 0; k < L.width; k++) formats.push("General");
    COLUMNS.forEach(function (c) {
      var v = row[c] === undefined || row[c] === null ? "" : row[c];
      if ((c === "Photo_URL_Front" || c === "Photo_URL_Label") && v === "" && existing) v = existing[idx[c]]; // keep links already there
      values[idx[c]] = NUMERIC[c] && v !== "" ? Number(v) || 0 : String(v);
      formats[idx[c]] = NUMERIC[c] ? "0" : "@";
    });
    values[idx[STAMP]] = new Date().toISOString(); formats[idx[STAMP]] = "@";
    if (at < 0) at = last + 1;
    var range = sh.getRange(at, 1, 1, L.width);
    // "@" = plain text: a value like =HYPERLINK(...) is stored as text, never evaluated.
    range.setNumberFormats([formats]);
    range.setValues([values]);
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: "Server error" });
  } finally {
    lock.releaseLock();
  }
}

var isoOf_ = function (v) { return v instanceof Date ? v.toISOString() : String(v || ""); };

/**
 * Rows for the app to merge. With `since` (an ISO time from a previous reply's serverTime) only rows
 * changed after that moment are returned — plus `ids`, the list of every Ticket_ID, so the app can still
 * notice rows deleted from the Sheet. Without `since` every row is returned.
 * Rows typed by hand get a Ticket_ID (if they have a customer name), a Date_In and an Updated_At first.
 * (Called inside doPost, so the script lock is already held.)
 */
function list_(since) {
  var sh = sheet_(), L = layout_(sh), idx = L.idx;
  var serverTime = new Date().toISOString();
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [], ids: [], sheet: sh.getName(), serverTime: serverTime, full: !since };
  var vals = sh.getRange(2, 1, last - 1, L.width).getValues();
  var ids = vals.map(function (r) { return [r[idx.Ticket_ID]]; });
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i], rowNo = i + 2;
    var hasId = String(r[idx.Ticket_ID]).trim() !== "";
    var hasName = String(r[idx.Customer_Name]).trim() !== "";
    if (!hasId && hasName) { // has a customer name but no ticket number
      r[idx.Ticket_ID] = nextTicketId_(ids); ids[i][0] = r[idx.Ticket_ID]; hasId = true;
      sh.getRange(rowNo, idx.Ticket_ID + 1).setNumberFormat("@").setValue(r[idx.Ticket_ID]);
      r[idx[STAMP]] = ""; // force a fresh stamp below
    }
    if (hasId && !r[idx.Date_In]) {
      r[idx.Date_In] = serverTime;
      sh.getRange(rowNo, idx.Date_In + 1).setNumberFormat("@").setValue(r[idx.Date_In]);
    }
    if (hasId && !r[idx[STAMP]]) { // never stamped (typed by hand before the trigger existed, or imported)
      r[idx[STAMP]] = serverTime;
      sh.getRange(rowNo, idx[STAMP] + 1).setNumberFormat("@").setValue(serverTime);
    }
  }
  var rows = [], allIds = [];
  vals.forEach(function (r) {
    var id = String(r[idx.Ticket_ID]).trim();
    if (!id) return;
    allIds.push(id);
    if (since && isoOf_(r[idx[STAMP]]) <= since) return; // unchanged since the app last looked
    var o = {};
    COLUMNS.forEach(function (c) {
      var v = r[idx[c]];
      o[c] = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : v;
    });
    rows.push(o);
  });
  return { ok: true, rows: rows, ids: allIds, sheet: sh.getName(), serverTime: serverTime, full: !since };
}

/**
 * Simple trigger: runs by itself when a person edits the Sheet. Marks the touched rows as changed so
 * the app picks them up on its next (incremental) sync. Edits made by this script don't fire it.
 */
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    var width = Math.max(sh.getLastColumn(), 1);
    var head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
    var stamp = head.indexOf(STAMP);
    if (stamp < 0 || head.indexOf("Ticket_ID") < 0) return; // not our data tab
    var firstRow = Math.max(e.range.getRow(), 2), lastRow = e.range.getLastRow();
    if (lastRow < firstRow) return;
    var onlyStamp = e.range.getColumn() === stamp + 1 && e.range.getNumColumns() === 1;
    if (onlyStamp) return;
    var now = new Date().toISOString(), n = lastRow - firstRow + 1, out = [];
    for (var i = 0; i < n; i++) out.push([now]);
    sh.getRange(firstRow, stamp + 1, n, 1).setNumberFormat("@").setValues(out);
  } catch (err) { /* a trigger must never throw */ }
}

// ---------- photos (kept apart from the row sync so a slow upload can never block a ticket) ----------
function photoFolder_() {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}
function photoPut_(req) {
  var ticket = String(req.ticket || ""), kind = req.kind === "label" ? "label" : req.kind === "front" ? "front" : "";
  if (!ticket || !kind) return { ok: false, code: "bad_input", error: "Bad request" };
  var sh = sheet_(), L = layout_(sh), idx = L.idx, last = sh.getLastRow();
  var ids = last > 1 ? sh.getRange(2, idx.Ticket_ID + 1, last - 1, 1).getValues() : [];
  var at = -1;
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === ticket) { at = i + 2; break; }
  if (at < 0) return { ok: false, code: "no_row", error: "Send the ticket first" };
  var url = savephoto_(String(req.data || ""), ticket + "-" + kind);
  if (!url) return { ok: false, error: "Not a valid JPEG/PNG" };
  var col = kind === "front" ? idx.Photo_URL_Front : idx.Photo_URL_Label;
  sh.getRange(at, col + 1).setNumberFormat("@").setValue(url);
  sh.getRange(at, idx[STAMP] + 1).setNumberFormat("@").setValue(new Date().toISOString());
  return { ok: true, url: url };
}
/** Returns a photo this script stored, so a new/cleared phone can show it again. Only files inside our own photo folder. */
function photoGet_(req) {
  var m = /[-\w]{25,}/.exec(String(req.url || ""));
  if (!m) return { ok: false, code: "bad_input", error: "Bad request" };
  var file;
  try { file = DriveApp.getFileById(m[0]); } catch (err) { return { ok: false, code: "not_found", error: "Photo not found" }; }
  var folderId = photoFolder_().getId(), inFolder = false, parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folderId) { inFolder = true; break; }
  if (!inFolder) return { ok: false, code: "forbidden", error: "Not one of this app's photos" }; // never expose other Drive files
  if (file.getSize() > MAX_PHOTO_BYTES) return { ok: false, error: "Photo too large" };
  var blob = file.getBlob();
  return { ok: true, data: "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes()) };
}

// Browsers/links hitting the URL get nothing useful; the app talks to the script with POST + secret.
function doGet() { return json_({ ok: false, error: "POST only" }); }
