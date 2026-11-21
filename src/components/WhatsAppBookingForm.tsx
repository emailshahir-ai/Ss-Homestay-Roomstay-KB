import React, { useEffect, useMemo, useState } from 'react';
import { Ban, MessageCircle } from 'lucide-react';
import {
  buildGuestBookingMessage,
  buildWhatsAppUrl,
  formatDisplayPhone,
} from '../utils/whatsapp';
import type { BookingRecord } from './BookingCalendar';
import {
  BookingUnitCode,
  findOverlappingBookings,
  getBookingUnitRaw,
} from '../utils/bookingOverlap';

interface WhatsAppBookingFormProps {
  savedOwnerPhone: string;
  prefilledCheckIn?: string | null;
  bookings?: BookingRecord[];
}

const UNIT_OPTIONS: { id: string; label: string; rate: number; code: BookingUnitCode }[] = [
  { id: 'Homestay (3 Bilik + Private Pool)', label: 'Homestay (3 Bilik + Private Pool)', rate: 300, code: 'H' },
  { id: 'Roomstay', label: 'Roomstay (Bilik Persinggahan)', rate: 130, code: 'R' },
  { id: 'Homestay & Roomstay', label: 'Homestay & Roomstay (Kombo)', rate: 400, code: 'H+R' },
];

