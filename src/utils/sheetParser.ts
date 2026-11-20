import { BookingRecord } from '../components/BookingCalendar';

export interface FinancialRecord {
  id: string;
  rowNumber: number;
  timestamp: string;
  tarikhIso: string; // YYYY-MM-DD
  tarikhDisplay: string; // DD/MM/YYYY
  monthKey: string; // YYYY-MM
  nama: string;
  noTelefon: string;
  unit: string;
  tarikhMasuk: string;
  tarikhKeluar: string;
  perkara: string;
  wangMasuk: number; // Mapped from JUMLAH
  wangKeluar: number; // Mapped from WANG KELUAR
  baki: number; // Running balance chronologically
  jenis: 'masuk' | 'keluar' | 'campuran';
}

export interface SheetMeta {
  title?: string;
  tab?: string;
  totalRows: number;
  lastSyncedAt: string;
}

export interface ParsedSheetData {
  bookings: BookingRecord[];
  financialRecords: FinancialRecord[];
  meta: SheetMeta;
}

/**
 * Normalize unit code from Google Sheet (e.g. "H", "R", "H+R") into readable Malay labels.
 */
export function normalizeUnit(raw: unknown): string {
  const val = String(raw ?? '').trim();
  if (!val) return '';
  const upper = val.toUpperCase();
  if (upper === 'H' || upper === 'HOMESTAY') return 'Homestay';
  if (upper === 'R' || upper === 'ROOMSTAY') return 'Roomstay';
  if (upper === 'H+R' || upper === 'R+H' || upper.includes('KEDUA')) {
    return 'Homestay & Roomstay';
  }
  return val;
}

/**
 * Safely parse numeric currency values (e.g. "270", "RM 1,000.50", "#ERROR!", "").
 */
export function parseRinggit(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const str = String(raw ?? '').trim();
  if (!str || str.startsWith('#')) return 0;
  const cleaned = str.replace(/RM/gi, '').replace(/,/g, '').replace(/\s+/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/**
 * Parse Google Sheets date strings ("M/D/YYYY", "M/D/YYYY H:MM:SS", or "YYYY-MM-DD")
 * into timezone-safe { iso: "YYYY-MM-DD", display: "DD/MM/YYYY", monthKey: "YYYY-MM", sortKey: number }.
 */
export function parseSheetDate(raw: unknown): {
  iso: string;
  display: string;
  monthKey: string;
  sortKey: number;
} | null {
  const str = String(raw ?? '').trim();
  if (!str || str.startsWith('#')) return null;

  // Match ISO format: YYYY-MM-DD (optional time)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return {
        iso: `${year}-${mm}-${dd}`,
        display: `${dd}/${mm}/${year}`,
        monthKey: `${year}-${mm}`,
        sortKey: year * 10000 + month * 100 + day,
      };
    }
  }

  // Match Google Sheets US-style M/D/YYYY (optional time HH:MM:SS)
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    let part1 = Number(slashMatch[1]);
    let part2 = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);

    // Standard Google Sheets Form Responses exports M/D/YYYY; if part1 > 12, swap to D/M/YYYY
    let month = part1;
    let day = part2;
    if (part1 > 12 && part2 <= 12) {
      day = part1;
      month = part2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return {
        iso: `${year}-${mm}-${dd}`,
        display: `${dd}/${mm}/${year}`,
        monthKey: `${year}-${mm}`,
        sortKey: year * 10000 + month * 100 + day,
      };
    }
  }

  // Fallback native Date parse
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return {
      iso: `${year}-${mm}-${dd}`,
      display: `${dd}/${mm}/${year}`,
      monthKey: `${year}-${mm}`,
      sortKey: year * 10000 + month * 100 + day,
    };
  }

  return null;
}

