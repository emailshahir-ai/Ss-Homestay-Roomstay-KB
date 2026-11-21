import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CONTACT_INFO, MONTH_NAMES } from '../data/homestayData';
import { FinancialRecord, SheetMeta, formatRM } from './sheetParser';
import type { FinancialPrintMode } from '../components/FinancialPrintReport';

interface GenerateFinancialPdfOptions {
  records: FinancialRecord[];
  mode: FinancialPrintMode;
  periodKey: string; // 'semua' or 'YYYY-MM'
  sheetMeta: SheetMeta | null;
}

function formatMonthLabel(monthKey: string): string {
  if (monthKey === 'semua') return 'Keseluruhan (Semua Bulan)';
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const idx = Number(parts[1]) - 1;
  if (idx >= 0 && idx < MONTH_NAMES.length) {
    return `${MONTH_NAMES[idx]} ${parts[0]}`;
  }
  return monthKey;
}

function getTodayFormatted(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}/${now.getFullYear()}`;
}

export function generateFinancialPdf({
  records,
  mode,
  periodKey,
  sheetMeta,
}: GenerateFinancialPdfOptions): void {
  const periodFiltered =
    periodKey === 'semua' ? records : records.filter((r) => r.monthKey === periodKey);

  const modeFiltered = periodFiltered.filter((r) => {
    if (mode === 'masuk') return r.wangMasuk > 0;
    if (mode === 'keluar') return r.wangKeluar > 0;
    return r.wangMasuk > 0 || r.wangKeluar > 0;
  });

  const chronological = [...modeFiltered].sort((a, b) => {
    if (a.tarikhIso !== b.tarikhIso) return a.tarikhIso.localeCompare(b.tarikhIso);
    return a.rowNumber - b.rowNumber;
  });

  let runningBalance = 0;
  const rows = chronological.map((r) => {
    runningBalance += r.wangMasuk - r.wangKeluar;
    return { ...r, runningBalance };
  });

  let totalMasuk = 0;
  let totalKeluar = 0;
  let countMasuk = 0;
  let countKeluar = 0;
  rows.forEach((r) => {
    if (r.wangMasuk > 0) {
      totalMasuk += r.wangMasuk;
      countMasuk += 1;
    }
    if (r.wangKeluar > 0) {
      totalKeluar += r.wangKeluar;
      countKeluar += 1;
    }
  });
  const totalBaki = totalMasuk - totalKeluar;
  const marginPct = totalMasuk > 0 ? Math.round((totalBaki / totalMasuk) * 100) : 0;

  // Monthly breakdown when exporting Keseluruhan (Semua Bulan)
  const monthlySummary: {
    monthKey: string;
    count: number;
    masuk: number;
    keluar: number;
    baki: number;
  }[] = [];

  if (periodKey === 'semua') {
    const map = new Map<
      string,
      { monthKey: string; count: number; masuk: number; keluar: number; baki: number }
    >();
    rows.forEach((r) => {
      const key = r.monthKey || 'Lain-lain';
      const prev = map.get(key) || { monthKey: key, count: 0, masuk: 0, keluar: 0, baki: 0 };
      prev.count += 1;
      prev.masuk += r.wangMasuk;
      prev.keluar += r.wangKeluar;
      prev.baki = prev.masuk - prev.keluar;
      map.set(key, prev);
    });
    monthlySummary.push(
      ...Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    );
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const todayStr = getTodayFormatted();
  const periodLabel = formatMonthLabel(periodKey);

  const reportTitle =
    mode === 'masuk'
      ? 'LAPORAN ANALISIS WANG MASUK'
      : mode === 'keluar'
      ? 'LAPORAN ANALISIS WANG KELUAR'
      : 'LAPORAN ANALISIS KEWANGAN KESELURUHAN';

  // --- Official Letterhead ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(CONTACT_INFO.brand.toUpperCase(), marginX, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(CONTACT_INFO.address, marginX, 23);
  doc.text(`Tel: ${CONTACT_INFO.phoneDisplay} (${CONTACT_INFO.owner})`, marginX, 27.5);

  // Right-side Report Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, pageWidth - marginX, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Tempoh: ${periodLabel}`, pageWidth - marginX, 23, { align: 'right' });
  doc.text(
    `Tarikh Jana: ${todayStr}${sheetMeta?.tab ? ` · Sumber: ${sheetMeta.tab}` : ''}`,
    pageWidth - marginX,
    27.5,
    { align: 'right' }
  );

  // Top Header Divider
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(marginX, 31.5, pageWidth - marginX, 31.5);

  // --- Summary KPI Cards ---
  let cursorY = 36;
  const cardHeight = 20;
  const cardGap = 3.5;

  interface KpiCard {
    label: string;
    value: string;
    sub: string;
    valueColor: [number, number, number];
    highlight?: boolean;
  }

  const cards: KpiCard[] = [];
  if (mode === 'masuk' || mode === 'keseluruhan') {
    cards.push({
      label: 'Jumlah Wang Masuk',
      value: formatRM(totalMasuk),
      sub: `${countMasuk} transaksi`,
      valueColor: [4, 120, 87],
    });
  }
  if (mode === 'keluar' || mode === 'keseluruhan') {
    cards.push({
      label: 'Jumlah Wang Keluar',
      value: formatRM(totalKeluar),
      sub: `${countKeluar} transaksi`,
      valueColor: [190, 18, 60],
    });
  }
  if (mode === 'keseluruhan') {
    cards.push({
      label: 'Baki Bersih',
      value: formatRM(totalBaki),
      sub: `${totalBaki >= 0 ? 'Lebihan' : 'Defisit'} · Margin ${marginPct}%`,
      valueColor: totalBaki >= 0 ? [15, 23, 42] : [190, 18, 60],
      highlight: true,
    });
  } else {
    cards.push({
      label: 'Skop Laporan',
      value: periodLabel,
      sub: `Jumlah rekod dipaparkan: ${rows.length}`,
      valueColor: [15, 23, 42],
      highlight: true,
    });
  }

  const cardWidth = (contentWidth - cardGap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = marginX + index * (cardWidth + cardGap);
    if (card.highlight) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
    }
    doc.roundedRect(x, cursorY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 3, cursorY + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(card.value.length > 20 ? 9.5 : 12);
    doc.setTextColor(...card.valueColor);
    doc.text(card.value, x + 3, cursorY + 12.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(card.sub, x + 3, cursorY + 17);
  });

  cursorY += cardHeight + 7;

  // --- Monthly Breakdown Table (for All Months) ---
  if (periodKey === 'semua' && monthlySummary.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('RINGKASAN MENGIKUT BULAN', marginX, cursorY);
    cursorY += 2.5;

    const monthHead: string[] = ['Bulan', 'Bil. Rekod'];
    if (mode === 'masuk' || mode === 'keseluruhan') monthHead.push('Wang Masuk (RM)');
    if (mode === 'keluar' || mode === 'keseluruhan') monthHead.push('Wang Keluar (RM)');
    if (mode === 'keseluruhan') monthHead.push('Baki Bulanan (RM)');

    const monthBody = monthlySummary.map((m) => {
      const row: string[] = [formatMonthLabel(m.monthKey), String(m.count)];
      if (mode === 'masuk' || mode === 'keseluruhan') row.push(formatRM(m.masuk));
      if (mode === 'keluar' || mode === 'keseluruhan') row.push(formatRM(m.keluar));
      if (mode === 'keseluruhan') row.push(formatRM(m.baki));
      return row;
    });

    const monthColStyles: Record<number, { halign?: 'left' | 'center' | 'right' }> = {
      0: { halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    };

    autoTable(doc, {
      startY: cursorY,
      head: [monthHead],
      body: monthBody,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
      },
      columnStyles: monthColStyles,
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY;
    cursorY = (finalY ?? cursorY + 20) + 7;
  }

  // --- Detailed Transactions Table ---
  if (cursorY > pageHeight - 40) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`SENARAI REKOD TERPERINCI (${rows.length} REKOD)`, marginX, cursorY);
  cursorY += 2.5;

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Tiada rekod transaksi bagi kategori dan tempoh yang dipilih.',
      marginX,
      cursorY + 6
    );
    cursorY += 14;
  } else {
    let headRow: string[] = [];
    let bodyRows: string[][] = [];
    let footRow: string[] = [];
    let colStyles: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }> =
      {};

    if (mode === 'masuk') {
      headRow = ['Bil', 'Tarikh', 'Perkara / Butiran', 'Nama / Unit', 'Wang Masuk (RM)'];
      bodyRows = rows.map((r, i) => [
        String(i + 1),
        r.tarikhDisplay || '-',
        r.perkara || '-',
        [r.nama, r.unit].filter(Boolean).join(' · ') || '-',
        formatRM(r.wangMasuk),
      ]);
      footRow = ['', '', '', 'JUMLAH WANG MASUK', formatRM(totalMasuk)];
      colStyles = {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 23 },
        2: { halign: 'left' },
        3: { halign: 'left', cellWidth: 44 },
        4: { halign: 'right', cellWidth: 32 },
      };
    } else if (mode === 'keluar') {
      headRow = ['Bil', 'Tarikh', 'Perkara / Butiran', 'Nama / Catatan', 'Wang Keluar (RM)'];
      bodyRows = rows.map((r, i) => [
        String(i + 1),
        r.tarikhDisplay || '-',
        r.perkara || '-',
        [r.nama, r.unit].filter(Boolean).join(' · ') || '-',
        formatRM(r.wangKeluar),
      ]);
      footRow = ['', '', '', 'JUMLAH WANG KELUAR', formatRM(totalKeluar)];
      colStyles = {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 23 },
        2: { halign: 'left' },
        3: { halign: 'left', cellWidth: 44 },
        4: { halign: 'right', cellWidth: 32 },
      };
    } else {
      headRow = [
        'Bil',
        'Tarikh',
        'Perkara / Butiran',
        'Masuk (RM)',
        'Keluar (RM)',
        'Baki (RM)',
      ];
      bodyRows = rows.map((r, i) => {
        const subInfo = [r.nama, r.unit].filter(Boolean).join(' · ');
        const detail =
          subInfo && !r.perkara.toLowerCase().includes(r.nama.toLowerCase())
            ? `${r.perkara}\n(${subInfo})`
            : r.perkara || subInfo || '-';
        return [
          String(i + 1),
          r.tarikhDisplay || '-',
          detail,
          r.wangMasuk > 0 ? formatRM(r.wangMasuk) : '-',
          r.wangKeluar > 0 ? formatRM(r.wangKeluar) : '-',
          formatRM(r.runningBalance),
        ];
      });
      footRow = [
        '',
        '',
        'JUMLAH KESELURUHAN',
        formatRM(totalMasuk),
        formatRM(totalKeluar),
        formatRM(totalBaki),
      ];
      colStyles = {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 22 },
        2: { halign: 'left' },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 28 },
      };
    }

    autoTable(doc, {
      startY: cursorY,
      head: [headRow],
      body: bodyRows,
      foot: [footRow],
      showFoot: 'lastPage',
      margin: { left: marginX, right: marginX, bottom: 18 },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        cellPadding: 2.1,
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: colStyles,
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (mode === 'masuk' && data.column.index === 4) {
            data.cell.styles.textColor = [4, 120, 87];
            data.cell.styles.fontStyle = 'bold';
          } else if (mode === 'keluar' && data.column.index === 4) {
            data.cell.styles.textColor = [190, 18, 60];
            data.cell.styles.fontStyle = 'bold';
          } else if (mode === 'keseluruhan') {
            if (data.column.index === 3 && data.cell.raw !== '-') {
              data.cell.styles.textColor = [4, 120, 87];
            } else if (data.column.index === 4 && data.cell.raw !== '-') {
              data.cell.styles.textColor = [190, 18, 60];
            } else if (data.column.index === 5) {
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY;
    cursorY = (finalY ?? cursorY + 25) + 12;
  }

  // --- Signature Block ---
  if (cursorY > pageHeight - 38) {
    doc.addPage();
    cursorY = 24;
  }

  const sigWidth = 65;
  const rightSigX = pageWidth - marginX - sigWidth;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Disediakan oleh,', marginX, cursorY);
  doc.text('Disahkan oleh,', rightSigX, cursorY);

  const lineY = cursorY + 14;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(marginX, lineY, marginX + sigWidth, lineY);
  doc.line(rightSigX, lineY, rightSigX + sigWidth, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Pentadbir Sistem Kewangan', marginX, lineY + 4.5);
  doc.text(CONTACT_INFO.owner, rightSigX, lineY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(CONTACT_INFO.brand, marginX, lineY + 8.5);
  doc.text(`Pemilik · ${CONTACT_INFO.brand}`, rightSigX, lineY + 8.5);

  // --- Footer Page Numbers on Every Page ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${CONTACT_INFO.brand} · Laporan Kewangan Rasmi (${periodLabel})`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Muka ${i} / ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      align: 'right',
    });
  }

  const modeSlug =
    mode === 'masuk'
      ? 'wang-masuk'
      : mode === 'keluar'
      ? 'wang-keluar'
      : 'keseluruhan';
  const periodSlug = periodKey === 'semua' ? 'semua-bulan' : periodKey;
  doc.save(`laporan-kewangan-ss-homestay-${modeSlug}-${periodSlug}.pdf`);
}
