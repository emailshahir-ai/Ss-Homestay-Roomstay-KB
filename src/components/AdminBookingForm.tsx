import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RotateCcw,
  Save,
} from 'lucide-react';
import { SCRIPT_URL } from '../data/homestayData';
import { FinancialRecord, SheetMeta, formatRM } from '../utils/sheetParser';
import { BookingRecord } from './BookingCalendar';
import {
  buildAdminConfirmationMessage,
  buildWhatsAppUrl,
  formatDisplayPhone,
  normalizeMalaysiaPhone,
} from '../utils/whatsapp';

interface AdminBookingFormProps {
  bookings: BookingRecord[];
  sheetMeta: SheetMeta | null;
  onRefresh: () => Promise<FinancialRecord[] | null> | void;
}

interface UnitOption {
  code: 'H' | 'R' | 'H+R';
  title: string;
  rate: number;
  displayLabel: string;
}

const UNIT_OPTIONS: UnitOption[] = [
  { code: 'H', title: 'Ss Homestay', rate: 300, displayLabel: 'Homestay' },
  { code: 'R', title: 'Ss Roomstay', rate: 130, displayLabel: 'Roomstay' },
  { code: 'H+R', title: 'Kombo (H + R)', rate: 400, displayLabel: 'Homestay & Roomstay' },
];

