import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { MONTH_NAMES, SCRIPT_URL } from '../data/homestayData';
import { FinancialRecord, SheetMeta, formatRM } from '../utils/sheetParser';
import { generateFinancialPdf } from '../utils/financialPdf';
import { FinancialPrintMode, FinancialPrintReport } from './FinancialPrintReport';
import {
  buildAdminConfirmationMessage,
  buildWhatsAppUrl,
  formatDisplayPhone,
  normalizeMalaysiaPhone,
} from '../utils/whatsapp';

interface FinancialAnalyticsProps {
  records: FinancialRecord[];
  meta: SheetMeta | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<FinancialRecord[] | null> | void;
}

type TypeFilter = 'semua' | 'masuk' | 'keluar';
type FormEntryType = 'keluar' | 'masuk';

const LOCAL_FINANCE_STORAGE_KEY = 'ss_homestay_local_finance_v1';

const EXPENSE_PRESETS = [
  'Bil Elektrik TNB',
  'Bil Air & WiFi',
  'Upah Kemas Rumah & Dobi',
  'Barangan Asas & Sabun',
  'Penyelenggaraan Kolam',
  'Baik Pulih & Peralatan',
];

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function isoToSheetSlashDate(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return iso;
  // Google Sheets standard Form Responses format: M/D/YYYY
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function isoToDisplayDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatNowSheetTimestamp(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${String(
    d.getMinutes()
  ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  if (monthIdx >= 0 && monthIdx < MONTH_NAMES.length) {
    return `${MONTH_NAMES[monthIdx]} ${year}`;
  }
  return monthKey;
}

function formatMonthShort(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parts[0].slice(-2);
  const monthIdx = Number(parts[1]) - 1;
  if (monthIdx >= 0 && monthIdx < MONTH_NAMES.length) {
    return `${MONTH_NAMES[monthIdx].slice(0, 3)} ${year}`;
  }
  return monthKey;
}

export const FinancialAnalytics: React.FC<FinancialAnalyticsProps> = ({
  records,
  meta,
  loading,
  error,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('semua');
  const [selectedMonth, setSelectedMonth] = useState<string>('semua');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Print report configuration & preview modal state
  const [printMode, setPrintMode] = useState<FinancialPrintMode>('keseluruhan');
  const [printPeriod, setPrintPeriod] = useState<string>('semua');
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // Local fallback records (used only if Google Sheet POST fails or while syncing)
  const [localRecords, setLocalRecords] = useState<FinancialRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_FINANCE_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as FinancialRecord[]) : [];
    } catch {
      return [];
    }
  });

  // Financial Entry Form State
  const [entryType, setEntryType] = useState<FormEntryType>('keluar');
  const [entryDate, setEntryDate] = useState<string>(() => getTodayIso());
  const [entryPerkara, setEntryPerkara] = useState<string>('');
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryNama, setEntryNama] = useState<string>('');
  const [entryTelefon, setEntryTelefon] = useState<string>('');
  const [entryUnit, setEntryUnit] = useState<string>('H');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const persistLocalRecords = (next: FinancialRecord[]) => {
    setLocalRecords(next);
    try {
      localStorage.setItem(LOCAL_FINANCE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota error
    }
  };

  // Automatically remove any local fallback record once the matching record appears in live Google Sheet
  useEffect(() => {
    if (localRecords.length === 0 || records.length === 0) return;
    const remaining = localRecords.filter((localRec) => {
      const existsInSheet = records.some(
        (sheetRec) =>
          sheetRec.tarikhIso === localRec.tarikhIso &&
          sheetRec.wangMasuk === localRec.wangMasuk &&
          sheetRec.wangKeluar === localRec.wangKeluar &&
          sheetRec.perkara.trim().toLowerCase() === localRec.perkara.trim().toLowerCase()
      );
      return !existsInSheet;
    });
    if (remaining.length !== localRecords.length) {
      persistLocalRecords(remaining);
    }
  }, [records, localRecords]);

  const handleRemoveLocalRecord = (id: string) => {
    const next = localRecords.filter((r) => r.id !== id);
    persistLocalRecords(next);
  };

  const handleSubmitFinanceEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitFeedback(null);

    const sanitizedAmount = entryAmount
      .replace(/RM/gi, '')
      .replace(/\s+/g, '')
      .replace(/,/g, '.');
    const amountNum = Number.parseFloat(sanitizedAmount);

    if (!entryDate) {
      setSubmitFeedback({ type: 'error', text: 'Sila pilih tarikh transaksi.' });
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setSubmitFeedback({
        type: 'error',
        text: 'Sila masukkan jumlah RM yang sah (lebih daripada 0).',
      });
      return;
    }
    if (!entryPerkara.trim() && (entryType === 'keluar' || !entryNama.trim())) {
      setSubmitFeedback({
        type: 'error',
        text:
          entryType === 'keluar'
            ? 'Sila isi ruangan Perkara bagi rekod wang keluar.'
            : 'Sila isi ruangan Perkara atau Nama Tetamu bagi rekod wang masuk.',
      });
      return;
    }

    setSubmitting(true);

    const timestampStr = formatNowSheetTimestamp();
    const sheetDateStr = isoToSheetSlashDate(entryDate);
    const isMasuk = entryType === 'masuk';
    const cleanNama = isMasuk ? entryNama.trim() : '';
    const cleanTel = isMasuk ? entryTelefon.trim() : '';
    const cleanUnitCode = isMasuk ? entryUnit : '';
    const cleanUnitLabel =
      cleanUnitCode === 'H'
        ? 'Homestay'
        : cleanUnitCode === 'R'
        ? 'Roomstay'
        : cleanUnitCode === 'H+R'
        ? 'Homestay & Roomstay'
        : '';
    const cleanPerkara = entryPerkara.trim();
    const roundedAmount = Math.round(amountNum * 100) / 100;
    const wangMasukVal: number | '' = isMasuk ? roundedAmount : '';
    const wangKeluarVal: number | '' = !isMasuk ? roundedAmount : '';

    // Exact 9-column row matching Google Sheet header:
    // ["Timestamp","NAMA","NO. TELEFON","TARIKH MASUK","TARIKH KELUAR","PILIHAN MENGINAP","JUMLAH","PERKARA","WANG KELUAR"]
    const rowArray: (string | number)[] = [
      timestampStr,
      cleanNama,
      cleanTel,
      sheetDateStr,
      '',
      cleanUnitCode,
      wangMasukVal,
      cleanPerkara,
      wangKeluarVal,
    ];

    const payload = {
      action: 'append',
      tab: meta?.tab || 'Form Responses 1',
      row: rowArray,
      values: [rowArray],
      Timestamp: timestampStr,
      NAMA: cleanNama,
      'NO. TELEFON': cleanTel,
      'TARIKH MASUK': sheetDateStr,
      'TARIKH KELUAR': '',
      'PILIHAN MENGINAP': cleanUnitCode,
      JUMLAH: wangMasukVal,
      PERKARA: cleanPerkara,
      'WANG KELUAR': wangKeluarVal,
      'WANG MASUK': wangMasukVal,
      nama: cleanNama,
      telefon: cleanTel,
      masuk: sheetDateStr,
      keluar: '',
      pilihan: cleanUnitCode,
      jumlah: wangMasukVal,
      perkara: cleanPerkara,
      wangMasuk: wangMasukVal,
      wang_masuk: wangMasukVal,
      wangKeluar: wangKeluarVal,
      wang_keluar: wangKeluarVal,
    };

    const verifySavedInSheet = async (): Promise<boolean> => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const refreshed = await onRefresh();
      if (!Array.isArray(refreshed)) return false;
      return refreshed.some((r) => {
        const amountMatches = isMasuk
          ? Math.abs(r.wangMasuk - roundedAmount) < 0.01
          : Math.abs(r.wangKeluar - roundedAmount) < 0.01;
        const perkaraMatches = cleanPerkara
          ? r.perkara.trim().toLowerCase().includes(cleanPerkara.toLowerCase())
          : true;
        return r.tarikhIso === entryDate && amountMatches && perkaraMatches;
      });
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
      let serverErrorMsg = '';
      try {
        const json = await res.json();
        if (json && typeof json === 'object' && 'ok' in json) {
          serverOk = Boolean(json.ok);
          if (!serverOk && json.error) {
            serverErrorMsg = String(json.error);
          }
        }
      } catch {
        // Apps Script redirects can return plain text; verify via live GET below
      }

      if (!serverOk) {
        throw new Error(serverErrorMsg || 'Pelayan Google Sheet menolak permintaan simpanan.');
      }

      const verified = await verifySavedInSheet();
      setEntryPerkara('');
      setEntryAmount('');
      setEntryNama('');
      setEntryTelefon('');
      setSubmitFeedback({
        type: 'success',
        text: verified
          ? `Disahkan tersimpan dalam Google Sheet! Rekod ${
              isMasuk ? 'Wang Masuk (JUMLAH)' : 'Wang Keluar (WANG KELUAR)'
            }: ${formatRM(roundedAmount)} telah dikemaskini.`
          : `Rekod ${
              isMasuk ? 'Wang Masuk' : 'Wang Keluar'
            } (${formatRM(roundedAmount)}) telah dihantar ke Google Sheet. Klik Kemaskini jika belum kelihatan.`,
      });
    } catch (err) {
      console.error('Ralat POST ke Google Sheet, menyemak status simpanan:', err);
      // Verify first via cache-busted GET because Apps Script POST redirects sometimes trigger browser fetch error even after writing!
      const verifiedDespiteError = await verifySavedInSheet();

      if (verifiedDespiteError) {
        setEntryPerkara('');
        setEntryAmount('');
        setEntryNama('');
        setEntryTelefon('');
        setSubmitFeedback({
          type: 'success',
          text: `Disahkan tersimpan dalam Google Sheet! Rekod ${
            isMasuk ? 'Wang Masuk (JUMLAH)' : 'Wang Keluar (WANG KELUAR)'
          }: ${formatRM(roundedAmount)} telah dikemaskini.`,
        });
      } else {
        const fallbackRecord: FinancialRecord = {
          id: `local-${Date.now()}`,
          rowNumber: 90000 + localRecords.length,
          timestamp: timestampStr,
          tarikhIso: entryDate,
          tarikhDisplay: isoToDisplayDate(entryDate),
          monthKey: entryDate.slice(0, 7),
          nama: cleanNama,
          noTelefon: cleanTel,
          unit: cleanUnitLabel,
          tarikhMasuk: isoToDisplayDate(entryDate),
          tarikhKeluar: '',
          perkara:
            cleanPerkara ||
            (cleanNama ? `Tempahan ${cleanUnitLabel} — ${cleanNama}`.trim() : 'Rekod Kewangan'),
          wangMasuk: isMasuk ? roundedAmount : 0,
          wangKeluar: !isMasuk ? roundedAmount : 0,
          baki: 0,
          jenis: isMasuk ? 'masuk' : 'keluar',
        };

        persistLocalRecords([fallbackRecord, ...localRecords]);
        setEntryPerkara('');
        setEntryAmount('');
        setEntryNama('');
        setEntryTelefon('');
        setSubmitFeedback({
          type: 'warning',
          text:
            'Rekod tidak dapat disahkan di Google Sheet buat masa ini. Rekod disimpan secara tempatan supaya pengiraan analisis kekal tepat.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Merge Google Sheet records + any local fallback records, sorted chronologically
  const allRecords = useMemo(() => {
    const merged = [...records, ...localRecords].sort((a, b) => {
      if (a.tarikhIso !== b.tarikhIso) return a.tarikhIso.localeCompare(b.tarikhIso);
      return a.rowNumber - b.rowNumber;
    });
    let running = 0;
    return merged.map((r) => {
      running += r.wangMasuk - r.wangKeluar;
      return { ...r, baki: running };
    });
  }, [records, localRecords]);

  // Available months sorted descending
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      if (r.monthKey && r.monthKey !== 'Lain-lain') {
        set.add(r.monthKey);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // Filtered records (by month, type, and search query)
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allRecords.filter((rec) => {
      if (selectedMonth !== 'semua' && rec.monthKey !== selectedMonth) {
        return false;
      }
      if (typeFilter === 'masuk' && rec.wangMasuk <= 0) {
        return false;
      }
      if (typeFilter === 'keluar' && rec.wangKeluar <= 0) {
        return false;
      }
      if (q) {
        const hay = `${rec.nama} ${rec.perkara} ${rec.unit} ${rec.noTelefon} ${rec.tarikhDisplay}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const chronological = [...list].sort((a, b) => {
      if (a.tarikhIso !== b.tarikhIso) return a.tarikhIso.localeCompare(b.tarikhIso);
      return a.rowNumber - b.rowNumber;
    });

    let running = 0;
    const withScopedBalance = chronological.map((r) => {
      running += r.wangMasuk - r.wangKeluar;
      return {
        ...r,
        scopedBaki: running,
      };
    });

    return sortOrder === 'desc' ? [...withScopedBalance].reverse() : withScopedBalance;
  }, [allRecords, selectedMonth, typeFilter, searchQuery, sortOrder]);

  // Summary metrics for selected month scope
  const monthScopedRecords = useMemo(() => {
    if (selectedMonth === 'semua') return allRecords;
    return allRecords.filter((r) => r.monthKey === selectedMonth);
  }, [allRecords, selectedMonth]);

  const summary = useMemo(() => {
    let totalMasuk = 0;
    let totalKeluar = 0;
    let countMasuk = 0;
    let countKeluar = 0;

    monthScopedRecords.forEach((r) => {
      if (r.wangMasuk > 0) {
        totalMasuk += r.wangMasuk;
        countMasuk += 1;
      }
      if (r.wangKeluar > 0) {
        totalKeluar += r.wangKeluar;
        countKeluar += 1;
      }
    });

    const baki = totalMasuk - totalKeluar;
    const marginPct = totalMasuk > 0 ? Math.round((baki / totalMasuk) * 100) : 0;

    return {
      totalMasuk,
      totalKeluar,
      baki,
      countMasuk,
      countKeluar,
      totalCount: monthScopedRecords.length,
      marginPct,
    };
  }, [monthScopedRecords]);

  // Filtered table totals
  const filteredTotals = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    filteredRecords.forEach((r) => {
      masuk += r.wangMasuk;
      keluar += r.wangKeluar;
    });
    return {
      masuk,
      keluar,
      baki: masuk - keluar,
    };
  }, [filteredRecords]);

  // Monthly cash flow aggregation
  const monthlyStats = useMemo(() => {
    const map = new Map<string, { monthKey: string; masuk: number; keluar: number; baki: number }>();
    allRecords.forEach((r) => {
      const key = r.monthKey || 'Lain-lain';
      const prev = map.get(key) || { monthKey: key, masuk: 0, keluar: 0, baki: 0 };
      prev.masuk += r.wangMasuk;
      prev.keluar += r.wangKeluar;
      prev.baki = prev.masuk - prev.keluar;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [allRecords]);

  const maxMonthlyVal = useMemo(() => {
    let max = 0;
    monthlyStats.forEach((m) => {
      if (m.masuk > max) max = m.masuk;
      if (m.keluar > max) max = m.keluar;
    });
    return max || 1;
  }, [monthlyStats]);

  // Income breakdown by Unit
  const incomeByUnit = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>();
    monthScopedRecords.forEach((r) => {
      if (r.wangMasuk <= 0) return;
      const key = r.unit || 'Lain-lain';
      const prev = map.get(key) || { label: key, total: 0, count: 0 };
      prev.total += r.wangMasuk;
      prev.count += 1;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [monthScopedRecords]);

  // Expense breakdown by Perkara
  const expenseByPerkara = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>();
    monthScopedRecords.forEach((r) => {
      if (r.wangKeluar <= 0) return;
      const key = r.perkara || 'Perbelanjaan Lain';
      const prev = map.get(key) || { label: key, total: 0, count: 0 };
      prev.total += r.wangKeluar;
      prev.count += 1;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [monthScopedRecords]);

  // Export filtered ledger to CSV
  const handleExportCsv = () => {
    const header = [
      'Tarikh',
      'Perkara',
      'Nama Tetamu',
      'Unit',
      'Wang Masuk (RM)',
      'Wang Keluar (RM)',
      'Baki (RM)',
    ];
    const chronological = [...filteredRecords].sort((a, b) => {
      if (a.tarikhIso !== b.tarikhIso) return a.tarikhIso.localeCompare(b.tarikhIso);
      return a.rowNumber - b.rowNumber;
    });

    const escapeCsv = (val: string | number) => {
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = chronological.map((r) => [
      r.tarikhDisplay,
      r.perkara,
      r.nama || '-',
      r.unit || '-',
      r.wangMasuk.toFixed(2),
      r.wangKeluar.toFixed(2),
      r.scopedBaki.toFixed(2),
    ]);

    rows.push([
      'JUMLAH',
      '',
      '',
      '',
      filteredTotals.masuk.toFixed(2),
      filteredTotals.keluar.toFixed(2),
      filteredTotals.baki.toFixed(2),
    ]);

    const csvContent =
      '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `laporan-kewangan-ss-homestay-${selectedMonth === 'semua' ? 'keseluruhan' : selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Sync printPeriod when top-bar selectedMonth changes
  useEffect(() => {
    setPrintPeriod(selectedMonth);
  }, [selectedMonth]);

  // Quick summary counts for the selected print period
  const printPeriodStats = useMemo(() => {
    const scoped =
      printPeriod === 'semua'
        ? allRecords
        : allRecords.filter((r) => r.monthKey === printPeriod);
    let masukCount = 0;
    let keluarCount = 0;
    let masukTotal = 0;
    let keluarTotal = 0;
    scoped.forEach((r) => {
      if (r.wangMasuk > 0) {
        masukCount += 1;
        masukTotal += r.wangMasuk;
      }
      if (r.wangKeluar > 0) {
        keluarCount += 1;
        keluarTotal += r.wangKeluar;
      }
    });
    return {
      totalCount: scoped.length,
      masukCount,
      keluarCount,
      masukTotal,
      keluarTotal,
      baki: masukTotal - keluarTotal,
    };
  }, [allRecords, printPeriod]);

  const handleTriggerPrint = (mode: FinancialPrintMode, periodOverride?: string) => {
    setPrintMode(mode);
    if (periodOverride !== undefined) {
      setPrintPeriod(periodOverride);
    }
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleDownloadPdf = (mode: FinancialPrintMode, periodOverride?: string) => {
    const targetPeriod = periodOverride !== undefined ? periodOverride : printPeriod;
    generateFinancialPdf({
      records: allRecords,
      mode,
      periodKey: targetPeriod,
      sheetMeta: meta,
    });
  };

  const handleSelectPrintScopeType = (scopeType: 'semua' | 'bulan') => {
    if (scopeType === 'semua') {
      setPrintPeriod('semua');
    } else {
      if (printPeriod === 'semua') {
        setPrintPeriod(availableMonths[0] || 'semua');
      }
    }
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Top Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900">
              Analisis Kewangan Google Sheet
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              <span>{meta?.title || 'Rekod Tempahan & Kewangan'}</span>
              {meta?.tab && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{meta.tab}</span>
                </>
              )}
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Lajur: Jumlah (Wang Masuk), Wang Keluar &amp; Perkara</span>
              {meta?.lastSyncedAt && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className="font-mono-num">Disegerak {meta.lastSyncedAt}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <select
              aria-label="Tapis mengikut bulan"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="semua">Semua Bulan</option>
              {availableMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {formatMonthLabel(mk)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPdf('keseluruhan', selectedMonth)}
              disabled={monthScopedRecords.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Muat Turun PDF</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Memuat...' : 'Kemaskini'}</span>
            </button>
          </div>
        </div>

        {/* Dedicated Print & PDF Center: Wang Masuk / Wang Keluar / Keseluruhan × Mengikut Bulan / Keseluruhan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 no-print">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-700 shrink-0" />
                <h4 className="text-sm font-bold text-slate-900">
                  Muat Turun PDF &amp; Cetak Laporan Analisis Kewangan
                </h4>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Tempoh laporan:{' '}
                <span className="font-semibold text-slate-800">
                  {printPeriod === 'semua'
                    ? 'Keseluruhan (Semua Bulan)'
                    : formatMonthLabel(printPeriod)}
                </span>
                <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
                <span className="font-mono-num">
                  {printPeriodStats.masukCount} masuk · {printPeriodStats.keluarCount} keluar
                </span>
              </p>
            </div>

            {/* Period Toggle: Keseluruhan vs Mengikut Bulan */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
                role="group"
                aria-label="Pilih tempoh cetakan"
              >
                <button
                  type="button"
                  onClick={() => handleSelectPrintScopeType('semua')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    printPeriod === 'semua'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Keseluruhan
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPrintScopeType('bulan')}
                  disabled={availableMonths.length === 0}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                    printPeriod !== 'semua'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Mengikut Bulan</span>
                </button>
              </div>

              {printPeriod !== 'semua' && (
                <select
                  aria-label="Pilih bulan untuk cetakan"
                  value={printPeriod}
                  onChange={(e) => setPrintPeriod(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  {availableMonths.map((mk) => (
                    <option key={mk} value={mk}>
                      {formatMonthLabel(mk)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Direct PDF Download Buttons */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Muat Turun Fail PDF (Format A4)
            </p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleDownloadPdf('masuk')}
                disabled={printPeriodStats.masukCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>PDF Wang Masuk</span>
                <span className="font-mono-num text-[11px] text-emerald-100">
                  ({printPeriodStats.masukCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPdf('keluar')}
                disabled={printPeriodStats.keluarCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>PDF Wang Keluar</span>
                <span className="font-mono-num text-[11px] text-rose-100">
                  ({printPeriodStats.keluarCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPdf('keseluruhan')}
                disabled={printPeriodStats.totalCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-700 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>PDF Keseluruhan</span>
                <span className="font-mono-num text-[11px] text-purple-200">
                  ({printPeriodStats.totalCount})
                </span>
              </button>
            </div>
          </div>

          {/* 4 Print Action Buttons */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Cetak Terus &amp; Pratonton
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => handleTriggerPrint('masuk')}
                disabled={printPeriodStats.masukCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span>Cetak Wang Masuk</span>
                <span className="font-mono-num text-[11px] text-emerald-700/80">
                  ({printPeriodStats.masukCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerPrint('keluar')}
                disabled={printPeriodStats.keluarCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                <span>Cetak Wang Keluar</span>
                <span className="font-mono-num text-[11px] text-rose-700/80">
                  ({printPeriodStats.keluarCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerPrint('keseluruhan')}
                disabled={printPeriodStats.totalCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5 shrink-0" />
                <span>Cetak Keseluruhan</span>
                <span className="font-mono-num text-[11px] text-slate-300">
                  ({printPeriodStats.totalCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintPreview(true)}
                disabled={allRecords.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Eye className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                <span>Pratonton Penyata A4</span>
              </button>
            </div>
          </div>
        </div>

      {/* Error Notice */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold">Ralat capaian data Google Sheet</p>
            <p className="mt-0.5 text-xs text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* 4-Column Flat KPI Summary Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Jumlah Wang Masuk</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono-num text-2xl font-bold text-emerald-700">
            {loading && allRecords.length === 0 ? '...' : formatRM(summary.totalMasuk)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono-num">
            {summary.countMasuk} transaksi · Lajur Jumlah
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Jumlah Wang Keluar</span>
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 font-mono-num text-2xl font-bold text-rose-700">
            {loading && allRecords.length === 0 ? '...' : formatRM(summary.totalKeluar)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono-num">
            {summary.countKeluar} transaksi · Lajur Wang Keluar
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Baki Bersih</span>
            <Wallet className="h-4 w-4 text-slate-700" />
          </div>
          <p
            className={`mt-2 font-mono-num text-2xl font-bold ${
              summary.baki >= 0 ? 'text-slate-900' : 'text-rose-700'
            }`}
          >
            {loading && allRecords.length === 0 ? '...' : formatRM(summary.baki)}
          </p>
          <p
            className={`mt-1 text-xs font-medium ${
              summary.baki >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {summary.baki >= 0 ? 'Status: Lebihan Tunai' : 'Status: Defisit Tunai'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Margin Baki</span>
            <span className="font-mono-num text-xs text-slate-400">
              {selectedMonth === 'semua' ? 'Keseluruhan' : formatMonthShort(selectedMonth)}
            </span>
          </div>
          <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
            {loading && allRecords.length === 0 ? '...' : `${summary.marginPct}%`}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono-num">
            {summary.totalCount} rekod kewangan aktif
          </p>
        </div>
      </div>

      {/* BORANG REKOD KEWANGAN (WANG KELUAR / WANG MASUK & PERKARA) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Borang Rekod Wang Masuk &amp; Wang Keluar
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Tambah rekod transaksi kewangan baharu (Jumlah, Wang Keluar &amp; Perkara) terus ke Google Sheet.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setEntryType('keluar');
                setSubmitFeedback(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                entryType === 'keluar'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Wang Keluar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryType('masuk');
                setSubmitFeedback(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                entryType === 'masuk'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>Wang Masuk</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmitFinanceEntry} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="fin-date" className="block text-xs font-semibold text-slate-700">
                Tarikh <span className="text-rose-600">*</span>
              </label>
              <input
                id="fin-date"
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="fin-perkara" className="block text-xs font-semibold text-slate-700">
                Perkara {entryType === 'keluar' && <span className="text-rose-600">*</span>}
              </label>
              <input
                id="fin-perkara"
                type="text"
                value={entryPerkara}
                onChange={(e) => setEntryPerkara(e.target.value)}
                placeholder={
                  entryType === 'keluar'
                    ? 'Contoh: Bil Elektrik TNB, Upah Kemas Rumah & Dobi'
                    : 'Contoh: Deposit Homestay, Bayaran Penuh Roomstay'
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label htmlFor="fin-amount" className="block text-xs font-semibold text-slate-700">
                {entryType === 'keluar' ? 'Jumlah Wang Keluar (RM)' : 'Jumlah Wang Masuk (RM)'}{' '}
                <span className="text-rose-600">*</span>
              </label>
              <input
                id="fin-amount"
                type="text"
                inputMode="decimal"
                required
                value={entryAmount}
                onChange={(e) => setEntryAmount(e.target.value)}
                placeholder="Contoh: 30 atau 150.50"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          {/* Quick Expense Perkara Presets */}
          {entryType === 'keluar' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">Pilihan pantas perkara:</span>
              {EXPENSE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEntryPerkara(preset)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  {preset}
                </button>
              ))}
            </div>
          )}

          {/* Extra fields for Wang Masuk */}
          {entryType === 'masuk' && (
            <div className="grid gap-4 sm:grid-cols-3 border-t border-slate-100 pt-4">
              <div>
                <label htmlFor="fin-nama" className="block text-xs font-semibold text-slate-700">
                  Nama Tetamu / Pembayar
                </label>
                <input
                  id="fin-nama"
                  type="text"
                  value={entryNama}
                  onChange={(e) => setEntryNama(e.target.value)}
                  placeholder="Contoh: En. Razak"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label htmlFor="fin-tel" className="block text-xs font-semibold text-slate-700">
                  No. Telefon (Pilihan)
                </label>
                <input
                  id="fin-tel"
                  type="tel"
                  value={entryTelefon}
                  onChange={(e) => setEntryTelefon(e.target.value)}
                  placeholder="Contoh: 012-3456789"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label htmlFor="fin-unit" className="block text-xs font-semibold text-slate-700">
                  Pilihan Unit
                </label>
                <select
                  id="fin-unit"
                  value={entryUnit}
                  onChange={(e) => setEntryUnit(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="H">Homestay (H)</option>
                  <option value="R">Roomstay (R)</option>
                  <option value="H+R">Homestay &amp; Roomstay (H+R)</option>
                  <option value="">Lain-lain</option>
                </select>
              </div>
            </div>
          )}

          {submitFeedback && (
            <div
              role="status"
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs font-medium ${
                submitFeedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : submitFeedback.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {submitFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{submitFeedback.text}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
            <p className="text-xs text-slate-500">
              {entryType === 'keluar'
                ? 'Akan direkodkan ke lajur PERKARA & WANG KELUAR dalam Google Sheet.'
                : 'Akan direkodkan ke lajur NAMA, PILIHAN MENGINAP, JUMLAH & PERKARA dalam Google Sheet.'}
            </p>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 ${
                entryType === 'keluar'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>
                    {entryType === 'keluar' ? 'Simpan Wang Keluar' : 'Simpan Wang Masuk'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Visual Analytics: Monthly Cash Flow + Breakdowns */}
      {monthlyStats.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Monthly Bar Chart */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Aliran Tunai Bulanan</h4>
                <p className="text-xs text-slate-500">
                  Perbandingan Wang Masuk berbanding Wang Keluar mengikut bulan
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                  Wang Masuk
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" />
                  Wang Keluar
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {monthlyStats.map((m) => {
                const masukPct = Math.round((m.masuk / maxMonthlyVal) * 100);
                const keluarPct = Math.round((m.keluar / maxMonthlyVal) * 100);
                const isActiveMonth = selectedMonth === m.monthKey;

                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() =>
                      setSelectedMonth(isActiveMonth ? 'semua' : m.monthKey)
                    }
                    className={`w-full text-left rounded-lg p-2.5 -mx-2.5 transition-colors ${
                      isActiveMonth ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-900">
                        {formatMonthLabel(m.monthKey)}
                      </span>
                      <span className="font-mono-num text-slate-600">
                        Baki:{' '}
                        <strong
                          className={
                            m.baki >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }
                        >
                          {formatRM(m.baki)}
                        </strong>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 flex-1 rounded-xs bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-xs bg-emerald-600 transition-all duration-300"
                            style={{ width: `${m.masuk > 0 ? Math.max(masukPct, 3) : 0}%` }}
                          />
                        </div>
                        <span className="w-24 text-right font-mono-num text-[11px] font-medium text-emerald-700">
                          {formatRM(m.masuk)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="h-2.5 flex-1 rounded-xs bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-xs bg-rose-500 transition-all duration-300"
                            style={{ width: `${m.keluar > 0 ? Math.max(keluarPct, 3) : 0}%` }}
                          />
                        </div>
                        <span className="w-24 text-right font-mono-num text-[11px] font-medium text-rose-700">
                          {formatRM(m.keluar)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Unit Income + Expense Perkara Breakdown */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="text-sm font-bold text-slate-900">Wang Masuk Mengikut Unit</h4>
              <p className="text-xs text-slate-500">Pecahan hasil daripada lajur Jumlah</p>

              {incomeByUnit.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500">
                  Tiada rekod wang masuk bagi tempoh ini.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {incomeByUnit.map((item) => {
                    const pct =
                      summary.totalMasuk > 0
                        ? Math.round((item.total / summary.totalMasuk) * 100)
                        : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">
                            {item.label}{' '}
                            <span className="text-slate-400 font-mono-num">({item.count})</span>
                          </span>
                          <span className="font-mono-num font-semibold text-slate-900">
                            {formatRM(item.total)} · {pct}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full rounded-xs bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-xs bg-emerald-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="text-sm font-bold text-slate-900">Pecahan Perkara Wang Keluar</h4>
              <p className="text-xs text-slate-500">Ringkasan perbelanjaan mengikut lajur Perkara</p>

              {expenseByPerkara.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500">
                  Tiada rekod wang keluar bagi tempoh ini.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100">
                  {expenseByPerkara.map((item) => {
                    const pct =
                      summary.totalKeluar > 0
                        ? Math.round((item.total / summary.totalKeluar) * 100)
                        : 0;
                    return (
                      <div
                        key={item.label}
                        className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{item.label}</p>
                          <p className="text-[11px] text-slate-400 font-mono-num">
                            {item.count} rekod · {pct}% daripada jumlah keluar
                          </p>
                        </div>
                        <span className="font-mono-num font-semibold text-rose-700 whitespace-nowrap shrink-0">
                          {formatRM(item.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Financial Ledger Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 p-5">
          <div>
            <h4 className="text-base font-bold text-slate-900">Lejar Rekod Kewangan</h4>
            <p className="text-xs text-slate-500">
              Memaparkan {filteredRecords.length} daripada {allRecords.length} rekod berjumlah RM
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari perkara atau nama..."
                className="w-48 sm:w-56 rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'semua', label: 'Semua' },
                  { id: 'masuk', label: 'Wang Masuk' },
                  { id: 'keluar', label: 'Wang Keluar' },
                ] as { id: TypeFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    typeFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {sortOrder === 'desc' ? 'Terkini Dahulu' : 'Terdahulu Dahulu'}
            </button>
          </div>
        </div>

        {loading && allRecords.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">Tiada rekod kewangan ditemui</p>
            <p className="mt-1 text-xs text-slate-500">
              Gunakan borang di atas untuk menambah rekod baharu atau laraskan penapis carian anda.
            </p>
            {(searchQuery || typeFilter !== 'semua' || selectedMonth !== 'semua') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('semua');
                  setSelectedMonth('semua');
                }}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Tetapkan Semula Penapis
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">Tarikh</th>
                  <th className="py-3 px-3">Perkara &amp; Butiran</th>
                  <th className="py-3 px-3 whitespace-nowrap">Jenis</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Wang Masuk (RM)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Wang Keluar (RM)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Baki (RM)</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap no-print">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.map((rec) => {
                  const isLocal = rec.id.startsWith('local-');
                  const validPhone = normalizeMalaysiaPhone(rec.noTelefon);
                  const waHref = validPhone
                    ? buildWhatsAppUrl(
                        validPhone,
                        buildAdminConfirmationMessage({
                          nama: rec.nama || 'Tetamu',
                          unit: rec.unit,
                          tarikhMasuk: rec.tarikhIso,
                          tarikhKeluar: rec.tarikhKeluar || rec.tarikhIso,
                          jumlah: rec.wangMasuk,
                        })
                      )
                    : '';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-5 pr-3 font-mono-num text-xs text-slate-600 whitespace-nowrap align-top">
                        {rec.tarikhDisplay}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <p className="font-medium text-slate-900 leading-snug">
                          {rec.perkara}
                          {isLocal && (
                            <span className="ml-2 text-[11px] font-medium text-amber-700">
                              (Simpanan Tempatan)
                            </span>
                          )}
                        </p>
                        {(rec.nama || rec.tarikhMasuk || validPhone) && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {rec.nama && <span>{rec.nama}</span>}
                            {rec.unit && (
                              <>
                                {rec.nama && <span className="mx-1.5" aria-hidden="true">·</span>}
                                <span>{rec.unit}</span>
                              </>
                            )}
                            {validPhone && (
                              <>
                                <span className="mx-1.5" aria-hidden="true">·</span>
                                <span className="font-mono-num">{formatDisplayPhone(rec.noTelefon)}</span>
                              </>
                            )}
                            {rec.tarikhMasuk && rec.tarikhKeluar && (
                              <>
                                <span className="mx-1.5" aria-hidden="true">·</span>
                                <span className="font-mono-num">
                                  {rec.tarikhMasuk} → {rec.tarikhKeluar}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold whitespace-nowrap align-top">
                        {rec.jenis === 'masuk' && (
                          <span className="text-emerald-700">Wang Masuk</span>
                        )}
                        {rec.jenis === 'keluar' && (
                          <span className="text-rose-700">Wang Keluar</span>
                        )}
                        {rec.jenis === 'campuran' && (
                          <span className="text-amber-700">Masuk &amp; Keluar</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-xs font-semibold text-emerald-700 whitespace-nowrap align-top">
                        {rec.wangMasuk > 0 ? formatRM(rec.wangMasuk) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-xs font-semibold text-rose-700 whitespace-nowrap align-top">
                        {rec.wangKeluar > 0 ? formatRM(rec.wangKeluar) : '—'}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono-num text-xs font-bold whitespace-nowrap align-top ${
                          rec.scopedBaki >= 0 ? 'text-slate-900' : 'text-rose-700'
                        }`}
                      >
                        {formatRM(rec.scopedBaki)}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap align-top no-print">
                        <div className="inline-flex items-center gap-1.5">
                          {waHref && (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                              title="Hantar WhatsApp pengesahan tempahan kepada nombor telefon tetamu"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          {isLocal && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLocalRecord(rec.id)}
                              className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100"
                              title="Padam rekod tempatan"
                              aria-label="Padam rekod tempatan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!waHref && !isLocal && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-bold text-slate-900">
                  <td colSpan={3} className="py-3.5 pl-5 pr-3">
                    Jumlah Keseluruhan (Paparan Semasa)
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-emerald-700 whitespace-nowrap">
                    {formatRM(filteredTotals.masuk)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-rose-700 whitespace-nowrap">
                    {formatRM(filteredTotals.keluar)}
                  </td>
                  <td
                    className={`py-3.5 px-3 text-right font-mono-num whitespace-nowrap ${
                      filteredTotals.baki >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {formatRM(filteredTotals.baki)}
                  </td>
                  <td className="no-print" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* On-Screen A4 Print Preview Modal */}
      {showPrintPreview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/75 backdrop-blur-xs print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Pratonton Cetakan Analisis Kewangan"
        >
          {/* Preview Modal Top Bar */}
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {(
                    [
                      { id: 'keseluruhan', label: 'Keseluruhan' },
                      { id: 'masuk', label: 'Wang Masuk' },
                      { id: 'keluar', label: 'Wang Keluar' },
                    ] as { id: FinancialPrintMode; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrintMode(opt.id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        printMode === opt.id
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Tempoh laporan pratonton"
                  value={printPeriod}
                  onChange={(e) => setPrintPeriod(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="semua">Keseluruhan (Semua Bulan)</option>
                  {availableMonths.map((mk) => (
                    <option key={mk} value={mk}>
                      {formatMonthLabel(mk)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(printMode, printPeriod)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Muat Turun PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable A4 Sheet Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto max-w-[210mm] rounded-lg border border-slate-200 bg-white p-6 sm:p-10 shadow-xl">
              <FinancialPrintReport
                records={allRecords}
                printMode={printMode}
                periodKey={printPeriod}
                sheetMeta={meta}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Print-Only A4 Financial Report Container */}
      <div className="hidden print:block">
        <FinancialPrintReport
          records={allRecords}
          printMode={printMode}
          periodKey={printPeriod}
          sheetMeta={meta}
        />
      </div>
    </>
  );
};
