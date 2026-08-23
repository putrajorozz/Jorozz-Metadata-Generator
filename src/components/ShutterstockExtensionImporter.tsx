import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Sparkles, 
  ExternalLink, 
  Chrome, 
  Code, 
  Play, 
  HelpCircle, 
  FileSpreadsheet, 
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  FileCheck,
  ChevronRight,
  ShieldAlert,
  Zap,
  Tag,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { ImageData } from '../types';
import { cn } from '../lib/utils';

interface ShutterstockExtensionImporterProps {
  images: ImageData[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface CsvRow {
  filename: string;
  description: string;
  keywords: string[];
  categories: string[];
  editorial: string;
  mature: string;
  illustration: string;
  raw: Record<string, string>;
}

export function ShutterstockExtensionImporter({ images, addToast }: ShutterstockExtensionImporterProps) {
  const [activeTab, setActiveTab] = useState<'download' | 'simulator' | 'script' | 'code'>('download');
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCodeFile, setSelectedCodeFile] = useState<'manifest' | 'content' | 'popup' | 'popupHtml' | 'css'>('content');
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Parse CSV string into structured CsvRow objects
  const parseCSV = (csvText: string): CsvRow[] => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const splitCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
    const findIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const idxFilename = findIndex(['filename', 'file name', 'file', 'name']);
    const idxDesc = findIndex(['description', 'title', 'caption']);
    const idxKeywords = findIndex(['keywords', 'tags', 'keyword']);
    const idxCategories = findIndex(['categories', 'category']);
    const idxEditorial = findIndex(['editorial']);
    const idxMature = findIndex(['mature', 'nsfw', 'adult']);
    const idxIllustration = findIndex(['illustration', 'vector']);

    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue;
      const values = splitCSVLine(rawLine);

      const filename = idxFilename !== -1 && values[idxFilename] ? values[idxFilename].replace(/^"|"$/g, '') : `file_${i}.eps`;
      const description = idxDesc !== -1 && values[idxDesc] ? values[idxDesc].replace(/^"|"$/g, '') : '';
      const rawKeywords = idxKeywords !== -1 && values[idxKeywords] ? values[idxKeywords].replace(/^"|"$/g, '') : '';
      const rawCategories = idxCategories !== -1 && values[idxCategories] ? values[idxCategories].replace(/^"|"$/g, '') : '';
      const editorial = idxEditorial !== -1 && values[idxEditorial] ? values[idxEditorial].replace(/^"|"$/g, '') : 'No';
      const mature = idxMature !== -1 && values[idxMature] ? values[idxMature].replace(/^"|"$/g, '') : 'No';
      const illustration = idxIllustration !== -1 && values[idxIllustration] ? values[idxIllustration].replace(/^"|"$/g, '') : (filename.toLowerCase().endsWith('.eps') ? 'Yes' : 'No');

      const keywords = rawKeywords
        ? rawKeywords.split(/[,;]/).map(k => k.trim()).filter(Boolean)
        : [];

      const categories = rawCategories
        ? rawCategories.split(/[,;]/).map(c => c.trim()).filter(Boolean)
        : ['Miscellaneous'];

      const rawRecord: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rawRecord[h] = values[idx] || '';
      });

      rows.push({
        filename,
        description,
        keywords,
        categories,
        editorial,
        mature,
        illustration,
        raw: rawRecord
      });
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const parsed = parseCSV(text);
      setParsedRows(parsed);
      addToast(`Berhasil memuat ${parsed.length} baris metadata dari ${file.name}`, 'success');
    };
    reader.readAsText(file);
  };

  const handleLoadFromCurrentApp = () => {
    const completed = images.filter(img => img.status === 'completed' && img.metadata);
    if (completed.length === 0) {
      addToast('Belum ada gambar yang selesai di-generate di tab utama!', 'info');
      return;
    }

    const headers = ["Filename", "Description", "Keywords", "Categories", "Editorial", "Mature content", "Illustration"];
    const rows = completed.map(img => {
      const name = img.file.name.replace(/\.[^/.]+$/, "") + ".eps";
      const desc = img.metadata!.title || img.metadata!.description;
      const kw = img.metadata!.keywords.join(', ');
      const cat = (img.metadata!.categories || ['Miscellaneous']).join(',');
      return [
        name,
        `"${desc.replace(/"/g, '""')}"`,
        `"${kw.replace(/"/g, '""')}"`,
        `"${cat.replace(/"/g, '""')}"`,
        'No',
        'No',
        'Yes'
      ].join(',');
    });

    const fullCsv = [headers.join(','), ...rows].join('\n');
    setCsvContent(fullCsv);
    setCsvFileName(`shutterstock_current_batch_${completed.length}.csv`);
    const parsed = parseCSV(fullCsv);
    setParsedRows(parsed);
    addToast(`Berhasil mengimpor ${parsed.length} metadata dari tab AI Generator!`, 'success');
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    addToast(`${label} disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Extension Manifest v1.3.3
  const extensionManifest = `{
  "manifest_version": 3,
  "name": "Shutterstock CSV Auto-Filler",
  "version": "1.3.3",
  "description": "Auto-fill Title, Keywords, and Categories on Shutterstock Contributor portal from CSV by matching filenames (e.g. file.eps).",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "*://*.shutterstock.com/*",
    "*://shutterstock.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Shutterstock CSV Auto-Filler"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.shutterstock.com/*",
        "*://shutterstock.com/*"
      ],
      "css": ["content.css"],
      "js": ["content.js"],
      "all_frames": false,
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "48": "icon48.png",
    "128": "icon128.png"
  }
}`;

  // Extension Content Script v1.3.3
  const extensionContentJs = `// Shutterstock CSV Auto-Filler Content Script v1.3.3
(function() {
  console.log('[Shutterstock Auto-Filler] Initializing script on:', window.location.href);

  function injectStyles() {
    if (document.getElementById('sstk-af-injected-css')) return;
    const style = document.createElement('style');
    style.id = 'sstk-af-injected-css';
    style.textContent = \`
      .sstk-af-hidden {
        display: none !important;
      }
      #sstk-af-launcher-badge {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        background: #4f46e5 !important;
        color: #ffffff !important;
        padding: 10px 16px !important;
        border-radius: 9999px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
        cursor: pointer !important;
        transition: transform 0.2s ease !important;
        user-select: none !important;
      }
      #sstk-af-launcher-badge:hover {
        transform: translateY(-2px) scale(1.05) !important;
        background: #4338ca !important;
      }
      #sstk-csv-autofill-panel {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        width: 360px !important;
        min-width: 360px !important;
        max-width: 360px !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: calc(100vh - 32px) !important;
        background: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1) !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        color: #1e293b !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        margin: 0 !important;
        padding: 0 !important;
        transition: none !important;
        transform: none !important;
        align-self: flex-start !important;
      }
      #sstk-csv-autofill-panel * { box-sizing: border-box !important; }
      .sstk-af-header {
        background: #4f46e5 !important;
        color: #ffffff !important;
        padding: 12px 16px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        font-weight: 700 !important;
        font-size: 13px !important;
        cursor: move !important;
        user-select: none !important;
        flex: 0 0 auto !important;
      }
      .sstk-af-title { display: flex !important; align-items: center !important; gap: 8px !important; }
      .sstk-af-header-actions { display: flex !important; align-items: center !important; gap: 6px !important; }
      .sstk-af-header-actions button {
        background: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        color: #ffffff !important;
        font-size: 14px !important;
        font-weight: bold !important;
        line-height: 1 !important;
        cursor: pointer !important;
        padding: 2px 8px !important;
        border-radius: 6px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 26px !important;
        height: 24px !important;
        transition: all 0.15s ease !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
      }
      .sstk-af-header-actions button:hover {
        background: rgba(255, 255, 255, 0.4) !important;
        color: #ffffff !important;
        transform: scale(1.05) !important;
      }
      .sstk-af-header-actions button:active {
        transform: scale(0.95) !important;
      }
      .sstk-af-body {
        padding: 14px 16px !important;
        margin: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        height: auto !important;
        min-height: 0 !important;
        flex: 0 0 auto !important;
      }
      .sstk-af-desc { font-size: 11px !important; color: #64748b !important; margin: 0 0 12px 0 !important; line-height: 1.4 !important; }
      .sstk-af-dropzone {
        border: 2px dashed #cbd5e1 !important;
        border-radius: 10px !important;
        padding: 12px !important;
        text-align: center !important;
        background: #f8fafc !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        margin-bottom: 10px !important;
        position: relative !important;
      }
      .sstk-af-dropzone:hover { border-color: #6366f1 !important; background: #eef2ff !important; }
      .sstk-af-dropzone input[type="file"] { display: none !important; }
      .sstk-af-file-label { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; font-size: 11px !important; font-weight: 600 !important; color: #475569 !important; cursor: pointer !important; }
      .sstk-af-status-box { background: #f1f5f9 !important; border-radius: 8px !important; padding: 8px 12px !important; margin: 10px 0 !important; font-size: 11px !important; }
      .sstk-af-stat-row { display: flex !important; justify-content: space-between !important; margin: 3px 0 !important; }
      .sstk-match-highlight { color: #16a34a !important; }
      .sstk-af-actions { display: flex !important; gap: 8px !important; margin-top: 10px !important; }
      .sstk-btn { flex: 1 !important; padding: 8px 12px !important; border-radius: 8px !important; font-size: 11px !important; font-weight: 700 !important; cursor: pointer !important; border: none !important; transition: all 0.15s ease !important; }
      .sstk-btn-primary { background: #4f46e5 !important; color: #ffffff !important; }
      .sstk-btn-primary:hover:not(:disabled) { background: #4338ca !important; }
      .sstk-btn-secondary { background: #e2e8f0 !important; color: #334155 !important; }
      .sstk-btn:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }
      .sstk-af-progress-container { margin: 10px 0 !important; }
      .sstk-af-progress-bar { height: 6px !important; background: #e2e8f0 !important; border-radius: 3px !important; overflow: hidden !important; }
      #sstk-af-progress-fill { height: 100% !important; background: #22c55e !important; transition: width 0.2s ease !important; }
      #sstk-af-progress-text { font-size: 10px !important; color: #64748b !important; display: block !important; text-align: right !important; margin-top: 4px !important; }
      .sstk-af-logs { max-height: 110px !important; overflow-y: auto !important; background: #0f172a !important; color: #e2e8f0 !important; font-family: monospace !important; font-size: 10px !important; padding: 6px 8px !important; border-radius: 6px !important; margin-top: 10px !important; flex: 0 0 auto !important; }
      .sstk-af-logs:empty { display: none !important; }
      .sstk-log-item { margin-bottom: 2px !important; line-height: 1.3 !important; }
      .sstk-log-info { color: #94a3b8 !important; }
      .sstk-log-success { color: #4ade80 !important; }
      .sstk-log-warning { color: #facc15 !important; }
      .sstk-log-error { color: #f87171 !important; }
    \`;
    (document.head || document.documentElement).appendChild(style);
  }

  function createOrShowPanel() {
    injectStyles();

    let panel = document.getElementById('sstk-csv-autofill-panel');
    let launcher = document.getElementById('sstk-af-launcher-badge');

    if (panel) {
      panel.classList.remove('sstk-af-hidden');
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
      return;
    }

    if (!launcher) {
      launcher = document.createElement('div');
      launcher.id = 'sstk-af-launcher-badge';
      launcher.innerHTML = \`
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        <span>CSV Filler</span>
      \`;
      launcher.addEventListener('click', () => {
        const p = document.getElementById('sstk-csv-autofill-panel');
        if (p) {
          if (p.classList.contains('sstk-af-hidden')) {
            p.classList.remove('sstk-af-hidden');
          } else {
            p.classList.add('sstk-af-hidden');
          }
        } else {
          createOrShowPanel();
        }
      });
      (document.body || document.documentElement).appendChild(launcher);
    }

    panel = document.createElement('div');
    panel.id = 'sstk-csv-autofill-panel';
    panel.innerHTML = \`
      <div class="sstk-af-header" id="sstk-af-header">
        <div class="sstk-af-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <span>Shutterstock CSV Filler</span>
          <span style="font-size: 10px; opacity: 0.8; font-weight: normal; margin-left: 4px; cursor: move;">⋮⋮ Geser Box</span>
        </div>
        <div class="sstk-af-header-actions">
          <button id="sstk-af-minimize" title="Minimize / Perkecil" type="button">&minus;</button>
          <button id="sstk-af-close" title="Tutup Panel" type="button">&times;</button>
        </div>
      </div>
      <div class="sstk-af-body" id="sstk-af-body">
        <p class="sstk-af-desc">Pilih file CSV untuk mencocokkan nama file (.eps/.jpg) dan mengisi Title, Keywords, dan Kategori secara otomatis.</p>
        
        <div class="sstk-af-dropzone" id="sstk-af-dropzone">
          <input type="file" id="sstk-af-file" accept=".csv" />
          <label for="sstk-af-file" class="sstk-af-file-label">
            <span class="sstk-af-upload-icon">&#128196;</span>
            <span id="sstk-af-file-text">Pilih File CSV (.csv)</span>
          </label>
        </div>

        <div id="sstk-af-status-box" style="display:none;" class="sstk-af-status-box">
          <div class="sstk-af-stat-row">
            <span>Baris CSV:</span> <b id="sstk-af-csv-count">0</b>
          </div>
          <div class="sstk-af-stat-row">
            <span>Item di Halaman:</span> <b id="sstk-af-page-count">0</b>
          </div>
          <div class="sstk-af-stat-row">
            <span>Cocok (Matched):</span> <b id="sstk-af-match-count" class="sstk-match-highlight">0</b>
          </div>
        </div>

        <div class="sstk-af-actions">
          <button id="sstk-af-btn-match" class="sstk-btn sstk-btn-secondary" disabled>1. Scan & Cocokkan</button>
          <button id="sstk-af-btn-fill" class="sstk-btn sstk-btn-primary" disabled>2. Auto-Fill ke Form</button>
        </div>

        <div class="sstk-af-progress-container" id="sstk-af-progress-container" style="display:none;">
          <div class="sstk-af-progress-bar"><div id="sstk-af-progress-fill" style="width: 0%;"></div></div>
          <span id="sstk-af-progress-text">0 / 0 diisi</span>
        </div>

        <div class="sstk-af-logs" id="sstk-af-logs"></div>
      </div>
    \`;

    (document.body || document.documentElement).appendChild(panel);

    const headerEl = document.getElementById('sstk-af-header');
    if (headerEl) {
      let isDragging = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;

      const onStart = (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        isDragging = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;

        const rect = panel.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        const currentHeight = rect.height;

        // Strictly freeze panel width & height during dragging to prevent any browser expansion or shape deformation
        panel.style.width = '360px';
        panel.style.minWidth = '360px';
        panel.style.maxWidth = '360px';
        panel.style.height = currentHeight + 'px';
        panel.style.minHeight = currentHeight + 'px';
        panel.style.maxHeight = currentHeight + 'px';

        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = initialLeft + 'px';
        panel.style.top = initialTop + 'px';

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
      };

      const onMove = (e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const maxLeft = Math.max(0, window.innerWidth - 360);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        if (e.cancelable) e.preventDefault();
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        // Release height locks back to auto after dragging completes
        panel.style.height = 'auto';
        panel.style.minHeight = '0px';
        panel.style.maxHeight = 'calc(100vh - 32px)';

        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      };

      headerEl.addEventListener('mousedown', onStart);
      headerEl.addEventListener('touchstart', onStart, { passive: false });
    }

    const btnMin = document.getElementById('sstk-af-minimize');
    const btnClose = document.getElementById('sstk-af-close');
    const bodyEl = document.getElementById('sstk-af-body');

    if (btnMin && bodyEl) {
      const toggleMinimize = (e) => {
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }
        const isHidden = bodyEl.classList.contains('sstk-af-hidden');
        if (isHidden) {
          bodyEl.classList.remove('sstk-af-hidden');
          btnMin.innerHTML = '&minus;';
          btnMin.title = 'Minimize / Perkecil';
        } else {
          bodyEl.classList.add('sstk-af-hidden');
          btnMin.innerHTML = '&#9633;';
          btnMin.title = 'Expand / Perbesar';
        }
      };

      btnMin.addEventListener('click', toggleMinimize);
      btnMin.addEventListener('mousedown', (e) => e.stopPropagation());
      btnMin.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
    }

    if (btnClose) {
      const handleClose = (e) => {
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }
        panel.classList.add('sstk-af-hidden');
      };

      btnClose.addEventListener('click', handleClose);
      btnClose.addEventListener('mousedown', (e) => e.stopPropagation());
      btnClose.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
    }

    let csvData = [];
    let matchedList = [];

    const fileInput = document.getElementById('sstk-af-file');
    const fileText = document.getElementById('sstk-af-file-text');
    const statusBox = document.getElementById('sstk-af-status-box');
    const btnMatch = document.getElementById('sstk-af-btn-match');
    const btnFill = document.getElementById('sstk-af-btn-fill');
    const logsEl = document.getElementById('sstk-af-logs');
    const progressContainer = document.getElementById('sstk-af-progress-container');
    const progressFill = document.getElementById('sstk-af-progress-fill');
    const progressText = document.getElementById('sstk-af-progress-text');

    function log(msg, type = 'info') {
      const row = document.createElement('div');
      row.className = 'sstk-log-item sstk-log-' + type;
      row.textContent = msg;
      logsEl.appendChild(row);
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    function parseCSV(text) {
      const lines = text.trim().split(/\\r?\\n/);
      if (lines.length < 2) return [];

      const splitLine = (l) => {
        const res = [];
        let cur = '', inQ = false;
        for (let i = 0; i < l.length; i++) {
          const c = l[i];
          if (c === '"') {
            if (inQ && l[i+1] === '"') { cur += '"'; i++; }
            else { inQ = !inQ; }
          } else if (c === ',' && !inQ) {
            res.push(cur.trim()); cur = '';
          } else {
            cur += c;
          }
        }
        res.push(cur.trim());
        return res;
      };

      const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
      const findIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));

      const idxName = findIdx(['filename', 'file name', 'file', 'name']);
      const idxDesc = findIdx(['description', 'title', 'caption']);
      const idxKw = findIdx(['keywords', 'tags', 'keyword']);
      const idxCat = findIdx(['categories', 'category']);
      const idxIll = findIdx(['illustration', 'vector']);

      const list = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = splitLine(line);
        const filename = idxName !== -1 && vals[idxName] ? vals[idxName].replace(/^"|"$/g, '') : '';
        if (!filename) continue;

        list.push({
          filename: filename,
          baseName: filename.replace(/\\.[^/.]+$/, '').toLowerCase(),
          description: idxDesc !== -1 && vals[idxDesc] ? vals[idxDesc].replace(/^"|"$/g, '') : '',
          keywords: idxKw !== -1 && vals[idxKw] ? vals[idxKw].replace(/^"|"$/g, '') : '',
          categories: idxCat !== -1 && vals[idxCat] ? vals[idxCat].replace(/^"|"$/g, '') : '',
          illustration: idxIll !== -1 && vals[idxIll] ? vals[idxIll].replace(/^"|"$/g, '') : ''
        });
      }
      return list;
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (fileText) fileText.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
          csvData = parseCSV(ev.target.result);
          log(\`Memuat \${csvData.length} baris dari \${file.name}\`, 'success');
          statusBox.style.display = 'block';
          document.getElementById('sstk-af-csv-count').textContent = csvData.length;
          btnMatch.disabled = false;
          btnFill.disabled = true;
          scanAndMatch();
        };
        reader.readAsText(file);
      });
    }

    function getShutterstockItems() {
      const items = [];
      const selectors = [
        '[data-automation="media-card"]',
        '.media-card',
        '.item-card',
        'div[class*="MediaCard"]',
        'div[class*="CardContainer"]',
        'tr[class*="table-row"]',
        '.contributor-media-card',
        'div[data-automation*="item"]'
      ];

      let foundCards = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els && els.length > 0) {
          foundCards = Array.from(els);
          break;
        }
      }

      if (foundCards.length === 0) {
        const allDivs = document.querySelectorAll('div, span, p, tr');
        allDivs.forEach(el => {
          const text = el.textContent || '';
          if (/\\.(eps|jpg|jpeg|png|svg|ai|zip)/i.test(text) && el.children.length === 0) {
            const parentCard = el.closest('[role="button"], [class*="card"], [class*="item"], tr, div') || el.parentElement;
            if (parentCard && !foundCards.includes(parentCard)) {
              foundCards.push(parentCard);
            }
          }
        });
      }

      foundCards.forEach((card) => {
        const text = card.textContent || '';
        let filename = '';
        const match = text.match(/([a-zA-Z0-9_\\-\\.\\s]+\\.(eps|jpg|jpeg|png|svg|ai|zip))/i);
        if (match) {
          filename = match[1].trim();
        } else {
          const img = card.querySelector('img[alt], img[title]');
          if (img) {
            const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
            const m2 = alt.match(/([a-zA-Z0-9_\\-\\.\\s]+\\.(eps|jpg|jpeg|png|svg|ai|zip))/i);
            if (m2) filename = m2[1].trim();
          }
        }

        if (filename) {
          items.push({
            element: card,
            filename: filename,
            baseName: filename.replace(/\\.[^/.]+$/, '').toLowerCase()
          });
        }
      });

      return items;
    }

    function scanAndMatch() {
      if (!csvData || csvData.length === 0) {
        log('Silakan pilih file CSV terlebih dahulu', 'error');
        return;
      }

      const pageItems = getShutterstockItems();
      document.getElementById('sstk-af-page-count').textContent = pageItems.length;

      matchedList = [];
      pageItems.forEach(item => {
        const matchedCsv = csvData.find(c => 
          c.filename.toLowerCase() === item.filename.toLowerCase() ||
          c.baseName === item.baseName
        );

        if (matchedCsv) {
          matchedList.push({
            pageItem: item,
            csv: matchedCsv
          });
        }
      });

      document.getElementById('sstk-af-match-count').textContent = matchedList.length;

      if (matchedList.length > 0) {
        log(\`Ditemukan \${matchedList.length} item cocok dari \${pageItems.length} di halaman.\`, 'success');
        btnFill.disabled = false;
      } else {
        log(\`Tidak ada kecocokan. CSV (\${csvData.length}) vs Halaman (\${pageItems.length}). Upload atau unggah gambar ke Shutterstock terlebih dahulu.\`, 'warning');
        btnFill.disabled = true;
      }
    }

    btnMatch.addEventListener('click', scanAndMatch);

    function findDescriptionInput() {
      const candidates = Array.from(document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]'));
      const sidebarFields = candidates.filter(el => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        const isRightSide = rect.left > 200;
        return isVisible && isRightSide;
      });

      for (const el of sidebarFields) {
        const attrStr = (el.name + ' ' + el.id + ' ' + el.placeholder + ' ' + el.getAttribute('aria-label') + ' ' + el.getAttribute('data-automation')).toLowerCase();
        if (attrStr.includes('description') || attrStr.includes('title') || attrStr.includes('deskripsi') || attrStr.includes('minimal') || attrStr.includes('word')) {
          return el;
        }
      }

      const textareas = sidebarFields.filter(el => el.tagName === 'TEXTAREA');
      if (textareas.length > 0) return textareas[0];
      return sidebarFields[0] || null;
    }

    function findKeywordInput() {
      const candidates = Array.from(document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]'));
      const sidebarFields = candidates.filter(el => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        const isRightSide = rect.left > 200;
        return isVisible && isRightSide;
      });

      for (const el of sidebarFields) {
        const attrStr = (el.name + ' ' + el.id + ' ' + el.placeholder + ' ' + el.getAttribute('aria-label') + ' ' + el.getAttribute('data-automation')).toLowerCase();
        if (attrStr.includes('keyword') || attrStr.includes('kata kunci') || attrStr.includes('tag')) {
          return el;
        }
      }

      const descInput = findDescriptionInput();
      const nonDescInputs = sidebarFields.filter(el => el !== descInput && el.tagName === 'INPUT');
      if (nonDescInputs.length > 0) return nonDescInputs[nonDescInputs.length - 1];
      return null;
    }

    async function fillValueIntoElement(el, value) {
      if (!el || value === undefined || value === null) return false;

      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.click();
        await new Promise(r => setTimeout(r, 80));

        if (typeof el.select === 'function') {
          try { el.select(); } catch (e) {}
        }

        try {
          document.execCommand('insertText', false, value);
        } catch (e) {}

        try {
          const proto = Object.getPrototypeOf(el);
          const protoSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          const ownSet = Object.getOwnPropertyDescriptor(el, 'value')?.set;

          if (protoSet && ownSet !== protoSet) {
            protoSet.call(el, value);
          } else if (ownSet) {
            ownSet.call(el, value);
          } else {
            el.value = value;
          }

          if (el._valueTracker) {
            el._valueTracker.setValue('');
          }
        } catch (e) {}

        try {
          el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: String(value) }));
          el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
        } catch (e) {}

        return true;
      } catch (err) {
        console.error('[Shutterstock Auto-Filler] fillValueIntoElement error:', err);
        return false;
      }
    }

    async function startAutoFill() {
      if (matchedList.length === 0) {
        log('Tidak ada item cocok untuk di-fill', 'warning');
        return;
      }

      btnFill.disabled = true;
      btnMatch.disabled = true;
      progressContainer.style.display = 'block';
      log(\`Memulai auto-fill untuk \${matchedList.length} item...\`, 'info');

      let successCount = 0;

      for (let i = 0; i < matchedList.length; i++) {
        const { pageItem, csv } = matchedList[i];
        const percent = Math.round(((i + 1) / matchedList.length) * 100);
        progressFill.style.width = percent + '%';
        progressText.textContent = \`\${i + 1} / \${matchedList.length} (\${pageItem.filename})\`;

        try {
          pageItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          pageItem.element.click();
          await new Promise(r => setTimeout(r, 600));

          const descInput = findDescriptionInput();
          if (descInput && csv.description) {
            await fillValueIntoElement(descInput, csv.description);
            log(\`[\${pageItem.filename}] Title/Deskripsi diisi.\`, 'info');
          }

          await new Promise(r => setTimeout(r, 200));

          const kwInput = findKeywordInput();
          if (kwInput && csv.keywords) {
            const kwList = Array.isArray(csv.keywords) ? csv.keywords : csv.keywords.split(/[,;]/).map(k => k.trim()).filter(Boolean);
            if (kwList.length > 0) {
              await fillValueIntoElement(kwInput, kwList.join(', '));
              kwInput.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Comma', keyCode: 188, bubbles: true }));
              kwInput.dispatchEvent(new KeyboardEvent('keyup', { key: ',', code: 'Comma', keyCode: 188, bubbles: true }));
              kwInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              kwInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              log(\`[\${pageItem.filename}] \${kwList.length} Keywords dimasukkan.\`, 'info');
            }
          }

          successCount++;
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          log(\`Gagal mengisi \${pageItem.filename}: \${err.message}\`, 'error');
        }
      }

      log(\`SELESAI! Berhasil mengisi \${successCount} dari \${matchedList.length} item.\`, 'success');
      btnMatch.disabled = false;
      btnFill.disabled = false;
    }

    btnFill.addEventListener('click', startAutoFill);

    document.getElementById('sstk-af-minimize').addEventListener('click', () => {
      bodyEl.style.display = bodyEl.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('sstk-af-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'show_panel' || request.action === 'toggle_panel') {
        createOrShowPanel();
        sendResponse({ status: 'ok' });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createOrShowPanel);
  } else {
    createOrShowPanel();
  }
})();`;

  const extensionPopupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shutterstock CSV Auto-Filler</title>
  <style>
    body {
      width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .icon {
      width: 32px;
      height: 32px;
      background: #4f46e5;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #fff;
    }
    .title {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
    }
    .subtitle {
      font-size: 11px;
      color: #94a3b8;
    }
    .btn {
      width: 100%;
      padding: 10px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 10px;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #4338ca;
    }
    .footer {
      margin-top: 12px;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="icon">SS</div>
    <div>
      <div class="title">CSV Auto-Filler</div>
      <div class="subtitle">v1.3.3 for Shutterstock</div>
    </div>
  </div>
  <p style="font-size: 11px; color: #cbd5e1; line-height: 1.4;">
    Buka halaman Contributor Shutterstock untuk memunculkan panel CSV Auto-Filler otomatis.
  </p>
  <button id="btn-show" class="btn">Buka / Tampilkan Panel Box</button>
  <div class="footer">Ready for submit.shutterstock.com</div>
  <script src="popup.js"></script>
</body>
</html>`;

  const extensionPopupJs = `document.getElementById('btn-show').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'show_panel' }, (response) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      }
    });
  }
});`;

  const extensionCss = `/* Content Script CSS v1.3.3 */
.sstk-af-hidden {
  display: none !important;
}
#sstk-af-launcher-badge {
  position: fixed !important;
  bottom: 24px !important;
  right: 24px !important;
  z-index: 2147483647 !important;
  background: #4f46e5 !important;
  color: #ffffff !important;
  padding: 10px 16px !important;
  border-radius: 9999px !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 12px !important;
  font-weight: 800 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5) !important;
  cursor: pointer !important;
}
#sstk-csv-autofill-panel {
  position: fixed !important;
  bottom: 24px !important;
  right: 24px !important;
  width: 360px !important;
  min-width: 360px !important;
  max-width: 360px !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: calc(100vh - 32px) !important;
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 16px !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2) !important;
  z-index: 2147483647 !important;
  display: flex !important;
  flex-direction: column !important;
  transition: none !important;
  transform: none !important;
}
.sstk-af-header-actions button {
  background: rgba(255, 255, 255, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
  font-size: 14px !important;
  font-weight: bold !important;
  line-height: 1 !important;
  cursor: pointer !important;
  padding: 2px 8px !important;
  border-radius: 6px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 26px !important;
  height: 24px !important;
  transition: all 0.15s ease !important;
}
.sstk-af-header-actions button:hover {
  background: rgba(255, 255, 255, 0.4) !important;
  color: #ffffff !important;
  transform: scale(1.05) !important;
}`;

  const handleDownloadExtensionZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      zip.file('manifest.json', extensionManifest);
      zip.file('content.js', extensionContentJs);
      zip.file('content.css', extensionCss);
      zip.file('popup.html', extensionPopupHtml);
      zip.file('popup.js', extensionPopupJs);

      const canvas48 = document.createElement('canvas');
      canvas48.width = 48;
      canvas48.height = 48;
      const ctx48 = canvas48.getContext('2d');
      if (ctx48) {
        ctx48.fillStyle = '#4f46e5';
        ctx48.beginPath();
        ctx48.roundRect(0, 0, 48, 48, 10);
        ctx48.fill();
        ctx48.fillStyle = '#ffffff';
        ctx48.font = 'bold 24px sans-serif';
        ctx48.textAlign = 'center';
        ctx48.textBaseline = 'middle';
        ctx48.fillText('SS', 24, 24);
      }
      const icon48Base64 = canvas48.toDataURL('image/png').split(',')[1];
      zip.file('icon48.png', icon48Base64, { base64: true });

      const canvas128 = document.createElement('canvas');
      canvas128.width = 128;
      canvas128.height = 128;
      const ctx128 = canvas128.getContext('2d');
      if (ctx128) {
        ctx128.fillStyle = '#4f46e5';
        ctx128.beginPath();
        ctx128.roundRect(0, 0, 128, 128, 24);
        ctx128.fill();
        ctx128.fillStyle = '#ffffff';
        ctx128.font = 'bold 64px sans-serif';
        ctx128.textAlign = 'center';
        ctx128.textBaseline = 'middle';
        ctx128.fillText('SS', 64, 64);
      }
      const icon128Base64 = canvas128.toDataURL('image/png').split(',')[1];
      zip.file('icon128.png', icon128Base64, { base64: true });

      const readmeText = `# Shutterstock CSV Auto-Filler Chrome Extension v1.3.3

## Cara Pasang (Instalasi):
1. Ekstrak file ZIP ini ke dalam sebuah folder di komputer Anda.
2. Buka browser Google Chrome.
3. Kunjungi URL: chrome://extensions/
4. Di pojok kanan atas, nyalakan toggle "Developer mode" (Mode Pengembang).
5. Klik tombol "Load unpacked" (Muat yang belum dibongkar) di pojok kiri atas.
6. Pilih folder tempat Anda mengekstrak file ekstensi ini.
7. Selesai! Ekstensi kini aktif.

## Fitur Baru v1.3.3:
- Perbaikan penuh tombol Minimize (−) dan Close (×) menggunakan kelas CSS dinamis \`.sstk-af-hidden\` agar terbebas dari intervensi spesifisitas \`!important\` pada element display.
- Tombol Minimize melipat panel agar hanya tersisa header bar yang ringkas.
- Tombol Close menutup box dan launcher badge "CSV Filler" tetap siap di kanan bawah.
- Ukuran box terkunci presisi 360px saat digeser maupun saat posisi diam.

## Cara Menggunakan:
1. Buka halaman Contributor Shutterstock: https://submit.shutterstock.com/portfolio/not_submitted/photo
2. Tombol badge & box "CSV Filler" akan muncul otomatis di sudut kanan bawah.
3. Klik "Pilih File CSV (.csv)" dan unggah file CSV Anda.
4. Klik "1. Scan & Cocokkan" untuk mendeteksi item di halaman.
5. Klik "2. Auto-Fill ke Form" untuk mengisi Title, Keywords, dan Kategori secara otomatis!
`;
      zip.file('README.txt', readmeText);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'shutterstock_csv_autofill_extension.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast('Paket Ekstensi Chrome v1.3.3 berhasil diunduh!', 'success');
    } catch (err: any) {
      addToast(`Gagal membuat ZIP ekstensi: ${err.message}`, 'error');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 width-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-sky-400 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Version 1.3.3 (Fixed Buttons via CSS Toggle)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shutterstock CSV Auto-Filler Extension</h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Ekstensi Chrome resmi & Injection Script untuk portal Contributor Shutterstock. Memasukkan Title, Keywords, dan Kategori dari CSV secara otomatis dengan mencocokkan nama file.
            </p>
          </div>

          <button
            onClick={handleDownloadExtensionZip}
            disabled={isZipping}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {isZipping ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            <span>{isZipping ? 'Mempersiapkan ZIP...' : 'Unduh Extension ZIP (v1.3.3)'}</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-4 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('download')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
            activeTab === 'download'
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <Chrome className="w-4 h-4" />
          <span>Panduan Instalasi Extension</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
            activeTab === 'simulator'
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <Play className="w-4 h-4" />
          <span>Live Simulator & Matching</span>
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
            activeTab === 'code'
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <Code className="w-4 h-4" />
          <span>Source Code Extension</span>
        </button>
      </div>

      {/* TAB 1: Download & Instructions */}
      {activeTab === 'download' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Langkah Instalasi Ekstensi Chrome</span>
              </h2>

              <ol className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">1</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white block">Unduh Paket Extension ZIP</strong>
                    Klik tombol "Unduh Extension ZIP (v1.3.0)" di bagian atas dan ekstrak isi file ZIP ke folder lokal komputer Anda.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">2</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white block">Buka Chrome Extension Manager</strong>
                    Buka Google Chrome lalu masukkan URL <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-xs">chrome://extensions/</code> di address bar.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">3</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white block">Aktifkan Developer Mode & Load Unpacked</strong>
                    Nyalakan sakelar <b>"Developer mode"</b> di pojok kanan atas, lalu klik tombol <b>"Load unpacked"</b> dan pilih folder hasil ekstrak.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">4</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white block">Buka Shutterstock Contributor</strong>
                    Akses halaman portal Shutterstock: <a href="https://submit.shutterstock.com/portfolio/not_submitted/photo" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline inline-flex items-center gap-1 font-semibold">submit.shutterstock.com <ExternalLink className="w-3 h-3" /></a>.
                    Panel box "CSV Filler" akan otomatis muncul di sudut kanan bawah.
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-900/50 text-slate-800 dark:text-indigo-200 space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                <span>Fitur Ekstensi v1.3.0</span>
              </h3>
              <ul className="text-xs space-y-2 list-disc list-inside text-slate-700 dark:text-indigo-300 leading-relaxed">
                <li>Panel mengambang (Floating box) dengan tombol toggle badge.</li>
                <li>Mendukung Drag-and-Drop file CSV.</li>
                <li>Dapat digeser (draggable) ke posisi mana saja di layar.</li>
                <li>Auto-matching akurat berdasarkan nama file (.eps / .jpg / base name).</li>
                <li>Pengisian Title/Description, Keywords, & Kategori otomatis.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Simulator */}
      {activeTab === 'simulator' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Uji Coba CSV & Metadata Importer</h2>
              <p className="text-slate-500 text-xs">Unggah CSV Anda di bawah ini untuk melihat hasil parsing dan mencocokkannya dengan sampel item.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleLoadFromCurrentApp}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Impor dari Generator</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Unggah File CSV (.csv)</label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50 dark:bg-slate-800/50 relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {csvFileName ? csvFileName : "Klik atau seret file CSV ke sini"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Mendukung format standar Shutterstock (Filename, Title, Keywords, Categories)</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Ringkasan Data CSV</span>
                <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-[10px]">
                  {parsedRows.length} Baris Detected
                </span>
              </h3>
              {parsedRows.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {parsedRows.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <div className="font-bold text-indigo-600 dark:text-indigo-400">{row.filename}</div>
                      <div className="text-slate-600 dark:text-slate-300 truncate">{row.description}</div>
                      <div className="text-[10px] text-slate-400">{row.keywords.length} keywords • {row.categories.join(', ')}</div>
                    </div>
                  ))}
                  {parsedRows.length > 5 && (
                    <p className="text-[10px] text-center text-slate-400 pt-1">+ {parsedRows.length - 5} baris lainnya...</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada CSV yang diunggah. Silakan pilih file CSV di sebelah kiri.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Code View */}
      {activeTab === 'code' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedCodeFile('content')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'content'
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                content.js
              </button>
              <button
                onClick={() => setSelectedCodeFile('manifest')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'manifest'
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                manifest.json
              </button>
              <button
                onClick={() => setSelectedCodeFile('popupHtml')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'popupHtml'
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                popup.html
              </button>
            </div>

            <button
              onClick={() => {
                const map = {
                  manifest: extensionManifest,
                  content: extensionContentJs,
                  popupHtml: extensionPopupHtml,
                  popup: extensionPopupJs,
                  css: extensionCss
                };
                copyText(map[selectedCodeFile], selectedCodeFile);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto"
            >
              {copiedCode === selectedCodeFile ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Salin Kode</span>
            </button>
          </div>

          <div className="relative">
            <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed">
              {selectedCodeFile === 'manifest' && extensionManifest}
              {selectedCodeFile === 'content' && extensionContentJs}
              {selectedCodeFile === 'popupHtml' && extensionPopupHtml}
              {selectedCodeFile === 'popup' && extensionPopupJs}
              {selectedCodeFile === 'css' && extensionCss}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
