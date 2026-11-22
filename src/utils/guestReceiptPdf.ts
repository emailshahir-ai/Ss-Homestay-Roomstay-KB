import { jsPDF } from 'jspdf';
import { CONTACT_INFO } from '../data/homestayData';
import { formatRM } from './sheetParser';

export interface GuestReceiptData {
  noRujukan: string;
  tarikhIso: string; // YYYY-MM-DD
  nama: string;
  noKadPengenalan: string;
  tarikhMasukIso: string; // YYYY-MM-DD
  tarikhKeluarIso: string; // YYYY-MM-DD
  jumlah: number;
  pilihanPenginapan?: string;
  catatan?: string;
  signatureDataUrl?: string | null;
}

export const RECEIPT_LOGO_PATH = '/assets/aistudio/LOGO_HSNRS_1c8aab89.jpg';
export const RECEIPT_SIGNATORY_NAME = 'Ahmad Shahir bin Muhammad Hasan';
export const RECEIPT_SIGNATORY_ROLE = 'Pengurus Ss Homestay';

export function formatIsoToDmy(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return '-';
  const parts = trimmed.split('-');
  if (parts.length !== 3) return trimmed;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function calculateNights(masukIso: string, keluarIso: string): number {
  if (!masukIso || !keluarIso) return 0;
  const [y1, m1, d1] = masukIso.split('-').map(Number);
  const [y2, m2, d2] = keluarIso.split('-').map(Number);
  if (!y1 || !y2) return 0;
  const diffMs = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

interface LoadedImageInfo {
  dataUrl: string;
  width: number;
  height: number;
}

function loadImageAsDataUrl(src: string): Promise<LoadedImageInfo | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        // Trim 3% off edges to remove any faint border artifacts from source JPG
        const trimX = Math.round(srcW * 0.02);
        const trimY = Math.round(srcH * 0.03);
        const cropW = Math.max(1, srcW - trimX * 2);
        const cropH = Math.max(1, srcH - trimY * 2);

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, trimX, trimY, cropW, cropH, 0, 0, cropW, cropH);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.94),
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function slugifyFilename(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

export async function generateGuestReceiptPdf(data: GuestReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;

  // Load SS Homestay logo for top header
  const logoInfo = await loadImageAsDataUrl(RECEIPT_LOGO_PATH);

  // --- Colored Top Header Box (Petak Berwarna Ungu Rasmi) ---
  const headerTopY = 12;
  const headerBoxH = 52;

  // Main royal purple colored box
  doc.setFillColor(107, 33, 168); // purple-800 (#6b21a8)
  doc.setDrawColor(88, 28, 135); // purple-900 border
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, headerTopY, contentWidth, headerBoxH, 3.5, 3.5, 'FD');

  // Subtle decorative bottom accent bar inside colored box
  doc.setFillColor(147, 51, 234); // purple-600
  doc.rect(marginX + 12, headerTopY + headerBoxH - 2.2, contentWidth - 24, 1.2, 'F');

  let innerY = headerTopY + 5;

  // Crisp white rounded badge behind logo so logo stands out cleanly on colored box
  if (logoInfo && logoInfo.width > 0 && logoInfo.height > 0) {
    const maxLogoH = 22;
    const maxLogoW = 26;
    const ratio = logoInfo.width / logoInfo.height;
    let drawH = maxLogoH;
    let drawW = drawH * ratio;
    if (drawW > maxLogoW) {
      drawW = maxLogoW;
      drawH = drawW / ratio;
    }
    const padX = 3;
    const padY = 2;
    const badgeW = drawW + padX * 2;
    const badgeH = drawH + padY * 2;
    const badgeX = (pageWidth - badgeW) / 2;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(233, 213, 255);
    doc.setLineWidth(0.35);
    doc.roundedRect(badgeX, innerY, badgeW, badgeH, 2.5, 2.5, 'FD');

    doc.addImage(logoInfo.dataUrl, 'JPEG', badgeX + padX, innerY + padY, drawW, drawH);
    innerY += badgeH + 5.5;
  } else {
    innerY += 12;
  }

  // White Brand Title inside colored box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('SS HOMESTAY & ROOMSTAY', pageWidth / 2, innerY, { align: 'center' });
  innerY += 5.2;

  // Soft white address & phone inside colored box
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(243, 232, 255); // purple-100
  doc.text(CONTACT_INFO.address, pageWidth / 2, innerY, { align: 'center' });
  innerY += 4.4;
  doc.setTextColor(233, 213, 255); // purple-200
  doc.text(
    `Tel: ${CONTACT_INFO.phoneDisplay} / 016-986 3776  ·  Kota Bharu, Kelantan`,
    pageWidth / 2,
    innerY,
    { align: 'center' }
  );

  let cursorY = headerTopY + headerBoxH + 11;

  // Receipt Title Strip (soft purple tint matching header box)
  doc.setFillColor(250, 245, 255); // purple-50
  doc.setDrawColor(216, 180, 254); // purple-300
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, cursorY - 6, contentWidth, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(88, 28, 135); // purple-900
  doc.text('RESIT RASMI PENGHUNI', pageWidth / 2, cursorY + 1.6, { align: 'center' });
  cursorY += 12.5;

  // Reference No & Date Box (2 columns)
  const metaBoxH = 18;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, cursorY, contentWidth, metaBoxH, 2, 2, 'FD');

  // Vertical divider inside meta box
  const midX = marginX + contentWidth / 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(midX, cursorY + 3, midX, cursorY + metaBoxH - 3);

  // Left: No. Rujukan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('NO. RUJUKAN', marginX + 5, cursorY + 6.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(data.noRujukan.trim() || '-', marginX + 5, cursorY + 13.2);

  // Right: Tarikh
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TARIKH', midX + 5, cursorY + 6.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatIsoToDmy(data.tarikhIso), midX + 5, cursorY + 13.2);

  cursorY += metaBoxH + 8;

  // Section Heading: Butiran Penghuni & Penginapan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 33, 168);
  doc.text('BUTIRAN PENGHUNI & PENGINAPAN', marginX, cursorY);
  cursorY += 3.5;

  const nights = calculateNights(data.tarikhMasukIso, data.tarikhKeluarIso);

  const detailRows: { label: string; value: string }[] = [
    { label: 'Nama Penghuni', value: data.nama.trim() || '-' },
    { label: 'No. Kad Pengenalan', value: data.noKadPengenalan.trim() || '-' },
  ];

  if (data.pilihanPenginapan?.trim()) {
    detailRows.push({
      label: 'Pilihan Penginapan',
      value: data.pilihanPenginapan.trim(),
    });
  }

  detailRows.push(
    {
      label: 'Tarikh Masuk',
      value: data.tarikhMasukIso
        ? `${formatIsoToDmy(data.tarikhMasukIso)}  (Check-in: 3:00 Petang)`
        : '-',
    },
    {
      label: 'Tarikh Keluar',
      value: data.tarikhKeluarIso
        ? `${formatIsoToDmy(data.tarikhKeluarIso)}  (Check-out: 12:00 Tengah hari)`
        : '-',
    }
  );

  if (nights > 0) {
    detailRows.push({
      label: 'Tempoh Menginap',
      value: `${nights} Malam`,
    });
  }

  if (data.catatan?.trim()) {
    detailRows.push({
      label: 'Catatan / Perkara',
      value: data.catatan.trim(),
    });
  }

  const labelColW = 54;
  const valueColW = contentWidth - labelColW;

  // Draw clean structured details table
  detailRows.forEach((item, index) => {
    const wrappedVal = doc.splitTextToSize(item.value, valueColW - 8) as string[];
    const rowH = Math.max(10.5, wrappedVal.length * 5 + 5.5);

    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.rect(marginX, cursorY, contentWidth, rowH, 'FD');

    // Column divider
    doc.line(marginX + labelColW, cursorY, marginX + labelColW, cursorY + rowH);

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(item.label, marginX + 4, cursorY + 6.8);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(wrappedVal, marginX + labelColW + 4, cursorY + 6.8);

    cursorY += rowH;
  });

  cursorY += 8;

  // Total Amount Highlight Box
  const totalBoxH = 22;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(5, 150, 105); // emerald-600
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, cursorY, contentWidth, totalBoxH, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 95, 70);
  doc.text('JUMLAH BAYARAN DITERIMA', marginX + 6, cursorY + 9.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(4, 120, 87);
  doc.text('Status: Diterima & Disahkan', marginX + 6, cursorY + 15.6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(4, 120, 87);
  doc.text(formatRM(data.jumlah), pageWidth - marginX - 6, cursorY + 13.5, {
    align: 'right',
  });

  cursorY += totalBoxH + 14;

  // Confirmation note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Terima kasih kerana memilih Ss Homestay & Roomstay. Sila simpan resit ini sebagai rujukan rasmi penginapan anda.',
    marginX,
    cursorY,
    { maxWidth: contentWidth }
  );

  // Signature Section (positioned comfortably near bottom-right)
  const sigBlockWidth = 78;
  const sigX = pageWidth - marginX - sigBlockWidth;
  const sigTopY = Math.max(cursorY + 16, pageHeight - 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Dikeluarkan & Disahkan oleh,', sigX, sigTopY);

  const lineY = sigTopY + 22;

  // Optional digital signature image rendered right above signature line
  if (data.signatureDataUrl) {
    try {
      doc.addImage(data.signatureDataUrl, 'PNG', sigX + 2, sigTopY + 3, 56, 17);
    } catch {
      // ignore invalid canvas data URL
    }
  }

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.line(sigX, lineY, sigX + sigBlockWidth, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(RECEIPT_SIGNATORY_NAME, sigX, lineY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(RECEIPT_SIGNATORY_ROLE, sigX, lineY + 10.5);

  // Bottom Footer Strip
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Ss Homestay & Roomstay · ${CONTACT_INFO.address}`,
    marginX,
    pageHeight - 10
  );
  doc.text(`No. Rujukan: ${data.noRujukan.trim() || '-'}`, pageWidth - marginX, pageHeight - 10, {
    align: 'right',
  });

  const refSlug = slugifyFilename(data.noRujukan) || 'resit';
  const nameSlug = slugifyFilename(data.nama) || 'penghuni';
  doc.save(`resit-penghuni-${refSlug}-${nameSlug}.pdf`);
}
