import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MessageCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { DAY_SHORT_NAMES, MONTH_NAMES } from '../data/homestayData';

export interface BookingRecord {
  nama: string;
  masuk: string;
  keluar: string;
  pilihan?: string;
  jenis?: string;
  unit?: string;
  kategori?: string;
  penginapan?: string;
  homestay_roomstay?: string;
  noTelefon?: string;
  jumlah?: number;
}

interface BookingCalendarProps {
  bookings: BookingRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectDateForBooking?: (dateIso: string) => void;
}

function getUnitLabel(booking: BookingRecord): string {
  return (
    booking.pilihan ||
    booking.jenis ||
    booking.unit ||
    booking.kategori ||
    booking.penginapan ||
    booking.homestay_roomstay ||
    'Penginapan'
  );
}

function getUnitBadgeClasses(unitLabel: string): string {
  const upper = unitLabel.toUpperCase();
  if (upper.includes('ROOMSTAY')) return 'bg-emerald-600 text-white';
  if (upper.includes('HOMESTAY')) return 'bg-indigo-600 text-white';
  if (upper.includes('KEDUA')) return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

function getDayStatus(booking: BookingRecord, dateStr: string): string {
  if (dateStr === booking.masuk && dateStr === booking.keluar) return 'Masuk / Keluar';
  if (dateStr === booking.masuk) return 'Masuk (M)';
  if (dateStr === booking.keluar) return 'Keluar (K)';
  return 'Menginap';
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
  loading,
  error,
  onRefresh,
  onSelectDateForBooking,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }, []);

  const changeMonth = (delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDateStr(null);
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
    setSelectedDateStr(todayStr);
  };

  const getBookingsForDate = (dateStr: string): BookingRecord[] => {
    return bookings.filter((b) => {
      if (!b.masuk || !b.keluar) return false;
      return dateStr >= b.masuk && dateStr <= b.keluar;
    });
  };

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const selectedBookings = selectedDateStr ? getBookingsForDate(selectedDateStr) : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      {/* Calendar Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Kalendar Kekosongan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Semak tarikh kosong secara langsung daripada rekod tempahan rasmi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={jumpToToday}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Mengemaskini...' : 'Kemaskini Kalendar'}</span>
          </button>
        </div>
      </div>

      {/* Month Navigation Bar */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <div className="text-center font-display text-base sm:text-lg font-bold text-slate-900 font-mono-num">
          {MONTH_NAMES[month]} {year}
        </div>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          aria-label="Bulan seterusnya"
        >
          <span className="hidden sm:inline">Seterusnya</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>Petunjuk:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-xs border border-slate-300 bg-white" />
          Kosong
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-xs bg-rose-600" />
          Ditempah
        </span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span>(M) Masuk 3:00 PM</span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span>(K) Keluar 12:00 PM</span>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold">Gagal memuat turun data kalendar</p>
            <p className="mt-0.5 text-xs text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
        {DAY_SHORT_NAMES.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-semibold text-slate-500 bg-slate-50 rounded-md"
          >
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
          <div key={`empty-${idx}`} className="min-h-[72px] sm:min-h-[96px]" />
        ))}

        {Array.from({ length: totalDays }).map((_, idx) => {
          const dayNum = idx + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(
            2,
            '0'
          )}`;
          const dayBookings = getBookingsForDate(dateStr);
          const isBooked = dayBookings.length > 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDateStr;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDateStr(dateStr)}
              className={`min-h-[72px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-lg border text-left flex flex-col justify-start transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                isBooked
                  ? 'bg-rose-600 border-rose-700 text-white hover:bg-rose-700'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
              } ${isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`font-mono-num text-xs sm:text-sm font-bold ${
                    isToday && !isBooked
                      ? 'text-emerald-700 underline underline-offset-4'
                      : ''
                  }`}
                >
                  {dayNum}
                </span>
                {isToday && (
                  <span
                    className={`hidden sm:inline text-[10px] font-medium ${
                      isBooked ? 'text-rose-100' : 'text-emerald-700'
                    }`}
                  >
                    Hari ini
                  </span>
                )}
              </div>

              {isBooked && (
                <div className="mt-1 w-full space-y-1 overflow-hidden">
                  {dayBookings.map((booking, bIdx) => {
                    const unitLabel = getUnitLabel(booking);
                    const statusShort = getDayStatus(booking, dateStr)
                      .replace('Masuk (M)', '(M)')
                      .replace('Keluar (K)', '(K)')
                      .replace('Masuk / Keluar', '(In/Out)')
                      .replace('Menginap', '');

                    return (
                      <div
                        key={`${booking.nama}-${bIdx}`}
                        className="border-t border-white/20 pt-1 first:border-t-0 first:pt-0"
                      >
                        <div className="truncate text-[10px] sm:text-[11px] font-semibold leading-tight">
                          {booking.nama}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span
                            className={`inline-block rounded-xs px-1 py-0.5 text-[8px] sm:text-[9px] font-bold leading-none ${getUnitBadgeClasses(
                              unitLabel
                            )}`}
                          >
                            {unitLabel}
                          </span>
                          {statusShort && (
                            <span className="text-[9px] font-semibold text-amber-200">
                              {statusShort}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Detail Drawer */}
      {selectedDateStr && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CalendarIcon className="h-4 w-4 text-emerald-600" />
              <span className="font-mono-num">
                Tarikh Dipilih: {selectedDateStr.split('-').reverse().join('/')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDateStr(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Tutup
            </button>
          </div>

          {selectedBookings.length === 0 ? (
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-700 font-medium">
                Tarikh ini masih kosong dan tersedia untuk tempahan.
              </p>
              {onSelectDateForBooking && (
                <button
                  type="button"
                  onClick={() => onSelectDateForBooking(selectedDateStr)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Tempah Tarikh Ini via WhatsApp</span>
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-200">
              {selectedBookings.map((booking, i) => {
                const unitLabel = getUnitLabel(booking);
                return (
                  <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{booking.nama}</p>
                      <p className="text-xs text-slate-600">
                        {unitLabel} · {getDayStatus(booking, selectedDateStr)}
                      </p>
                    </div>
                    <div className="font-mono-num text-xs text-slate-500">
                      {booking.masuk} → {booking.keluar}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
