import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calculator,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { BookingRecord } from './BookingCalendar';
import { SheetMeta, SheetRowRecord, formatRM } from '../utils/sheetParser';
import { deleteSheetRow, updateSheetRow } from '../utils/sheetApi';
import {
  BookingUnitCode,
  findOverlappingBookings,
  getBookingUnitRaw,
} from '../utils/bookingOverlap';

const UNIT_RATES: Record<BookingUnitCode, number> = {
  H: 300,
  R: 130,
  'H+R': 400,
};

function parseDecimalInput(raw: string): number | '' {
  const cleaned = raw.replace(/RM/gi, '').replace(/\s+/g, '').replace(/,/g, '.');
  if (!cleaned) return '';
  const val = Number.parseFloat(cleaned);
  return Number.isFinite(val) && val >= 0 ? Math.round(val * 100) / 100 : '';
}

function isoToDisplay(iso: string): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

interface EditSheetRowModalProps {
  row: SheetRowRecord;
  bookings: BookingRecord[];
  sheetMeta: SheetMeta | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<unknown> | void;
  onScriptUpgradeNeeded?: () => void;
}

export const EditSheetRowModal: React.FC<EditSheetRowModalProps> = ({
  row,
  bookings,
  sheetMeta,
  onClose,
  onSuccess,
  onRefresh,
  onScriptUpgradeNeeded,
}) => {
  const [nama, setNama] = useState(row.nama);
  const [noTelefon, setNoTelefon] = useState(row.noTelefon);
  const [pilihanCode, setPilihanCode] = useState(row.pilihanCode);
  const [tarikhMasuk, setTarikhMasuk] = useState(row.tarikhMasukIso);
  const [tarikhKeluar, setTarikhKeluar] = useState(row.tarikhKeluarIso);
  const [jumlahStr, setJumlahStr] = useState(row.jumlah > 0 ? String(row.jumlah) : '');
  const [wangKeluarStr, setWangKeluarStr] = useState(
    row.wangKeluar > 0 ? String(row.wangKeluar) : ''
  );
  const [perkara, setPerkara] = useState(row.perkara);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scriptSupportsEdit =
    (sheetMeta?.scriptVersion !== undefined && sheetMeta.scriptVersion >= 10) ||
    Boolean(sheetMeta?.capabilities?.includes('update'));

  const nights = useMemo(() => {
    if (!tarikhMasuk || !tarikhKeluar) return 0;
    const [y1, m1, d1] = tarikhMasuk.split('-').map(Number);
    const [y2, m2, d2] = tarikhKeluar.split('-').map(Number);
    if (!y1 || !y2) return 0;
    const diffMs = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }, [tarikhMasuk, tarikhKeluar]);

  const isBookingUnitCode = (val: string): val is BookingUnitCode =>
    val === 'H' || val === 'R' || val === 'H+R';

  // Overlap check excluding this exact row
  const overlappingOtherBookings = useMemo(() => {
    if (!tarikhMasuk || !tarikhKeluar || nights <= 0 || !isBookingUnitCode(pilihanCode)) {
      return [];
    }
    const otherBookings = bookings.filter((b) => b.rowNumber !== row.rowNumber);
    return findOverlappingBookings(otherBookings, tarikhMasuk, tarikhKeluar, pilihanCode);
  }, [bookings, row.rowNumber, tarikhMasuk, tarikhKeluar, nights, pilihanCode]);

  const handleAutoCalculateTotal = () => {
    if (!isBookingUnitCode(pilihanCode) || nights <= 0) return;
    const computed = nights * UNIT_RATES[pilihanCode];
    setJumlahStr(String(computed));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (tarikhMasuk && tarikhKeluar && tarikhKeluar < tarikhMasuk) {
      setErrorMsg('Tarikh Keluar tidak boleh lebih awal daripada Tarikh Masuk.');
      return;
    }

    const parsedJumlah = parseDecimalInput(jumlahStr);
    const parsedKeluar = parseDecimalInput(wangKeluarStr);

    setSaving(true);
    try {
      const result = await updateSheetRow({
        rowNumber: row.rowNumber,
        tab: sheetMeta?.tab || 'Form Responses 1',
        originalTimestamp: row.timestamp,
        originalNama: row.nama,
        timestamp: row.timestamp,
        nama,
        noTelefon,
        tarikhMasukIso: tarikhMasuk,
        tarikhKeluarIso: tarikhKeluar,
        pilihanCode,
        jumlah: parsedJumlah,
        perkara,
        wangKeluar: parsedKeluar,
      });

      if (!result.ok) {
        if (result.needsScriptUpgrade && onScriptUpgradeNeeded) {
          onScriptUpgradeNeeded();
        }
        setErrorMsg(result.error || 'Gagal mengemaskini rekod dalam Google Sheet.');
        return;
      }

      await onRefresh();
      onSuccess(`Baris #${row.rowNumber} berjaya dikemaskini dalam Google Sheet.`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-row-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h3 id="edit-row-modal-title" className="text-base font-bold text-slate-900">
                Edit Rekod Google Sheet (Baris #{row.rowNumber})
              </h3>
              <p className="text-xs text-slate-500">
                {row.timestamp ? `Timestamp asal: ${row.timestamp}` : 'Rekod sedia ada Google Sheet'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Tutup tetingkap edit"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!scriptSupportsEdit && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Apps Script semasa dikesan sebagai v{sheetMeta?.scriptVersion ?? '?'}.
                </p>
                <p className="mt-0.5 text-amber-800">
                  Pastikan Google Apps Script anda telah dikemaskini ke versi <strong>v10</strong>{' '}
                  supaya tindakan Edit diproses terus pada baris Google Sheet (lihat panduan di tab Urus Data Sheet).
                </p>
              </div>
            </div>
          )}

          {/* Nama & Telefon */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-nama" className="block text-xs font-semibold text-slate-700">
                Nama Tetamu (NAMA)
              </label>
              <input
                id="edit-nama"
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Kosongkan jika rekod perbelanjaan sahaja"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>

            <div>
              <label htmlFor="edit-tel" className="block text-xs font-semibold text-slate-700">
                No. Telefon (NO. TELEFON)
              </label>
              <input
                id="edit-tel"
                type="tel"
                value={noTelefon}
                onChange={(e) => setNoTelefon(e.target.value)}
                placeholder="Contoh: 012-3456789"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          {/* Pilihan Menginap & Tarikh */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="edit-pilihan" className="block text-xs font-semibold text-slate-700">
                Pilihan Menginap
              </label>
              <select
                id="edit-pilihan"
                value={pilihanCode}
                onChange={(e) => setPilihanCode(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">Tiada / Kewangan Sahaja</option>
                <option value="H">H — Homestay (RM 300/mlm)</option>
                <option value="R">R — Roomstay (RM 130/mlm)</option>
                <option value="H+R">H+R — Kombo (RM 400/mlm)</option>
                {pilihanCode &&
                  pilihanCode !== 'H' &&
                  pilihanCode !== 'R' &&
                  pilihanCode !== 'H+R' && (
                    <option value={pilihanCode}>{pilihanCode} (Asal)</option>
                  )}
              </select>
            </div>

            <div>
              <label htmlFor="edit-masuk" className="block text-xs font-semibold text-slate-700">
                Tarikh Masuk
              </label>
              <input
                id="edit-masuk"
                type="date"
                value={tarikhMasuk}
                onChange={(e) => setTarikhMasuk(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>

            <div>
              <label htmlFor="edit-keluar" className="block text-xs font-semibold text-slate-700">
                Tarikh Keluar {nights > 0 && <span className="text-emerald-700">({nights} mlm)</span>}
              </label>
              <input
                id="edit-keluar"
                type="date"
                min={tarikhMasuk || undefined}
                value={tarikhKeluar}
                onChange={(e) => setTarikhKeluar(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          {/* Overlap Warning (excluding current row) */}
          {overlappingOtherBookings.length > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Amaran Pertindihan Tarikh</p>
                <p className="mt-0.5">
                  Tarikh baharu ini bertindan dengan rekod lain:{' '}
                  <span className="font-semibold">
                    {overlappingOtherBookings
                      .map((b) => {
                        const unitTxt = getBookingUnitRaw(b);
                        return `${b.nama}${unitTxt ? ` (${unitTxt})` : ''} [${isoToDisplay(
                          b.masuk
                        )}–${isoToDisplay(b.keluar)}]`;
                      })
                      .join(', ')}
                  </span>
                  . Sila semak sebelum menyimpan.
                </p>
              </div>
            </div>
          )}

          {/* Jumlah (Wang Masuk) & Wang Keluar */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="edit-jumlah" className="block text-xs font-semibold text-slate-700">
                  Jumlah / Wang Masuk (RM)
                </label>
                {isBookingUnitCode(pilihanCode) && nights > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoCalculateTotal}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    <Calculator className="h-3 w-3" />
                    <span>Kira Auto ({formatRM(nights * UNIT_RATES[pilihanCode])})</span>
                  </button>
                )}
              </div>
              <input
                id="edit-jumlah"
                type="text"
                inputMode="decimal"
                value={jumlahStr}
                onChange={(e) => setJumlahStr(e.target.value)}
                placeholder="0 atau kosong"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm font-semibold text-emerald-800 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="edit-wang-keluar"
                className="block text-xs font-semibold text-slate-700"
              >
                Wang Keluar / Perbelanjaan (RM)
              </label>
              <input
                id="edit-wang-keluar"
                type="text"
                inputMode="decimal"
                value={wangKeluarStr}
                onChange={(e) => setWangKeluarStr(e.target.value)}
                placeholder="0 atau kosong"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm font-semibold text-rose-800 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          {/* Perkara */}
          <div>
            <label htmlFor="edit-perkara" className="block text-xs font-semibold text-slate-700">
              Perkara / Catatan (PERKARA)
            </label>
            <input
              id="edit-perkara"
              type="text"
              value={perkara}
              onChange={(e) => setPerkara(e.target.value)}
              placeholder="Contoh: Kelantan · Ruj: Maybank, atau Bil Elektrik TNB"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan ke Google Sheet...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteSheetRowModalProps {
  row: SheetRowRecord;
  sheetMeta: SheetMeta | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<unknown> | void;
  onScriptUpgradeNeeded?: () => void;
}

export const DeleteSheetRowModal: React.FC<DeleteSheetRowModalProps> = ({
  row,
  sheetMeta,
  onClose,
  onSuccess,
  onRefresh,
  onScriptUpgradeNeeded,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scriptSupportsDelete =
    (sheetMeta?.scriptVersion !== undefined && sheetMeta.scriptVersion >= 10) ||
    Boolean(sheetMeta?.capabilities?.includes('delete'));

  const handleConfirmDelete = async () => {
    setErrorMsg(null);
    setDeleting(true);
    try {
      const result = await deleteSheetRow({
        rowNumber: row.rowNumber,
        tab: sheetMeta?.tab || 'Form Responses 1',
        originalTimestamp: row.timestamp,
        originalNama: row.nama,
      });

      if (!result.ok) {
        if (result.needsScriptUpgrade && onScriptUpgradeNeeded) {
          onScriptUpgradeNeeded();
        }
        setErrorMsg(result.error || 'Gagal memadam rekod daripada Google Sheet.');
        return;
      }

      await onRefresh();
      onSuccess(`Baris #${row.rowNumber} berjaya dipadam daripada Google Sheet.`);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-row-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-rose-50/70 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <h3 id="delete-row-modal-title" className="text-base font-bold text-slate-900">
                Sahkan Pemadaman Baris #{row.rowNumber}
              </h3>
              <p className="text-xs text-rose-700">
                Tindakan ini memadam rekod secara kekal dalam Google Sheet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700 transition-colors"
            aria-label="Tutup tetingkap padam"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!scriptSupportsDelete && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Apps Script semasa dikesan sebagai v{sheetMeta?.scriptVersion ?? '?'}.
                </p>
                <p className="mt-0.5 text-amber-800">
                  Pastikan Google Apps Script anda telah dikemaskini ke versi <strong>v10</strong>{' '}
                  supaya tindakan Padam diproses terus pada Google Sheet.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Baris Google Sheet</span>
              <span className="font-mono-num font-bold text-slate-900">#{row.rowNumber}</span>
            </div>
            {row.nama && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Nama Tetamu</span>
                <span className="font-semibold text-slate-900">{row.nama}</span>
              </div>
            )}
            {row.noTelefon && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">No. Telefon</span>
                <span className="font-mono-num text-slate-800">{row.noTelefon}</span>
              </div>
            )}
            {row.pilihanLabel && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Unit</span>
                <span className="font-semibold text-slate-800">{row.pilihanLabel}</span>
              </div>
            )}
            {(row.tarikhMasukDisplay || row.tarikhKeluarDisplay) && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Tarikh</span>
                <span className="font-mono-num text-slate-800">
                  {row.tarikhMasukDisplay || '—'}
                  {row.tarikhKeluarDisplay ? ` → ${row.tarikhKeluarDisplay}` : ''}
                </span>
              </div>
            )}
            {row.jumlah > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Wang Masuk (Jumlah)</span>
                <span className="font-mono-num font-bold text-emerald-700">
                  {formatRM(row.jumlah)}
                </span>
              </div>
            )}
            {row.wangKeluar > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Wang Keluar</span>
                <span className="font-mono-num font-bold text-rose-700">
                  {formatRM(row.wangKeluar)}
                </span>
              </div>
            )}
            {row.perkara && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">Perkara</span>
                <span className="text-right font-medium text-slate-800">{row.perkara}</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition-colors"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memadam Rekod...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Ya, Padam daripada Google Sheet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