const MALAYSIA_STATES = [
  'Kelantan',
  'Terengganu',
  'Pahang',
  'Selangor',
  'WP Kuala Lumpur',
  'WP Putrajaya',
  'Johor',
  'Kedah',
  'Melaka',
  'Negeri Sembilan',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'WP Labuan',
  'Luar Negara',
];

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function isoToDisplay(iso: string): string {
  if (!iso) return 'Belum dipilih';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isoToSheetSlashDate(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return iso;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function formatNowSheetTimestamp(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${String(
    d.getMinutes()
  ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function parseDecimalInput(raw: string): number {
  const cleaned = raw.replace(/RM/gi, '').replace(/\s+/g, '').replace(/,/g, '.');
  const val = Number.parseFloat(cleaned);
  return Number.isFinite(val) && val >= 0 ? Math.round(val * 100) / 100 : 0;
}

interface SavedConfirmation {
  nama: string;
  noTelefon: string;
  unitLabel: string;
  tarikhMasuk: string;
  tarikhKeluar: string;
  jumlah: number;
  verified: boolean;
}

export const AdminBookingForm: React.FC<AdminBookingFormProps> = ({
  bookings,
  sheetMeta,
  onRefresh,
}) => {
  const [selectedCode, setSelectedCode] = useState<'H' | 'R' | 'H+R'>('H');
  const [nama, setNama] = useState('');
  const [noTelefon, setNoTelefon] = useState('');
  const [negeri, setNegeri] = useState('Kelantan');
  const [tarikhMasuk, setTarikhMasuk] = useState('');
  const [tarikhKeluar, setTarikhKeluar] = useState('');
  const [rujukanBayaran, setRujukanBayaran] = useState('');
  const [diskaunInput, setDiskaunInput] = useState('');
  const [manualJumlah, setManualJumlah] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedConfirmation, setSavedConfirmation] = useState<SavedConfirmation | null>(null);

  const selectedUnit = UNIT_OPTIONS.find((u) => u.code === selectedCode) || UNIT_OPTIONS[0];

  const nights = useMemo(() => {
    if (!tarikhMasuk || !tarikhKeluar) return 0;
    const [y1, m1, d1] = tarikhMasuk.split('-').map(Number);
    const [y2, m2, d2] = tarikhKeluar.split('-').map(Number);
    if (!y1 || !y2) return 0;
    const diffMs = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }, [tarikhMasuk, tarikhKeluar]);

  const subtotal = nights * selectedUnit.rate;
  const diskaunNum = parseDecimalInput(diskaunInput);
  const autoJumlah = Math.max(0, Math.round((subtotal - diskaunNum) * 100) / 100);

  const effectiveJumlah =
    manualJumlah !== null && manualJumlah.trim() !== ''
      ? parseDecimalInput(manualJumlah)
      : autoJumlah;

  const displayedJumlahInput =
    manualJumlah !== null ? manualJumlah : nights > 0 ? String(autoJumlah) : '';

  // Check overlapping bookings for selected dates & unit
  const overlappingBookings = useMemo(() => {
    if (!tarikhMasuk || !tarikhKeluar || nights <= 0) return [];
    return bookings.filter((b) => {
      if (!b.masuk || !b.keluar) return false;
      // Overlap check: stay nights [masuk, keluar) intersect
      const dateOverlaps = tarikhMasuk < b.keluar && tarikhKeluar > b.masuk;
      if (!dateOverlaps) return false;
      const bUnit = (b.pilihan || '').toUpperCase();
      if (selectedCode === 'H+R') return true;
      if (bUnit.includes('KEDUA') || bUnit.includes('H+R') || (bUnit.includes('HOMESTAY') && bUnit.includes('ROOMSTAY'))) {
        return true;
      }
      if (selectedCode === 'H') return bUnit.includes('HOMESTAY') || bUnit === 'H';
      if (selectedCode === 'R') return bUnit.includes('ROOMSTAY') || bUnit === 'R';
      return false;
    });
  }, [bookings, tarikhMasuk, tarikhKeluar, nights, selectedCode]);

  const handleSelectUnit = (code: 'H' | 'R' | 'H+R') => {
    setSelectedCode(code);
    setManualJumlah(null);
    setErrorMsg(null);
  };

  const handleCheckInChange = (val: string) => {
    setTarikhMasuk(val);
    if (val && (!tarikhKeluar || tarikhKeluar <= val)) {
      setTarikhKeluar(addDaysIso(val, 1));
    }
    setManualJumlah(null);
    setErrorMsg(null);
  };

  const handleCheckOutChange = (val: string) => {
    setTarikhKeluar(val);
    setManualJumlah(null);
    setErrorMsg(null);
  };

  const handleDiskaunChange = (val: string) => {
    setDiskaunInput(val);
    setManualJumlah(null);
  };

  const handleResetForm = () => {
    setNama('');
    setNoTelefon('');
    setNegeri('Kelantan');
    setTarikhMasuk('');
    setTarikhKeluar('');
    setRujukanBayaran('');
    setDiskaunInput('');
    setManualJumlah(null);
    setErrorMsg(null);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedConfirmation(null);

    if (nama.trim().length < 2) {
      setErrorMsg('Sila masukkan Nama Penuh tetamu.');
      return;
    }
    if (!noTelefon.trim()) {
      setErrorMsg('Sila masukkan No. Telefon tetamu.');
      return;
    }
    if (!tarikhMasuk || !tarikhKeluar) {
      setErrorMsg('Sila pilih Tarikh Masuk dan Tarikh Keluar.');
      return;
    }
    if (nights <= 0) {
      setErrorMsg('Tarikh Keluar mestilah selepas Tarikh Masuk.');
      return;
    }
    if (effectiveJumlah < 0) {
      setErrorMsg('Jumlah bayaran tidak boleh negatif.');
      return;
    }

    setSubmitting(true);

    const timestampStr = formatNowSheetTimestamp();
    const masukSlash = isoToSheetSlashDate(tarikhMasuk);
    const keluarSlash = isoToSheetSlashDate(tarikhKeluar);
    const cleanNama = nama.trim();
    const cleanTel = noTelefon.trim();

    // Compose optional notes for PERKARA column (keeps Google Sheet super informative)
    const noteParts: string[] = [];
    if (negeri) noteParts.push(negeri);
    if (diskaunNum > 0) noteParts.push(`Diskaun ${formatRM(diskaunNum)}`);
    if (rujukanBayaran.trim()) noteParts.push(`Ruj: ${rujukanBayaran.trim()}`);
    const perkaraNote = noteParts.join(' · ');

    // Exact 9-column row matching Google Sheet header:
    // ["Timestamp","NAMA","NO. TELEFON","TARIKH MASUK","TARIKH KELUAR","PILIHAN MENGINAP","JUMLAH","PERKARA","WANG KELUAR"]
    const rowArray: (string | number)[] = [
      timestampStr,
      cleanNama,
      cleanTel,
      masukSlash,
      keluarSlash,
      selectedCode,
      effectiveJumlah,
      perkaraNote,
      '',
    ];

    const payload = {
      action: 'append',
      tab: sheetMeta?.tab || 'Form Responses 1',
      row: rowArray,
      values: [rowArray],
      Timestamp: timestampStr,
      NAMA: cleanNama,
      'NO. TELEFON': cleanTel,
      'TARIKH MASUK': masukSlash,
      'TARIKH KELUAR': keluarSlash,
      'PILIHAN MENGINAP': selectedCode,
      JUMLAH: effectiveJumlah,
      PERKARA: perkaraNote,
      'WANG KELUAR': '',
      nama: cleanNama,
      telefon: cleanTel,
      masuk: masukSlash,
      keluar: keluarSlash,
      pilihan: selectedCode,
      jumlah: effectiveJumlah,
      perkara: perkaraNote,
      wangKeluar: '',
    };

    const verifyBookingSaved = async (): Promise<boolean> => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const refreshed = await onRefresh();
      if (!Array.isArray(refreshed)) return false;
      return refreshed.some(
        (r) =>
          r.nama.trim().toLowerCase() === cleanNama.toLowerCase() &&
          r.tarikhIso === tarikhMasuk &&
          Math.abs(r.wangMasuk - effectiveJumlah) < 0.01
      );
    };

    try {
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      let serverOk = res.ok;
      let serverErr = '';
      try {
        const json = await res.json();
        if (json && typeof json === 'object' && 'ok' in json) {
          serverOk = Boolean(json.ok);
          if (!serverOk && json.error) serverErr = String(json.error);
        }
      } catch {
        // Apps Script redirect may return non-JSON; verified via GET below
      }

      if (!serverOk) {
        throw new Error(serverErr || 'Pelayan Google Sheet menolak simpanan tempahan.');
      }

      const verified = await verifyBookingSaved();
      setSavedConfirmation({
        nama: cleanNama,
        noTelefon: cleanTel,
        unitLabel: selectedUnit.displayLabel,
        tarikhMasuk,
        tarikhKeluar,
        jumlah: effectiveJumlah,
        verified,
      });
      handleResetForm();
    } catch (err) {
      console.error('Ralat POST tempahan, menyemak Google Sheet:', err);
      const verifiedDespiteErr = await verifyBookingSaved();
      if (verifiedDespiteErr) {
        setSavedConfirmation({
          nama: cleanNama,
          noTelefon: cleanTel,
          unitLabel: selectedUnit.displayLabel,
          tarikhMasuk,
          tarikhKeluar,
          jumlah: effectiveJumlah,
          verified: true,
        });
        handleResetForm();
      } else {
        setErrorMsg(
          'Gagal menyimpan tempahan ke Google Sheet. Sila semak sambungan internet dan cuba lagi.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const savedWaUrl =
    savedConfirmation && normalizeMalaysiaPhone(savedConfirmation.noTelefon)
      ? buildWhatsAppUrl(
          savedConfirmation.noTelefon,
          buildAdminConfirmationMessage({
            nama: savedConfirmation.nama,
            unit: savedConfirmation.unitLabel,
            tarikhMasuk: savedConfirmation.tarikhMasuk,
            tarikhKeluar: savedConfirmation.tarikhKeluar,
            jumlah: savedConfirmation.jumlah,
          })
        )
      : '';

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
          Borang Tempahan Admin
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Pilih jenis penginapan dan tarikh untuk pengiraan jumlah automatik serta simpanan terus ke Google Sheet.
        </p>
      </div>

      {/* Post-Save Confirmation Banner with Direct WhatsApp Slip */}
      {savedConfirmation && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-900">
                {savedConfirmation.verified
                  ? 'Tempahan Disahkan Tersimpan dalam Google Sheet!'
                  : 'Tempahan Telah Dihantar ke Google Sheet!'}
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                <strong>{savedConfirmation.nama}</strong> · {savedConfirmation.unitLabel} ·{' '}
                <span className="font-mono-num">
                  {isoToDisplay(savedConfirmation.tarikhMasuk)} →{' '}
                  {isoToDisplay(savedConfirmation.tarikhKeluar)}
                </span>{' '}
                · <strong className="font-mono-num">{formatRM(savedConfirmation.jumlah)}</strong>
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700">
                Kalendar Kekosongan dan Analisis Kewangan (Wang Masuk) telah dikemaskini secara automatik.
              </p>

              {savedWaUrl && (
                <div className="mt-3">
                  <a
                    href={savedWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>
                      Hantar Slip WhatsApp ke {formatDisplayPhone(savedConfirmation.noTelefon)}
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmitBooking} className="mt-5 space-y-5">
        {/* Pilihan Menginap Cards (Matching Reference Screenshot) */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-2">
            Pilihan Menginap <span className="text-rose-600">*</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {UNIT_OPTIONS.map((opt) => {
              const isSelected = selectedCode === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleSelectUnit(opt.code)}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-emerald-700 bg-emerald-50/50 ring-1 ring-emerald-700'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900">{opt.title}</p>
                  <p
                    className={`mt-0.5 font-mono-num text-xs font-medium ${
                      isSelected ? 'text-emerald-800' : 'text-slate-600'
                    }`}
                  >
                    RM {opt.rate} / malam
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nama Penuh */}
        <div>
          <label htmlFor="adm-nama" className="block text-xs font-semibold text-slate-700">
            Nama Penuh <span className="text-rose-600">*</span>
          </label>
          <input
            id="adm-nama"
            type="text"
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Ahmad Syafiq bin Razak"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
          />
        </div>

        {/* No. Telefon & Negeri */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="adm-tel" className="block text-xs font-semibold text-slate-700">
              No. Telefon <span className="text-rose-600">*</span>
            </label>
            <input
              id="adm-tel"
              type="tel"
              required
              value={noTelefon}
              onChange={(e) => setNoTelefon(e.target.value)}
              placeholder="Contoh: 012-3456789"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono-num text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
            />
          </div>

          <div>
            <label htmlFor="adm-negeri" className="block text-xs font-semibold text-slate-700">
              Negeri
            </label>
            <select
              id="adm-negeri"
              value={negeri}
              onChange={(e) => setNegeri(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
            >
              {MALAYSIA_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tarikh Masuk & Tarikh Keluar */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="adm-masuk" className="block text-xs font-semibold text-slate-700">
              Tarikh Masuk <span className="text-rose-600">*</span>
            </label>
            <input
              id="adm-masuk"
              type="date"
              required
              value={tarikhMasuk}
              onChange={(e) => handleCheckInChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono-num text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
            />
          </div>

          <div>
            <label htmlFor="adm-keluar" className="block text-xs font-semibold text-slate-700">
              Tarikh Keluar <span className="text-rose-600">*</span>
            </label>
            <input
              id="adm-keluar"
              type="date"
              required
              min={tarikhMasuk ? addDaysIso(tarikhMasuk, 1) : undefined}
              value={tarikhKeluar}
              onChange={(e) => handleCheckOutChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono-num text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
            />
          </div>
        </div>

        {/* Overlap Warning */}
        {overlappingBookings.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Amaran Pertindihan Tarikh ({selectedUnit.title})</p>
              <p className="mt-0.5 text-amber-800">
                Tarikh ini bertindih dengan tempahan sedia ada:{' '}
                {overlappingBookings
                  .map((b) => `${b.nama} (${isoToDisplay(b.masuk)}–${isoToDisplay(b.keluar)})`)
                  .join(', ')}
                .
              </p>
            </div>
          </div>
        )}

        {/* No. Akaun Bank / Rujukan Pembayaran */}
        <div>
          <label htmlFor="adm-rujukan" className="block text-xs font-semibold text-slate-700">
            No. Akaun Bank / Rujukan Pembayaran (Pilihan)
          </label>
          <input
            id="adm-rujukan"
            type="text"
            value={rujukanBayaran}
            onChange={(e) => setRujukanBayaran(e.target.value)}
            placeholder="Contoh: 1621 0648 9210 (Maybank)"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono-num text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
          />
        </div>

        {/* Diskaun Harga (RM) & Jumlah (RM) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="adm-diskaun" className="block text-xs font-semibold text-slate-700">
              Diskaun Harga (RM)
            </label>
            <input
              id="adm-diskaun"
              type="text"
              inputMode="decimal"
              value={diskaunInput}
              onChange={(e) => handleDiskaunChange(e.target.value)}
              placeholder="0 (Pilihan)"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono-num text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="adm-jumlah" className="block text-xs font-semibold text-slate-700">
                Jumlah (RM)
              </label>
              {manualJumlah !== null && (
                <button
                  type="button"
                  onClick={() => setManualJumlah(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Kira Auto</span>
                </button>
              )}
            </div>
            <input
              id="adm-jumlah"
              type="text"
              inputMode="decimal"
              value={displayedJumlahInput}
              onChange={(e) => setManualJumlah(e.target.value)}
              placeholder={`Contoh: ${selectedUnit.rate}`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono-num text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
            />
          </div>
        </div>

        {/* Summary Receipt Card (Matching Reference Screenshot) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Tarikh Masuk</span>
            <span className="font-mono-num font-semibold text-slate-900">
              {isoToDisplay(tarikhMasuk)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Tarikh Keluar</span>
            <span className="font-mono-num font-semibold text-slate-900">
              {isoToDisplay(tarikhKeluar)}
            </span>
          </div>
          {nights > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Bilangan Hari / Malam</span>
              <span className="font-mono-num font-semibold text-slate-900">
                {nights} malam
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Kadar ({selectedUnit.title})</span>
            <span className="font-mono-num font-semibold text-slate-900">
              RM {selectedUnit.rate} / malam
            </span>
          </div>
          {nights > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Subtotal ({nights} × RM {selectedUnit.rate})</span>
              <span className="font-mono-num font-medium text-slate-700">
                {formatRM(subtotal)}
              </span>
            </div>
          )}
          {diskaunNum > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Diskaun Harga</span>
              <span className="font-mono-num font-semibold text-rose-600">
                -{formatRM(diskaunNum)}
              </span>
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-4">
            <span className="font-bold text-slate-900">Jumlah Perlu Dibayar</span>
            <span className="font-mono-num text-xl font-extrabold text-emerald-700">
              {formatRM(effectiveJumlah)}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleResetForm}
            disabled={submitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Kosongkan Borang
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyimpan Tempahan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Simpan Tempahan ke Google Sheet</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