function formatIsoDisplay(iso: string): string {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export const WhatsAppBookingForm: React.FC<WhatsAppBookingFormProps> = ({
  savedOwnerPhone,
  prefilledCheckIn,
  bookings = [],
}) => {
  const [nama, setNama] = useState('');
  const [telefon, setTelefon] = useState('');
  const [unit, setUnit] = useState(UNIT_OPTIONS[0].id);
  const [tarikhMasuk, setTarikhMasuk] = useState(() => getTodayIso());
  const [tarikhKeluar, setTarikhKeluar] = useState(() => addDaysIso(getTodayIso(), 1));
  const [bilTetamu, setBilTetamu] = useState('');
  const [catatan, setCatatan] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (prefilledCheckIn) {
      setTarikhMasuk(prefilledCheckIn);
      setTarikhKeluar(addDaysIso(prefilledCheckIn, 1));
      setFormError(null);
    }
  }, [prefilledCheckIn]);

  const nights = useMemo(() => {
    if (!tarikhMasuk || !tarikhKeluar) return 0;
    const [y1, m1, d1] = tarikhMasuk.split('-').map(Number);
    const [y2, m2, d2] = tarikhKeluar.split('-').map(Number);
    if (!y1 || !y2) return 0;
    const diffMs = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }, [tarikhMasuk, tarikhKeluar]);

  const selectedUnitObj = UNIT_OPTIONS.find((u) => u.id === unit) || UNIT_OPTIONS[0];
  const estimatedTotal = nights > 0 ? nights * selectedUnitObj.rate : 0;

  const overlappingBookings = useMemo(() => {
    if (!tarikhMasuk || !tarikhKeluar || nights <= 0) return [];
    return findOverlappingBookings(bookings, tarikhMasuk, tarikhKeluar, selectedUnitObj.code);
  }, [bookings, tarikhMasuk, tarikhKeluar, nights, selectedUnitObj.code]);

  const hasOverlap = overlappingBookings.length > 0;

  const isValid =
    !hasOverlap &&
    nama.trim().length >= 2 &&
    Boolean(tarikhMasuk) &&
    Boolean(tarikhKeluar) &&
    nights > 0;

  const waUrl = useMemo(() => {
    const message = buildGuestBookingMessage({
      nama: nama || 'Tetamu',
      telefon,
      unit,
      tarikhMasuk,
      tarikhKeluar,
      bilTetamu,
      catatan,
      nights,
      estimatedTotal,
    });
    return buildWhatsAppUrl(savedOwnerPhone, message);
  }, [
    nama,
    telefon,
    unit,
    tarikhMasuk,
    tarikhKeluar,
    bilTetamu,
    catatan,
    nights,
    estimatedTotal,
    savedOwnerPhone,
  ]);

  const handleCheckInChange = (val: string) => {
    setTarikhMasuk(val);
    if (val && (!tarikhKeluar || tarikhKeluar <= val)) {
      setTarikhKeluar(addDaysIso(val, 1));
    }
    setFormError(null);
  };

  const handleClickSubmit = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasOverlap) {
      e.preventDefault();
      setFormError('Tarikh yang dipilih telah ditempah dan bertindan. Sila pilih tarikh atau unit lain.');
      return;
    }
    if (!nama.trim() || nama.trim().length < 2) {
      e.preventDefault();
      setFormError('Sila masukkan nama penuh anda terlebih dahulu.');
      return;
    }
    if (!tarikhMasuk || !tarikhKeluar || nights <= 0) {
      e.preventDefault();
      setFormError('Tarikh keluar mestilah selepas tarikh masuk.');
      return;
    }
    setFormError(null);
  };

  const displayOwnerPhone = formatDisplayPhone(savedOwnerPhone) || '016-986 7367';

  return (
    <section
      id="borang-whatsapp-tempahan"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Borang Tempahan WhatsApp
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Isi butiran penginapan di bawah dan hantar tempahan terus ke WhatsApp{' '}
            <span className="font-mono-num font-semibold text-slate-900">{displayOwnerPhone}</span>.
          </p>
        </div>

        {/* Paparan Harga Homestay & Roomstay */}
        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setUnit(UNIT_OPTIONS[0].id)}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
              unit === UNIT_OPTIONS[0].id
                ? 'border-emerald-600 bg-emerald-50/80'
                : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Homestay</p>
              <p className="text-[11px] text-slate-500">3 Bilik Air-Cond + Private Pool</p>
            </div>
            <p className="font-mono-num text-sm sm:text-base font-extrabold text-emerald-700 whitespace-nowrap shrink-0">
              RM300<span className="text-xs font-semibold text-slate-600">/Malam</span>
            </p>
          </button>

          <button
            type="button"
            onClick={() => setUnit(UNIT_OPTIONS[1].id)}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
              unit === UNIT_OPTIONS[1].id
                ? 'border-purple-600 bg-purple-50/80'
                : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Roomstay</p>
              <p className="text-[11px] text-slate-500">Bilik Persinggahan Selesa</p>
            </div>
            <p className="font-mono-num text-sm sm:text-base font-extrabold text-purple-700 whitespace-nowrap shrink-0">
              RM130<span className="text-xs font-semibold text-slate-600">/Malam</span>
            </p>
          </button>

          <button
            type="button"
            onClick={() => setUnit(UNIT_OPTIONS[2].id)}
            className={`sm:col-span-2 lg:col-span-1 flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
              unit === UNIT_OPTIONS[2].id
                ? 'border-amber-600 bg-amber-50/80'
                : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Homestay &amp; Roomstay</p>
              <p className="text-[11px] text-slate-500">Pakej Kombo Lengkap</p>
            </div>
            <p className="font-mono-num text-sm sm:text-base font-extrabold text-amber-700 whitespace-nowrap shrink-0">
              RM400<span className="text-xs font-semibold text-slate-600">/Malam</span>
            </p>
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="wa-nama" className="block text-xs font-semibold text-slate-700">
            Nama Penuh <span className="text-rose-600">*</span>
          </label>
          <input
            id="wa-nama"
            type="text"
            value={nama}
            onChange={(e) => {
              setNama(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="Contoh: Ahmad bin Ali"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>

        <div>
          <label htmlFor="wa-telefon" className="block text-xs font-semibold text-slate-700">
            No. Telefon Anda
          </label>
          <input
            id="wa-telefon"
            type="tel"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            placeholder="Contoh: 012-3456789"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>

        <div>
          <label htmlFor="wa-unit" className="block text-xs font-semibold text-slate-700">
            Pilihan Penginapan
          </label>
          <select
            id="wa-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} (RM {opt.rate}/mlm)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="wa-masuk" className="block text-xs font-semibold text-slate-700">
            Tarikh Masuk <span className="text-rose-600">*</span>
          </label>
          <input
            id="wa-masuk"
            type="date"
            value={tarikhMasuk}
            onChange={(e) => handleCheckInChange(e.target.value)}
            className={`mt-1.5 w-full rounded-lg border px-3 py-2 font-mono-num text-sm text-slate-900 focus:outline-none focus:ring-2 ${
              hasOverlap
                ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-600/20'
                : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/20'
            }`}
          />
        </div>

        <div>
          <label htmlFor="wa-keluar" className="block text-xs font-semibold text-slate-700">
            Tarikh Keluar <span className="text-rose-600">*</span>
          </label>
          <input
            id="wa-keluar"
            type="date"
            value={tarikhKeluar}
            min={tarikhMasuk ? addDaysIso(tarikhMasuk, 1) : undefined}
            onChange={(e) => {
              setTarikhKeluar(e.target.value);
              if (formError) setFormError(null);
            }}
            className={`mt-1.5 w-full rounded-lg border px-3 py-2 font-mono-num text-sm text-slate-900 focus:outline-none focus:ring-2 ${
              hasOverlap
                ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-600/20'
                : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/20'
            }`}
          />
        </div>

        <div>
          <label htmlFor="wa-tetamu" className="block text-xs font-semibold text-slate-700">
            Bilangan Tetamu (Pilihan)
          </label>
          <input
            id="wa-tetamu"
            type="number"
            min="1"
            max="30"
            value={bilTetamu}
            onChange={(e) => setBilTetamu(e.target.value)}
            placeholder="Contoh: 6"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="wa-catatan" className="block text-xs font-semibold text-slate-700">
            Catatan Tambahan (Pilihan)
          </label>
          <input
            id="wa-catatan"
            type="text"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: Permintaan extra toto, jangkaan masa ketibaan, dll."
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
      </div>

      {hasOverlap && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900"
        >
          <Ban className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-rose-800">Tarikh Telah Ditempah</p>
            <p className="text-rose-800">
              Tarikh yang dipilih bertindan dengan rekod tempahan sedia ada:{' '}
              <span className="font-semibold">
                {overlappingBookings
                  .map((b) => {
                    const unitText = getBookingUnitRaw(b) || 'Penginapan';
                    return `${unitText} (${formatIsoDisplay(b.masuk)}–${formatIsoDisplay(
                      b.keluar
                    )})`;
                  })
                  .join(', ')}
              </span>
              .
            </p>
            <p className="font-semibold text-rose-700">
              Tempahan tidak boleh diteruskan bagi tarikh ini. Sila pilih tarikh atau pilihan penginapan lain.
            </p>
          </div>
        </div>
      )}

      {formError && !hasOverlap && (
        <p className="mt-3 text-sm font-medium text-rose-600" role="alert">
          {formError}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          Waktu Masuk: 3:00 Petang · Waktu Keluar: 12:00 Tengah hari · Kadar musim perayaan mungkin berbeza.
        </p>
        {hasOverlap ? (
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-100 px-5 py-2.5 text-sm font-semibold text-rose-700 whitespace-nowrap shrink-0"
          >
            <Ban className="h-4 w-4" />
            <span>Tarikh Telah Ditempah</span>
          </button>
        ) : (
          <a
            href={isValid && waUrl ? waUrl : '#borang-whatsapp-tempahan'}
            target={isValid && waUrl ? '_blank' : undefined}
            rel={isValid && waUrl ? 'noopener noreferrer' : undefined}
            onClick={handleClickSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Hantar Tempahan ke WhatsApp</span>
          </a>
        )}
      </div>
    </section>
  );
};
