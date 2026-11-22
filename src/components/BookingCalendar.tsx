import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MessageCircle,
  Minimize2,
  RefreshCw,
} from 'lucide-react';
import { DAY_SHORT_NAMES, MONTH_NAMES } from '../data/homestayData';

export interface BookingRecord {
  rowNumber?: number;
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

function getUnitShortMobile(unitLabel: string): string {
  const upper = unitLabel.toUpperCase();
  if (upper.includes('HOMESTAY') && upper.includes('ROOMSTAY')) return 'H+R';
  if (upper.includes('KEDUA') || upper.includes('KOMBO')) return 'H+R';
  if (upper.includes('ROOMSTAY')) return 'Room';
  if (upper.includes('HOMESTAY')) return 'Home';
  return unitLabel.slice(0, 5);
}

function getUnitBadgeClasses(unitLabel: string): string {
  const upper = unitLabel.toUpperCase();
  if (upper.includes('HOMESTAY') && upper.includes('ROOMSTAY')) return 'bg-amber-600 text-white';
  if (upper.includes('KEDUA') || upper.includes('KOMBO')) return 'bg-amber-600 text-white';
  if (upper.includes('ROOMSTAY')) return 'bg-emerald-600 text-white';
  if (upper.includes('HOMESTAY')) return 'bg-indigo-600 text-white';
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
  const [mobileWideMode, setMobileWideMode] = useState<boolean>(false);

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
    <div className="-mx-2 sm:mx-0 rounded-xl border border-slate-200 bg-white px-2.5 py-4 sm:p-6">
      {/* Calendar Header */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 px-1 sm:px-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Kalendar Kekosongan
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Semak tarikh kosong secara langsung daripada rekod tempahan rasmi. Ketik mana-mana tarikh untuk maklumat penuh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileWideMode((prev) => !prev)}
            className={`sm:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              mobileWideMode
                ? 'border-purple-600 bg-purple-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {mobileWideMode ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Muat Skrin</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Paparan Lebih Besar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={jumpToToday}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Mengemaskini...' : 'Kemaskini'}</span>
          </button>
        </div>
      </div>

      {/* Month Navigation Bar */}
      <div className="mt-4 flex items-center justify-between gap-2 px-1 sm:px-0">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 sm:px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <div className="text-center font-display text-lg sm:text-xl font-extrabold text-slate-900 font-mono-num">
          {MONTH_NAMES[month]} {year}
        </div>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 sm:px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          aria-label="Bulan seterusnya"
        >
          <span className="hidden sm:inline">Seterusnya</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs sm:text-sm text-slate-600 px-1 sm:px-0">
        <span className="font-semibold text-slate-700">Petunjuk:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-xs border border-slate-300 bg-white" />
          Kosong
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-xs bg-rose-600" />
          Ditempah
        </span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span>(M) Masuk 3:00 PM</span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span>(K) Keluar 12:00 PM</span>
      </div>

      {mobileWideMode && (
        <p className="mt-2 px-1 text-[11px] font-medium text-purple-700 sm:hidden">
          Leret ke kiri atau kanan pada kalendar di bawah untuk melihat setiap hari dengan saiz penuh.
        </p>
      )}

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

      {/* Calendar Grid — Enlarged for clear mobile readability */}
      <div className="mt-4 overflow-x-auto pb-1">
        <div
          className={`grid grid-cols-7 gap-1 sm:gap-2 ${
            mobileWideMode ? 'min-w-[620px] sm:min-w-0' : 'w-full'
          }`}
        >
          {DAY_SHORT_NAMES.map((day) => (
            <div
              key={day}
              className="py-2.5 text-center text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 rounded-md"
            >
              {day}
            </div>
          ))}

          {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className={`${
                mobileWideMode ? 'min-h-[110px]' : 'min-h-[92px]'
              } sm:min-h-[112px]`}
            />
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
                className={`${
                  mobileWideMode ? 'min-h-[110px] p-2' : 'min-h-[92px] p-1.5'
                } sm:min-h-[112px] sm:p-2.5 rounded-lg border text-left flex flex-col justify-start transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  isBooked
                    ? 'bg-rose-600 border-rose-700 text-white hover:bg-rose-700'
                    : isToday
                    ? 'bg-emerald-50/70 border-emerald-400 text-slate-900 hover:bg-emerald-50'
                    : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                } ${isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
              >
                <div className="flex w-full items-center justify-between gap-0.5">
                  <span
                    className={`font-mono-num text-base sm:text-lg font-extrabold leading-none ${
                      isToday && !isBooked
                        ? 'text-emerald-700 underline underline-offset-4'
                        : ''
                    }`}
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span
                      className={`${
                        mobileWideMode ? 'inline' : 'hidden sm:inline'
                      } text-[10px] font-bold ${
                        isBooked ? 'text-rose-100' : 'text-emerald-700'
                      }`}
                    >
                      Hari ini
                    </span>
                  )}
                </div>

                {!isBooked && (
                  <span className="mt-auto pt-2 text-[10px] sm:text-[11px] font-medium text-emerald-700/80 leading-none">
                    Kosong
                  </span>
                )}

                {isBooked && (
                  <div className="mt-1.5 w-full space-y-1 overflow-hidden">
                    {dayBookings.map((booking, bIdx) => {
                      const unitLabel = getUnitLabel(booking);
                      const shortUnit = getUnitShortMobile(unitLabel);
                      const statusShort = getDayStatus(booking, dateStr)
                        .replace('Masuk (M)', '(M)')
                        .replace('Keluar (K)', '(K)')
                        .replace('Masuk / Keluar', '(In/Out)')
                        .replace('Menginap', '');

                      return (
                        <div
                          key={`${booking.nama}-${bIdx}`}
                          className="border-t border-white/25 pt-1 first:border-t-0 first:pt-0"
                        >
                          <div
                            className={`truncate font-bold leading-tight ${
                              mobileWideMode ? 'text-xs' : 'text-[11px]'
                            } sm:text-xs`}
                          >
                            {booking.nama}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <span
                              className={`inline-block rounded-xs px-1 py-0.5 text-[9px] sm:text-[10px] font-bold leading-none ${getUnitBadgeClasses(
                                unitLabel
                              )}`}
                            >
                              {mobileWideMode ? (
                                unitLabel
                              ) : (
                                <>
                                  <span className="sm:hidden">{shortUnit}</span>
                                  <span className="hidden sm:inline">{unitLabel}</span>
                                </>
                              )}
                            </span>
                            {statusShort && (
                              <span className="text-[10px] font-bold text-amber-200 leading-none">
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
