import { SCRIPT_URL } from '../data/homestayData';

const CUSTOM_SCRIPT_URL_STORAGE_KEY = 'ss_homestay_custom_script_url_v1';

export function getActiveScriptUrl(): string {
  try {
    const custom = localStorage.getItem(CUSTOM_SCRIPT_URL_STORAGE_KEY)?.trim();
    if (custom && /^https:\/\/script\.google\.com\/macros\/s\/.+/i.test(custom)) {
      return custom;
    }
  } catch {
    // ignore storage access issues
  }
  return SCRIPT_URL;
}

export function hasCustomScriptUrl(): boolean {
  try {
    const custom = localStorage.getItem(CUSTOM_SCRIPT_URL_STORAGE_KEY)?.trim();
    return Boolean(custom && custom !== SCRIPT_URL);
  } catch {
    return false;
  }
}

export function saveCustomScriptUrl(url: string): { ok: boolean; error?: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    resetCustomScriptUrl();
    return { ok: true };
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(trimmed)) {
    return {
      ok: false,
      error:
        'URL tidak sah. Sila pastikan ia bermula dengan https://script.google.com/macros/s/... dan berakhir dengan /exec',
    };
  }
  try {
    localStorage.setItem(CUSTOM_SCRIPT_URL_STORAGE_KEY, trimmed);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Gagal menyimpan URL ke pelayar.' };
  }
}

