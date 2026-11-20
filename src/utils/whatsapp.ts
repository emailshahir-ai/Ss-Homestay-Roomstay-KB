import { CONTACT_INFO } from '../data/homestayData';
import { formatRM } from './sheetParser';

/**
 * Normalize Malaysian phone numbers from Google Sheets or user input into international format (60...).
 * Google Sheets often strips leading 0 (e.g. "0169867367" -> "169867367").
 * Returns empty string if the number is clearly invalid/placeholder (e.g. "0000", "888", "#ERROR!").
 */
export function normalizeMalaysiaPhone(raw: string | undefined | null): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str || str.startsWith('#')) return '';

  const digits = str.replace(/\D/g, '');
  if (!digits) return '';

  // Reject obvious dummy numbers like 0000, 00000, 888, 3333
  if (/^(\d)\1+$/.test(digits)) return '';

  // Already starts with 60 (Malaysian country code)
  if (digits.startsWith('60') && digits.length >= 10 && digits.length <= 13) {
    return digits;
  }

  // Starts with 0 (e.g. 0169867367 or 01124380225)
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 12) {
    return `60${digits.slice(1)}`;
  }

  // Starts with 1 (Google Sheets stripped leading 0 from Malaysian mobile 01x...)
  if (digits.startsWith('1') && digits.length >= 8 && digits.length <= 10) {
    return `60${digits}`;
  }

  // Other international/local numbers with at least 9 digits
  if (digits.length >= 9 && digits.length <= 14) {
    return digits;
  }

  return '';
}

export function formatDisplayPhone(raw: string | undefined | null): string {
  const normalized = normalizeMalaysiaPhone(raw);
  if (!normalized) return '';
  if (normalized.startsWith('60')) {
    return `0${normalized.slice(2)}`;
  }
  return normalized;
}

export function buildWhatsAppUrl(phoneRaw: string, message: string): string {
  const normalized = normalizeMalaysiaPhone(phoneRaw);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export interface GuestBookingInquiry {
  nama: string;
  telefon: string;
  unit: string;
  tarikhMasuk: string;
  tarikhKeluar: string;
  bilTetamu: string;
  catatan: string;
  nights: number;
  estimatedTotal: number;
}

function formatIsoToDisplay(iso: string): string {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function buildGuestBookingMessage(inquiry: GuestBookingInquiry): string {
  const lines = [
    `Assalamualaikum ${CONTACT_INFO.owner}, saya ingin membuat tempahan di *${CONTACT_INFO.brand}*:`,
    '',
    `• *Nama:* ${inquiry.nama.trim()}`,
    inquiry.telefon.trim() ? `• *No. Telefon:* ${inquiry.telefon.trim()}` : '',
    `• *Pilihan Unit:* ${inquiry.unit}`,
    `• *Tarikh Masuk:* ${formatIsoToDisplay(inquiry.tarikhMasuk)} (3:00 Petang)`,
    `• *Tarikh Keluar:* ${formatIsoToDisplay(inquiry.tarikhKeluar)} (12:00 Tengah hari)`,
    inquiry.nights > 0 ? `• *Tempoh:* ${inquiry.nights} malam` : '',
    inquiry.bilTetamu.trim() ? `• *Bilangan Tetamu:* ${inquiry.bilTetamu.trim()} orang` : '',
    inquiry.estimatedTotal > 0
      ? `• *Anggaran Kadar Biasa:* ${formatRM(inquiry.estimatedTotal)}`
      : '',
    inquiry.catatan.trim() ? `• *Catatan:* ${inquiry.catatan.trim()}` : '',
    '',
    'Mohon pengesahan kekosongan dan maklumat bayaran deposit. Terima kasih.',
  ];

  return lines.filter((line, idx, arr) => {
    if (line === '' && arr[idx - 1] === '') return false;
    return true;
  }).join('\n');
}

export interface AdminConfirmationDetails {
  nama: string;
  unit?: string;
  tarikhMasuk: string;
  tarikhKeluar: string;
  jumlah?: number;
}

export function buildAdminConfirmationMessage(details: AdminConfirmationDetails): string {
  const lines = [
    `Assalamualaikum *${details.nama}*,`,
    '',
    `Berikut adalah pengesahan tempahan anda di *${CONTACT_INFO.brand}*:`,
    `• *Unit:* ${details.unit || 'Penginapan'}`,
    `• *Tarikh Masuk:* ${formatIsoToDisplay(details.tarikhMasuk)} (3:00 Petang)`,
    `• *Tarikh Keluar:* ${formatIsoToDisplay(details.tarikhKeluar)} (12:00 Tengah hari)`,
    details.jumlah && details.jumlah > 0
      ? `• *Jumlah Bayaran:* ${formatRM(details.jumlah)}`
      : '',
    '',
    `*Alamat:* ${CONTACT_INFO.address}`,
    `*Lokasi Maps:* ${CONTACT_INFO.mapsDirectUrl}`,
    '',
    'Terima kasih kerana memilih SS Homestay & Roomstay. Sebarang pertanyaan boleh hubungi kami terus di sini.',
  ];

  return lines.filter((line, idx, arr) => {
    if (line === '' && arr[idx - 1] === '') return false;
    return true;
  }).join('\n');
}
