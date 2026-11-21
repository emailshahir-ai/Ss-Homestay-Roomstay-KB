import type { BookingRecord } from '../components/BookingCalendar';

export type BookingUnitCode = 'H' | 'R' | 'H+R';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function getBookingUnitRaw(booking: BookingRecord): string {
  return (
    booking.pilihan ||
    booking.jenis ||
    booking.unit ||
    booking.kategori ||
    booking.penginapan ||
    booking.homestay_roomstay ||
    ''
  );
}

function getUnitCoverage(raw: string): { homestay: boolean; roomstay: boolean } {
  const upper = raw.trim().toUpperCase();
  if (!upper || upper === 'PENGINAPAN') {
    return { homestay: true, roomstay: true };
  }

  const isCombo =
    upper === 'H+R' ||
    upper === 'R+H' ||
    upper.includes('H+R') ||
    upper.includes('H + R') ||
    upper.includes('R+H') ||
    upper.includes('R + H') ||
    upper.includes('KEDUA') ||
    upper.includes('KOMBO') ||
    (upper.includes('HOMESTAY') && upper.includes('ROOMSTAY'));

  if (isCombo) {
    return { homestay: true, roomstay: true };
  }

  const hasHomestay = upper === 'H' || upper.includes('HOMESTAY');
  const hasRoomstay = upper === 'R' || upper.includes('ROOMSTAY');

  if (!hasHomestay && !hasRoomstay) {
    return { homestay: true, roomstay: true };
  }

  return { homestay: hasHomestay, roomstay: hasRoomstay };
}

export function findOverlappingBookings(
  bookings: BookingRecord[],
  tarikhMasuk: string,
  tarikhKeluar: string,
  selectedCode: BookingUnitCode
): BookingRecord[] {
  if (!tarikhMasuk || !tarikhKeluar || tarikhKeluar <= tarikhMasuk) {
    return [];
  }

  return bookings.filter((b) => {
    if (!b.masuk) return false;
    const effectiveKeluar =
      b.keluar && b.keluar > b.masuk ? b.keluar : addDaysIso(b.masuk, 1);

    const dateOverlaps = tarikhMasuk < effectiveKeluar && tarikhKeluar > b.masuk;
    if (!dateOverlaps) return false;

    const existing = getUnitCoverage(getBookingUnitRaw(b));
    if (selectedCode === 'H+R') return existing.homestay || existing.roomstay;
    if (selectedCode === 'H') return existing.homestay;
    if (selectedCode === 'R') return existing.roomstay;
    return false;
  });
}