export function resetCustomScriptUrl(): void {
  try {
    localStorage.removeItem(CUSTOM_SCRIPT_URL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isoToSheetSlashDate(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return '';
  const parts = trimmed.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return trimmed;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

export interface SheetRowMutationInput {
  rowNumber: number;
  tab?: string;
  originalTimestamp: string;
  originalNama: string;
  timestamp: string;
  nama: string;
  noTelefon: string;
  tarikhMasukIso: string;
  tarikhKeluarIso: string;
  pilihanCode: string;
  jumlah: number | '';
  perkara: string;
  wangKeluar: number | '';
}

export interface SheetMutationResult {
  ok: boolean;
  actionConfirmed?: 'update' | 'delete';
  needsScriptUpgrade?: boolean;
  error?: string;
  updatedRow?: number;
  deletedRow?: number;
  scriptVersion?: number;
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Update an existing row in Google Sheet via Apps Script POST (action: "update").
 */
export async function updateSheetRow(
  input: SheetRowMutationInput
): Promise<SheetMutationResult> {
  const masukSlash = isoToSheetSlashDate(input.tarikhMasukIso);
  const keluarSlash = isoToSheetSlashDate(input.tarikhKeluarIso);
  const jumlahVal: number | '' =
    typeof input.jumlah === 'number' && Number.isFinite(input.jumlah) && input.jumlah > 0
      ? Math.round(input.jumlah * 100) / 100
      : '';
  const wangKeluarVal: number | '' =
    typeof input.wangKeluar === 'number' &&
    Number.isFinite(input.wangKeluar) &&
    input.wangKeluar > 0
      ? Math.round(input.wangKeluar * 100) / 100
      : '';

  const rowArray: (string | number)[] = [
    input.timestamp,
    input.nama.trim(),
    input.noTelefon.trim(),
    masukSlash,
    keluarSlash,
    input.pilihanCode.trim(),
    jumlahVal,
    input.perkara.trim(),
    wangKeluarVal,
  ];

  const payload = {
    action: 'update',
    tab: input.tab || 'Form Responses 1',
    rowNumber: input.rowNumber,
    rowIndex: input.rowNumber,
    originalTimestamp: input.originalTimestamp,
    originalNama: input.originalNama,
    row: rowArray,
    values: [rowArray],
    Timestamp: input.timestamp,
    NAMA: input.nama.trim(),
    'NO. TELEFON': input.noTelefon.trim(),
    'TARIKH MASUK': masukSlash,
    'TARIKH KELUAR': keluarSlash,
    'PILIHAN MENGINAP': input.pilihanCode.trim(),
    JUMLAH: jumlahVal,
    PERKARA: input.perkara.trim(),
    'WANG KELUAR': wangKeluarVal,
    nama: input.nama.trim(),
    telefon: input.noTelefon.trim(),
    masuk: masukSlash,
    keluar: keluarSlash,
    pilihan: input.pilihanCode.trim(),
    jumlah: jumlahVal,
    perkara: input.perkara.trim(),
    wangKeluar: wangKeluarVal,
  };

  try {
    const res = await fetch(getActiveScriptUrl(), {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    const json = parseJsonSafe(rawText);

    if (json) {
      const scriptVersion =
        typeof json.scriptVersion === 'number' ? json.scriptVersion : undefined;
      const returnedAction = String(json.action ?? '').toLowerCase();

      if (json.ok === false) {
        const errMsg = String(json.error || 'Pelayan Google Sheet menolak kemaskini.');
        const isUnsupported =
          /unknown action|unsupported|tidak disokong|not supported/i.test(errMsg) ||
          (scriptVersion !== undefined && scriptVersion < 10);
        return {
          ok: false,
          needsScriptUpgrade: isUnsupported,
          error: errMsg,
          scriptVersion,
        };
      }

      if (returnedAction === 'update' || returnedAction === 'updated' || json.updatedRow) {
        return {
          ok: true,
          actionConfirmed: 'update',
          updatedRow: Number(json.updatedRow ?? input.rowNumber),
          scriptVersion,
        };
      }

      // If old v9 script ignored action:'update' and appended instead
      if (
        returnedAction === 'append' ||
        returnedAction === 'appended' ||
        (scriptVersion !== undefined && scriptVersion < 10)
      ) {
        return {
          ok: false,
          needsScriptUpgrade: true,
          scriptVersion,
          error:
            'Skrip Google Sheet semasa belum menyokong tindakan "update" (kemaskini baris). Sila kemaskini Apps Script ke versi v10.',
        };
      }

      if (json.ok === true) {
        return { ok: true, scriptVersion };
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `Ralat pelayan (${res.status}). Sila semak sambungan atau versi Apps Script.`,
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('Ralat updateSheetRow:', err);
    return {
      ok: false,
      error:
        'Gagal berhubung dengan Google Apps Script. Sila semak sambungan internet dan tetapan Deploy (Who has access: Anyone).',
    };
  }
}

export interface SheetRowDeleteInput {
  rowNumber: number;
  tab?: string;
  originalTimestamp: string;
  originalNama: string;
}

/**
 * Delete an existing row in Google Sheet via Apps Script POST (action: "delete").
 */
export async function deleteSheetRow(
  input: SheetRowDeleteInput
): Promise<SheetMutationResult> {
  const payload = {
    action: 'delete',
    tab: input.tab || 'Form Responses 1',
    rowNumber: input.rowNumber,
    rowIndex: input.rowNumber,
    originalTimestamp: input.originalTimestamp,
    originalNama: input.originalNama,
  };

  try {
    const res = await fetch(getActiveScriptUrl(), {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    const json = parseJsonSafe(rawText);

    if (json) {
      const scriptVersion =
        typeof json.scriptVersion === 'number' ? json.scriptVersion : undefined;
      const returnedAction = String(json.action ?? '').toLowerCase();

      if (json.ok === false) {
        const errMsg = String(json.error || 'Pelayan Google Sheet menolak pemadaman baris.');
        const isUnsupported =
          /unknown action|unsupported|tidak disokong|not supported/i.test(errMsg) ||
          (scriptVersion !== undefined && scriptVersion < 10);
        return {
          ok: false,
          needsScriptUpgrade: isUnsupported,
          error: errMsg,
          scriptVersion,
        };
      }

      if (returnedAction === 'delete' || returnedAction === 'deleted' || json.deletedRow) {
        return {
          ok: true,
          actionConfirmed: 'delete',
          deletedRow: Number(json.deletedRow ?? input.rowNumber),
          scriptVersion,
        };
      }

      if (
        returnedAction === 'append' ||
        returnedAction === 'appended' ||
        (scriptVersion !== undefined && scriptVersion < 10)
      ) {
        return {
          ok: false,
          needsScriptUpgrade: true,
          scriptVersion,
          error:
            'Skrip Google Sheet semasa belum menyokong tindakan "delete" (padam baris). Sila kemaskini Apps Script ke versi v10.',
        };
      }

      if (json.ok === true) {
        return { ok: true, scriptVersion };
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `Ralat pelayan (${res.status}). Sila semak sambungan atau versi Apps Script.`,
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('Ralat deleteSheetRow:', err);
    return {
      ok: false,
      error:
        'Gagal berhubung dengan Google Apps Script. Sila semak sambungan internet dan tetapan Deploy (Who has access: Anyone).',
    };
  }
}

/**
 * Production-ready Google Apps Script v10 supporting GET + POST (append, update, delete)
 * with LockService concurrency protection and row-match safety verification.
 */
export const GOOGLE_APPS_SCRIPT_V10_CODE = `// SS Homestay & Roomstay — Google Apps Script v10 (Baca, Tambah, Edit & Padam)
// Tampal kod ini ke dalam Google Sheet > Extensions > Apps Script > Code.gs
// Kemudian klik Deploy > Manage deployments > Edit (ikon pensel) > Version: New version > Deploy

var SCRIPT_VERSION = 10;
var DEFAULT_TAB_NAME = 'Form Responses 1';

function getTargetSheet_(tabName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = tabName ? ss.getSheetByName(tabName) : null;
  if (!sheet) {
    sheet = ss.getSheetByName(DEFAULT_TAB_NAME) || ss.getSheets()[0];
  }
  return { ss: ss, sheet: sheet };
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var tabParam = e && e.parameter && e.parameter.tab ? e.parameter.tab : DEFAULT_TAB_NAME;
    var ctx = getTargetSheet_(tabParam);
    var values = ctx.sheet.getDataRange().getDisplayValues();
    return jsonOut_({
      ok: true,
      scriptVersion: SCRIPT_VERSION,
      capabilities: ['append', 'update', 'delete'],
      title: ctx.ss.getName(),
      tab: ctx.sheet.getName(),
      values: values
    });
  } catch (err) {
    return jsonOut_({
      ok: false,
      scriptVersion: SCRIPT_VERSION,
      error: String(err)
    });
  }
}

function resolveTargetRow_(sheet, requestedRow, originalTimestamp, originalNama) {
  var lastRow = sheet.getLastRow();
  var rowNum = Number(requestedRow);
  var normTs = String(originalTimestamp || '').trim();
  var normNama = String(originalNama || '').trim().toLowerCase();

  // Semak dahulu baris yang diminta
  if (rowNum >= 2 && rowNum <= lastRow) {
    var currentVals = sheet.getRange(rowNum, 1, 1, 2).getDisplayValues()[0];
    var curTs = String(currentVals[0] || '').trim();
    var curNama = String(currentVals[1] || '').trim().toLowerCase();
    var tsMatches = !normTs || curTs === normTs;
    var namaMatches = !normNama || curNama === normNama;
    if (tsMatches && namaMatches) {
      return rowNum;
    }
  }

  // Jika baris telah beralih (kerana padaman serentak), cari berdasarkan Timestamp + Nama
  if (normTs || normNama) {
    var allCols = sheet.getRange(2, 1, Math.max(0, lastRow - 1), 2).getDisplayValues();
    for (var i = 0; i < allCols.length; i++) {
      var rTs = String(allCols[i][0] || '').trim();
      var rNama = String(allCols[i][1] || '').trim().toLowerCase();
      if (normTs && rTs === normTs && (!normNama || rNama === normNama)) {
        return i + 2;
      }
    }
  }

  if (rowNum >= 2 && rowNum <= lastRow && !normTs && !normNama) {
    return rowNum;
  }

  return -1;
}

function extractRowArray_(body, colCount) {
  var row = null;
  if (Array.isArray(body.row) && body.row.length > 0) {
    row = body.row.slice();
  } else if (Array.isArray(body.values) && Array.isArray(body.values[0])) {
    row = body.values[0].slice();
  } else {
    row = [
      body.Timestamp || body.timestamp || '',
      body.NAMA || body.nama || '',
      body['NO. TELEFON'] || body.telefon || '',
      body['TARIKH MASUK'] || body.masuk || '',
      body['TARIKH KELUAR'] || body.keluar || '',
      body['PILIHAN MENGINAP'] || body.pilihan || '',
      body.JUMLAH !== undefined ? body.JUMLAH : (body.jumlah !== undefined ? body.jumlah : ''),
      body.PERKARA || body.perkara || '',
      body['WANG KELUAR'] !== undefined ? body['WANG KELUAR'] : (body.wangKeluar !== undefined ? body.wangKeluar : '')
    ];
  }
  while (row.length < colCount) {
    row.push('');
  }
  return row.slice(0, colCount);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonOut_({
      ok: false,
      scriptVersion: SCRIPT_VERSION,
      error: 'Pelayan sedang sibuk. Sila cuba sebentar lagi.'
    });
  }

  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = String(body.action || 'append').toLowerCase();
    var ctx = getTargetSheet_(body.tab || DEFAULT_TAB_NAME);
    var sheet = ctx.sheet;
    var colCount = Math.max(9, sheet.getLastColumn());

    if (action === 'update') {
      var targetRow = resolveTargetRow_(
        sheet,
        body.rowNumber || body.rowIndex,
        body.originalTimestamp,
        body.originalNama
      );
      if (targetRow < 2) {
        return jsonOut_({
          ok: false,
          scriptVersion: SCRIPT_VERSION,
          action: 'update',
          error: 'Baris rekod tidak ditemui atau telah berubah. Sila klik Segar Semula.'
        });
      }
      var updatedValues = extractRowArray_(body, colCount);
      sheet.getRange(targetRow, 1, 1, colCount).setValues([updatedValues]);
      SpreadsheetApp.flush();
      return jsonOut_({
        ok: true,
        scriptVersion: SCRIPT_VERSION,
        action: 'update',
        updatedRow: targetRow
      });
    }

    if (action === 'delete') {
      var deleteRowIdx = resolveTargetRow_(
        sheet,
        body.rowNumber || body.rowIndex,
        body.originalTimestamp,
        body.originalNama
      );
      if (deleteRowIdx < 2) {
        return jsonOut_({
          ok: false,
          scriptVersion: SCRIPT_VERSION,
          action: 'delete',
          error: 'Baris rekod tidak ditemui atau telah pun dipadam. Sila klik Segar Semula.'
        });
      }
      sheet.deleteRow(deleteRowIdx);
      SpreadsheetApp.flush();
      return jsonOut_({
        ok: true,
        scriptVersion: SCRIPT_VERSION,
        action: 'delete',
        deletedRow: deleteRowIdx
      });
    }

    if (action === 'append') {
      var newRow = extractRowArray_(body, colCount);
      sheet.appendRow(newRow);
      SpreadsheetApp.flush();
      return jsonOut_({
        ok: true,
        scriptVersion: SCRIPT_VERSION,
        action: 'append',
        appendedRow: sheet.getLastRow()
      });
    }

    return jsonOut_({
      ok: false,
      scriptVersion: SCRIPT_VERSION,
      error: 'Tindakan tidak disokong: ' + action
    });
  } catch (err) {
    return jsonOut_({
      ok: false,
      scriptVersion: SCRIPT_VERSION,
      error: String(err)
    });
  } finally {
    lock.releaseLock();
  }
}
`;