function cleanText(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (str === '#ERROR!' || str === '#N/A' || str === '#VALUE!') return '';
  return str;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toUpperCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toUpperCase());
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h.includes(candidate.toUpperCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function formatRM(amount: number): string {
  const absFormatted = Math.abs(amount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-RM ${absFormatted}` : `RM ${absFormatted}`;
}

/**
 * Parse both the new Google Apps Script matrix format ({ ok, title, tab, values: [][] })
 * and the legacy array-of-objects format.
 */
export function parseSheetResponse(payload: unknown): ParsedSheetData {
  const nowStr = new Date().toLocaleTimeString('ms-MY', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const bookings: BookingRecord[] = [];
  const rawFinancials: Omit<FinancialRecord, 'baki'>[] = [];

  // Format A: { ok: true, title, tab, values: string[][] }
  if (
    payload &&
    typeof payload === 'object' &&
    'values' in payload &&
    Array.isArray((payload as { values: unknown }).values)
  ) {
    const obj = payload as {
      title?: string;
      tab?: string;
      values: unknown[][];
    };
    const rows = obj.values;
    if (rows.length <= 1) {
      return {
        bookings: [],
        financialRecords: [],
        meta: {
          title: obj.title,
          tab: obj.tab,
          totalRows: 0,
          lastSyncedAt: nowStr,
        },
      };
    }

    const headers = rows[0].map((cell) => String(cell ?? ''));
    const idxTimestamp = findColumnIndex(headers, ['TIMESTAMP', 'TARIKH REKOD']);
    const idxNama = findColumnIndex(headers, ['NAMA', 'TETAMU', 'PELANGGAN']);
    const idxTelefon = findColumnIndex(headers, ['NO. TELEFON', 'TELEFON', 'NO TELEFON', 'PHONE']);
    const idxMasuk = findColumnIndex(headers, ['TARIKH MASUK', 'MASUK', 'CHECK IN']);
    const idxKeluar = findColumnIndex(headers, ['TARIKH KELUAR', 'KELUAR', 'CHECK OUT']);
    const idxPilihan = findColumnIndex(headers, [
      'PILIHAN MENGINAP',
      'PILIHAN',
      'UNIT',
      'JENIS',
      'PENGINAPAN',
    ]);
    const idxJumlah = findColumnIndex(headers, ['JUMLAH', 'WANG MASUK', 'BAYARAN', 'HARGA']);
    const idxPerkara = findColumnIndex(headers, ['PERKARA', 'CATATAN', 'KETERANGAN', 'BUTIRAN']);
    const idxWangKeluar = findColumnIndex(headers, ['WANG KELUAR', 'PERBELANJAAN', 'KELUAR (RM)', 'KOS']);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      const timestamp = idxTimestamp !== -1 ? cleanText(row[idxTimestamp]) : '';
      const nama = idxNama !== -1 ? cleanText(row[idxNama]) : '';
      const noTelefon = idxTelefon !== -1 ? cleanText(row[idxTelefon]) : '';
      const rawMasuk = idxMasuk !== -1 ? row[idxMasuk] : '';
      const rawKeluar = idxKeluar !== -1 ? row[idxKeluar] : '';
      const unit = idxPilihan !== -1 ? normalizeUnit(row[idxPilihan]) : '';
      const wangMasuk = idxJumlah !== -1 ? parseRinggit(row[idxJumlah]) : 0;
      const perkaraRaw = idxPerkara !== -1 ? cleanText(row[idxPerkara]) : '';
      const wangKeluar = idxWangKeluar !== -1 ? parseRinggit(row[idxWangKeluar]) : 0;

      const parsedMasuk = parseSheetDate(rawMasuk);
      const parsedKeluar = parseSheetDate(rawKeluar);
      const parsedTimestamp = parseSheetDate(timestamp);

      // Add to Booking Calendar only if it's a valid stay (has guest name & check-in date)
      if (nama && parsedMasuk) {
        bookings.push({
          nama,
          masuk: parsedMasuk.iso,
          keluar: parsedKeluar ? parsedKeluar.iso : parsedMasuk.iso,
          pilihan: unit || 'Penginapan',
          noTelefon,
          jumlah: wangMasuk,
        });
      }

      // Add to Financial Records if there is Wang Masuk (JUMLAH) or Wang Keluar (WANG KELUAR) or explicit Perkara
      if (wangMasuk > 0 || wangKeluar > 0) {
        const effectiveDate = parsedMasuk || parsedTimestamp;
        const tarikhIso = effectiveDate ? effectiveDate.iso : '';
        const tarikhDisplay = effectiveDate ? effectiveDate.display : '-';
        const monthKey = effectiveDate ? effectiveDate.monthKey : 'Lain-lain';

        // Construct clear description for Perkara
        let perkara = perkaraRaw;
        if (!perkara) {
          if (nama) {
            perkara = unit ? `Tempahan ${unit} — ${nama}` : `Tempahan — ${nama}`;
          } else {
            perkara = wangKeluar > 0 ? 'Perbelanjaan Operasi' : 'Bayaran Tempahan';
          }
        }

        const jenis: FinancialRecord['jenis'] =
          wangMasuk > 0 && wangKeluar > 0
            ? 'campuran'
            : wangKeluar > 0
            ? 'keluar'
            : 'masuk';

        rawFinancials.push({
          id: `row-${i + 1}`,
          rowNumber: i + 1,
          timestamp,
          tarikhIso,
          tarikhDisplay,
          monthKey,
          nama,
          noTelefon,
          unit,
          tarikhMasuk: parsedMasuk ? parsedMasuk.display : '',
          tarikhKeluar: parsedKeluar ? parsedKeluar.display : '',
          perkara,
          wangMasuk,
          wangKeluar,
          jenis,
        });
      }
    }

    // Sort chronologically by date (then rowNumber) to compute accurate running balance (Baki)
    rawFinancials.sort((a, b) => {
      if (a.tarikhIso !== b.tarikhIso) {
        return a.tarikhIso.localeCompare(b.tarikhIso);
      }
      return a.rowNumber - b.rowNumber;
    });

    let runningBalance = 0;
    const financialRecords: FinancialRecord[] = rawFinancials.map((rec) => {
      runningBalance += rec.wangMasuk - rec.wangKeluar;
      return {
        ...rec,
        baki: runningBalance,
      };
    });

    return {
      bookings,
      financialRecords,
      meta: {
        title: obj.title,
        tab: obj.tab,
        totalRows: rows.length - 1,
        lastSyncedAt: nowStr,
      },
    };
  }

  // Format B: Legacy Array of Objects
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const rec = item as Record<string, unknown>;
      const nama = cleanText(rec.nama ?? rec.NAMA);
      const parsedMasuk = parseSheetDate(rec.masuk ?? rec['TARIKH MASUK']);
      const parsedKeluar = parseSheetDate(rec.keluar ?? rec['TARIKH KELUAR']);
      const unit = normalizeUnit(
        rec.pilihan ?? rec.jenis ?? rec.unit ?? rec.kategori ?? rec.penginapan ?? rec['PILIHAN MENGINAP']
      );
      const wangMasuk = parseRinggit(rec.jumlah ?? rec.JUMLAH ?? rec.wang_masuk);
      const wangKeluar = parseRinggit(rec.wang_keluar ?? rec['WANG KELUAR'] ?? rec.keluar_rm);
      const perkaraRaw = cleanText(rec.perkara ?? rec.PERKARA);

      if (nama && parsedMasuk) {
        bookings.push({
          nama,
          masuk: parsedMasuk.iso,
          keluar: parsedKeluar ? parsedKeluar.iso : parsedMasuk.iso,
          pilihan: unit || 'Penginapan',
        });
      }

      if (wangMasuk > 0 || wangKeluar > 0) {
        rawFinancials.push({
          id: `row-${index + 2}`,
          rowNumber: index + 2,
          timestamp: cleanText(rec.timestamp ?? rec.Timestamp),
          tarikhIso: parsedMasuk ? parsedMasuk.iso : '',
          tarikhDisplay: parsedMasuk ? parsedMasuk.display : '-',
          monthKey: parsedMasuk ? parsedMasuk.monthKey : 'Lain-lain',
          nama,
          noTelefon: cleanText(rec.telefon ?? rec['NO. TELEFON']),
          unit,
          tarikhMasuk: parsedMasuk ? parsedMasuk.display : '',
          tarikhKeluar: parsedKeluar ? parsedKeluar.display : '',
          perkara: perkaraRaw || (nama ? `Tempahan ${unit || ''} — ${nama}`.trim() : 'Rekod Kewangan'),
          wangMasuk,
          wangKeluar,
          jenis:
            wangMasuk > 0 && wangKeluar > 0
              ? 'campuran'
              : wangKeluar > 0
              ? 'keluar'
              : 'masuk',
        });
      }
    });

    rawFinancials.sort((a, b) => {
      if (a.tarikhIso !== b.tarikhIso) return a.tarikhIso.localeCompare(b.tarikhIso);
      return a.rowNumber - b.rowNumber;
    });

    let runningBalance = 0;
    const financialRecords: FinancialRecord[] = rawFinancials.map((rec) => {
      runningBalance += rec.wangMasuk - rec.wangKeluar;
      return { ...rec, baki: runningBalance };
    });

    return {
      bookings,
      financialRecords,
      meta: {
        totalRows: payload.length,
        lastSyncedAt: nowStr,
      },
    };
  }

  return {
    bookings: [],
    financialRecords: [],
    meta: {
      totalRows: 0,
      lastSyncedAt: nowStr,
    },
  };
}
