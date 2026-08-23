import React, { useState, useMemo } from 'react';
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
  const [testFileListInput, setTestFileListInput] = useState<string>(
    'icon_nature.eps\nabstract_vector_background.eps\nsummer_holiday_banner.eps\nvintage_typography.eps'
  );
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCodeFile, setSelectedCodeFile] = useState<'manifest' | 'content' | 'popup' | 'popupHtml' | 'css'>('content');
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Parse CSV string into structured CsvRow objects
  const parseCSV = (csvText: string): CsvRow[] => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Robust CSV split respecting quotes
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
    
    // Find index of headers
    const findIndex = (keys: string[]) => {
      return headers.findIndex(h => keys.some(k => h.includes(k)));
    };

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

  // Handle CSV file upload
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

  // Load from current generated images in App
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

  // Copy helper
  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    addToast(`${label} disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Extension Code Definitions
  const extensionManifest = `{
  "manifest_version": 3,
  "name": "Shutterstock CSV Auto-Filler",
  "version": "1.3.0",
  "description": "Auto-fill Title, Keywords, and Categories on Shutterstock Contributor portal from CSV by matching filenames (e.g. file.eps).",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "https://submit.shutterstock.com/*",
    "https://*.shutterstock.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Shutterstock CSV Auto-Filler"
  },
  "content_scripts": [
    {
      "matches": [
        "https://submit.shutterstock.com/*",
        "https://*.shutterstock.com/*"
      ],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_end"
    }
  ],
  "icons": {
    "48": "icon48.png",
    "128": "icon128.png"
  }
}`;

  const extensionContentJs = `// Shutterstock CSV Auto-Filler Content Script v1.3.0
(function() {
  console.log('[Shutterstock Auto-Filler] Initializing script on:', window.location.href);

  function createOrShowPanel() {
    let panel = document.getElementById('sstk-csv-autofill-panel');
    let launcher = document.getElementById('sstk-af-launcher-badge');

    if (panel) {
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
      return;
    }

    // Create Launcher Badge if not present
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
          p.style.display = p.style.display === 'none' ? 'block' : 'none';
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
          <button id="sstk-af-minimize" title="Minimize">_</button>
          <button id="sstk-af-close" title="Close">&times;</button>
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

    // Make Panel Draggable
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

        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        if (e.cancelable) e.preventDefault();
      };

      const onEnd = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      };

      headerEl.addEventListener('mousedown', onStart);
      headerEl.addEventListener('touchstart', onStart, { passive: false });
    }

    // State & Binding
    let csvData = [];
    let matchedList = [];

    const bodyEl = document.getElementById('sstk-af-body');
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

    // Parse CSV
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

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileText.textContent = file.name;
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

    const OFFICIAL_SHUTTERSTOCK_CATS = [
      "Abstract", "Animals/Wildlife", "Arts", "Backgrounds/Textures", "Buildings/Landmarks",
      "Business/Finance", "Education", "Food and Drink", "Healthcare/Medical",
      "Holidays", "Industrial", "Natural", "Objects", "People", "Religion",
      "Science", "Signs/Symbols", "Sports/Recreation", "Technology", "Transportation"
    ];

    function mapToOfficialCategory(rawCat) {
      if (!rawCat) return "Abstract";
      const cat = rawCat.trim().toLowerCase();

      for (const official of OFFICIAL_SHUTTERSTOCK_CATS) {
        if (official.toLowerCase() === cat) return official;
      }

      if (cat.includes('abstract') || cat.includes('abstrak')) return "Abstract";
      if (cat.includes('anim') || cat.includes('wild')) return "Animals/Wildlife";
      if (cat.includes('back') || cat.includes('textur') || cat.includes('latar')) return "Backgrounds/Textures";
      if (cat.includes('build') || cat.includes('landm') || cat.includes('architect') || cat.includes('bangunan')) return "Buildings/Landmarks";
      if (cat.includes('busin') || cat.includes('finan') || cat.includes('bisnis')) return "Business/Finance";
      if (cat.includes('educat') || cat.includes('school') || cat.includes('pendidikan')) return "Education";
      if (cat.includes('food') || cat.includes('drink') || cat.includes('makanan')) return "Food and Drink";
      if (cat.includes('health') || cat.includes('medic') || cat.includes('kesehatan')) return "Healthcare/Medical";
      if (cat.includes('holid') || cat.includes('vacat') || cat.includes('liburan')) return "Holidays";
      if (cat.includes('indust')) return "Industrial";
      if (cat.includes('natur') || cat.includes('alam')) return "Natural";
      if (cat.includes('obj') || cat.includes('benda')) return "Objects";
      if (cat.includes('peop') || cat.includes('person') || cat.includes('human') || cat.includes('orang')) return "People";
      if (cat.includes('relig') || cat.includes('spiritual') || cat.includes('agama')) return "Religion";
      if (cat.includes('scien') || cat.includes('sains')) return "Science";
      if (cat.includes('sign') || cat.includes('symb') || cat.includes('icon') || cat.includes('ikon') || cat.includes('tanda')) return "Signs/Symbols";
      if (cat.includes('sport') || cat.includes('recreat') || cat.includes('olahraga')) return "Sports/Recreation";
      if (cat.includes('tech') || cat.includes('teknologi')) return "Technology";
      if (cat.includes('transp') || cat.includes('vehic') || cat.includes('kendaraan')) return "Transportation";
      if (cat.includes('art') || cat.includes('vector') || cat.includes('vektor') || cat.includes('illustration') || cat.includes('design')) return "Arts";

      return rawCat;
    }

    function isCategoryMatch(optionText, targetCategory) {
      if (!optionText || !targetCategory) return false;
      const opt = optionText.toLowerCase().trim();
      const targetOfficial = mapToOfficialCategory(targetCategory).toLowerCase();

      if (opt === targetOfficial || opt.includes(targetOfficial) || targetOfficial.includes(opt)) return true;

      const targetTokens = targetOfficial.split(/[\s/,&-]+/).filter(w => w.length >= 3);
      const optTokens = opt.split(/[\s/,&-]+/).filter(w => w.length >= 3);
      for (const tt of targetTokens) {
        if (optTokens.some(ot => ot.includes(tt) || tt.includes(ot))) {
          return true;
        }
      }
      return false;
    }

    function findCategoryDropdown(categoryIndex = 1) {
      function isExt(el) {
        if (!el) return false;
        return !!el.closest('#sstk-csv-autofill-panel, #sstk-af-launcher-badge, [id*="sstk"], [class*="sstk-af"]');
      }

      function getInteractive(el) {
        if (!el || isExt(el)) return null;
        if (['SELECT', 'BUTTON', 'INPUT'].includes(el.tagName)) return el;
        if (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'button') return el;

        const child = el.querySelector('select, button, input, [role="combobox"], [role="button"], div[class*="control"], div[class*="select"], div[class*="value"], div[class*="placeholder"], svg');
        if (child && !isExt(child)) return child;

        return el;
      }

      const idxStr = String(categoryIndex);

      // Priority 1: Specific data-automation, id, or name attributes
      const attrSelectors = [
        '[data-automation*="category' + idxStr + '"]',
        '[data-automation*="category-' + idxStr + '"]',
        '[data-automation*="Category' + idxStr + '"]',
        '[id*="category' + idxStr + '"]',
        '[id*="category-' + idxStr + '"]',
        '[name*="category' + idxStr + '"]',
        '[name*="category-' + idxStr + '"]'
      ];

      for (const sel of attrSelectors) {
        const found = Array.from(document.querySelectorAll(sel)).find(el => !isExt(el));
        if (found) {
          const target = getInteractive(found);
          if (target) return target;
        }
      }

      // Priority 2: Elements with matching aria-label or placeholder
      const ariaMatches = Array.from(document.querySelectorAll('[aria-label*="category"], [aria-label*="kategori"], [placeholder*="category"], [placeholder*="kategori"]')).filter(el => {
        if (isExt(el)) return false;
        const text = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').toLowerCase();
        return text.includes(idxStr) || (categoryIndex === 1 && !text.includes('2'));
      });
      if (ariaMatches.length > 0) return getInteractive(ariaMatches[0]);

      // Priority 3: Nearby Label Text
      const labels = Array.from(document.querySelectorAll('label, div, span, p, h3, h4')).filter(el => {
        if (isExt(el)) return false;
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && rect.left > 150;
        const t = (el.textContent || '').toLowerCase().trim();
        if (!isVisible) return false;
        if (categoryIndex === 1) return (t.includes('category 1') || t.includes('kategori 1') || t === 'category' || t === 'kategori' || t.startsWith('category 1'));
        return (t.includes('category 2') || t.includes('kategori 2'));
      });

      for (const lbl of labels) {
        const parent = lbl.closest('div[class*="field"], div[class*="select"], div[class*="container"], div[class*="Form"], fieldset, form') || lbl.parentElement;
        if (parent) {
          const btn = parent.querySelector('button, select, [role="combobox"], [role="button"], div[class*="control"], div[class*="select"], input, svg');
          if (btn && !isExt(btn) && btn !== lbl) return btn;
        }
        if (lbl.nextElementSibling) {
          const nextTarget = getInteractive(lbl.nextElementSibling);
          if (nextTarget && !isExt(nextTarget)) return nextTarget;
        }
      }

      // Priority 4: All dropdown / combobox triggers in right sidebar
      const sidebarCombos = Array.from(document.querySelectorAll('select, button, [role="combobox"], [data-automation*="select"], div[class*="select"], div[class*="Select"]')).filter(el => {
        if (isExt(el)) return false;
        const rect = el.getBoundingClientRect();
        const t = (el.textContent || '').toLowerCase();
        const isVisible = rect.width > 0 && rect.height > 0 && rect.left > 150;
        return isVisible && !t.includes('submit') && !t.includes('kirim') && !t.includes('unggah') && !t.includes('upload') && !t.includes('delete') && !t.includes('hapus');
      });

      if (sidebarCombos.length >= categoryIndex) {
        return getInteractive(sidebarCombos[categoryIndex - 1]);
      }

      return null;
    }

    async function fillCategoryField(categoryValue, categoryIndex = 1) {
      if (!categoryValue) return false;

      // Strategy 1: If it's a standard HTML <select>
      const selects = Array.from(document.querySelectorAll('select')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.left > 200;
      });

      if (selects.length >= categoryIndex) {
        const targetSelect = selects[categoryIndex - 1];
        const options = Array.from(targetSelect.options);
        const matchOpt = options.find(o => isCategoryMatch(o.textContent, categoryValue));
        if (matchOpt) {
          targetSelect.value = matchOpt.value;
          targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
          targetSelect.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }

      // Strategy 2: Custom Dropdown Trigger
      const dropdownBtn = findCategoryDropdown(categoryIndex);
      if (!dropdownBtn) {
        log('Warning: Dropdown trigger Kategori ' + categoryIndex + ' tidak ditemukan di form.', 'warning');
        return false;
      }

      try {
        log('Membuka dropdown Kategori ' + categoryIndex + '...');
        dropdownBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (typeof dropdownBtn.focus === 'function') {
          try { dropdownBtn.focus(); } catch(e){}
        }

        const elementsToInteract = [
          dropdownBtn,
          dropdownBtn.querySelector('button, [role="combobox"], svg, span, input, div'),
          dropdownBtn.parentElement
        ].filter(Boolean);

        for (const el of elementsToInteract) {
          triggerClick(el);
        }

        try {
          dropdownBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
          dropdownBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
        } catch(e){}

        await new Promise(r => setTimeout(r, 500));

        function cleanAlphaNum(str) {
          return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        }

        function triggerClick(el) {
          if (!el) return;
          try {
            el.scrollIntoView({ behavior: 'auto', block: 'center' });
            if (typeof el.focus === 'function') { try { el.focus(); } catch (e) {} }

            const rect = el.getBoundingClientRect();
            const clientX = rect.left + rect.width / 2;
            const clientY = rect.top + rect.height / 2;
            const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY };

            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));

            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

            if (typeof el.click === 'function') el.click();

            // Invoke React internal Synthetic Event handlers if present
            const reactKey = Object.keys(el).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
            if (reactKey && el[reactKey]) {
              const props = el[reactKey];
              const dummyEv = { preventDefault: () => {}, stopPropagation: () => {}, target: el, currentTarget: el, bubbles: true, nativeEvent: new MouseEvent('click', opts) };
              if (typeof props.onClick === 'function') props.onClick(dummyEv);
              if (typeof props.onMouseDown === 'function') props.onMouseDown(dummyEv);
              if (typeof props.onPointerDown === 'function') props.onPointerDown(dummyEv);
              if (typeof props.onChange === 'function') props.onChange(dummyEv);
            }
          } catch (err) {
            console.error('triggerClick error:', err);
          }
        }

        function isExtensionElement(el) {
          if (!el) return false;
          return !!el.closest('#sstk-csv-autofill-panel, #sstk-af-launcher-badge, [id*="sstk"], [class*="sstk-af"]');
        }

        // Find the open dropdown overlay container, strictly excluding extension UI
        function findDropdownOverlay() {
          const listbox = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [data-automation*="menu"], [data-automation*="options"], ul[class*="select"], div[class*="menu"], div[class*="popover"], div[class*="dropdown"]')).find(el => !isExtensionElement(el));
          if (listbox) return listbox;

          const highZOverlays = Array.from(document.querySelectorAll('div, ul')).filter(el => {
            if (isExtensionElement(el)) return false;
            const rect = el.getBoundingClientRect();
            const zIdx = parseInt(window.getComputedStyle(el).zIndex, 10) || 0;
            return rect.width > 100 && rect.height > 80 && zIdx > 10;
          });
          return highZOverlays.length > 0 ? highZOverlays[highZOverlays.length - 1] : document.body;
        }

        const overlayContainer = findDropdownOverlay();
        const candidateEls = Array.from(overlayContainer.querySelectorAll('[role="option"], [data-automation*="option"], li, div[class*="option"], div[class*="item"], div[class*="select-item"], span')).filter(el => !isExtensionElement(el));

        let optionEls = candidateEls.filter(el => {
          if (isExtensionElement(el)) return false;
          if (el.closest('textarea, input, [contenteditable="true"]')) return false;
          const rect = el.getBoundingClientRect();
          const t = (el.textContent || '').trim();
          const cleanT = cleanAlphaNum(t);

          // CRITICAL: Must contain valid alphanumeric text (excludes icons, emojis like 📄, & empty tags)
          if (!cleanT || cleanT.length < 2) return false;

          const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
          return isVisible && t.length > 0 && t.length < 50;
        });

        // Fallback: If 0 options found in overlay, perform a page-wide search for visible category elements
        if (optionEls.length === 0) {
          optionEls = Array.from(document.querySelectorAll('li, div, span, [role="option"], p')).filter(el => {
            if (isExtensionElement(el)) return false;
            if (el.closest('textarea, input, [contenteditable="true"]')) return false;
            const rect = el.getBoundingClientRect();
            const t = (el.textContent || '').trim();
            const cleanT = cleanAlphaNum(t);
            if (!cleanT || cleanT.length < 2 || t.length > 40) return false;
            const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
            return isVisible && (isCategoryMatch(t, categoryValue) || cleanT === cleanAlphaNum(categoryValue));
          });
        }

        const targetClean = cleanAlphaNum(categoryValue);

        // Priority 1: Exact clean alphanumeric match (handles slashes, spaces, &nbsp;)
        let matchedOption = optionEls.find(opt => cleanAlphaNum(opt.textContent) === targetClean);

        // Priority 2: Substring clean match (requires optClean length >= 3)
        if (!matchedOption && targetClean.length >= 4) {
          matchedOption = optionEls.find(opt => {
            const optClean = cleanAlphaNum(opt.textContent);
            if (!optClean || optClean.length < 3) return false;
            return optClean.includes(targetClean) || targetClean.includes(optClean);
          });
        }

        // Priority 3: Fuzzy category match
        if (!matchedOption) {
          matchedOption = optionEls.find(opt => isCategoryMatch(opt.textContent, categoryValue));
        }

        if (matchedOption) {
          log('Opsi Kategori ditemukan: "' + matchedOption.textContent.trim() + '", memilih...');
          triggerClick(matchedOption);
          if (matchedOption.parentElement) triggerClick(matchedOption.parentElement);
          await new Promise(r => setTimeout(r, 300));
          return true;
        } else {
          const samples = optionEls.slice(0, 6).map(o => '"' + o.textContent.trim() + '"').join(', ');
          log('Option Kategori "' + categoryValue + '" tidak cocok dengan ' + optionEls.length + ' opsi. Contoh opsi: [' + samples + '...]', 'warning');
          document.body.click(); // Close dropdown overlay
        }
      } catch (err) {
        console.error('[Shutterstock Auto-Filler] fillCategoryField error:', err);
      }

      return false;
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

        // Method A: document.execCommand insertText (best for React / Formik)
        let execSuccess = false;
        try {
          execSuccess = document.execCommand('insertText', false, value);
        } catch (e) {}

        // Method B: Native property setter + React _valueTracker reset
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

        // Dispatch comprehensive events
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
          // 1. Click card to focus/open right detail panel
          pageItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          pageItem.element.click();
          await new Promise(r => setTimeout(r, 600));

          // 2. Fill Description / Title
          const descInput = findDescriptionInput();
          if (descInput && csv.description) {
            await fillValueIntoElement(descInput, csv.description);
            log(\`[\${pageItem.filename}] Title/Deskripsi diisi.\`, 'info');
          } else if (!descInput) {
            log(\`[\${pageItem.filename}] Warning: Input Deskripsi tidak ditemukan di panel kanan.\`, 'warning');
          }

          await new Promise(r => setTimeout(r, 200));

          // 3. Fill Categories (Kategori 1 & Kategori 2)
          if (csv.categories) {
            const catList = Array.isArray(csv.categories) ? csv.categories : csv.categories.split(/[,;]/).map(c => c.trim()).filter(Boolean);
            if (catList.length > 0) {
              const ok1 = await fillCategoryField(catList[0], 1);
              if (ok1) log(\`[\${pageItem.filename}] Kategori 1 (\${catList[0]}) diisi.\`, 'info');
            }
            if (catList.length > 1) {
              await new Promise(r => setTimeout(r, 200));
              const ok2 = await fillCategoryField(catList[1], 2);
              if (ok2) log(\`[\${pageItem.filename}] Kategori 2 (\${catList[1]}) diisi.\`, 'info');
            }
          }

          await new Promise(r => setTimeout(r, 200));

          // 4. Fill Keywords
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

          // 5. Auto-check Illustration if file is .eps or marked illustration
          if (/\\.eps$/i.test(pageItem.filename) || (csv.illustration && /yes|true|1|ya/i.test(String(csv.illustration)))) {
            const illuRadios = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"], label'));
            const illuTarget = illuRadios.find(el => {
              const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase();
              return text.includes('illustration') || text.includes('ilustrasi');
            });
            if (illuTarget && typeof illuTarget.click === 'function') {
              try {
                if ('checked' in illuTarget && !illuTarget.checked) illuTarget.click();
                else if (!('checked' in illuTarget)) illuTarget.click();
              } catch (e) {}
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
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      background: #f8fafc;
      color: #1e293b;
    }
    h2 {
      font-size: 15px;
      font-weight: 800;
      margin: 0 0 6px;
      color: #4f46e5;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    p {
      font-size: 11px;
      color: #64748b;
      margin: 0 0 10px;
      line-height: 1.4;
    }
    .status-badge {
      font-size: 11px;
      font-weight: bold;
      padding: 6px 10px;
      border-radius: 8px;
      background: #e0e7ff;
      color: #3730a3;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      border: none;
      transition: all 0.2s ease;
      margin-bottom: 8px;
    }
    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);
    }
    .btn-primary:hover { background: #4338ca; }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
    }
    .btn-secondary:hover { background: #cbd5e1; }
    .help-note {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 8px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <h2>Shutterstock CSV Filler</h2>
  <div id="tab-status" class="status-badge">🔄 Mengecek tab aktif...</div>

  <button id="inject-btn" class="btn btn-primary" style="display:none;">
    🚀 Tampilkan / Injek Panel Auto-Fill
  </button>

  <button id="open-sstk" class="btn btn-secondary">
    🌐 Buka Shutterstock Contributor
  </button>

  <p class="help-note">
    💡 <b>Tips:</b> Jika panel belum muncul di pojok kanan bawah, klik tombol "Tampilkan / Injek Panel Auto-Fill" di atas atau tekan F5 (Refresh) di tab Shutterstock.
  </p>

  <script src="popup.js"></script>
</body>
</html>`;

  const extensionPopupJs = `document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('tab-status');
  const injectBtn = document.getElementById('inject-btn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isSstk = tab && tab.url && tab.url.includes('shutterstock.com');

    if (isSstk) {
      statusEl.innerHTML = '✅ Terdeteksi Tab Shutterstock!';
      statusEl.style.background = '#dcfce7';
      statusEl.style.color = '#15803d';
      injectBtn.style.display = 'flex';

      injectBtn.addEventListener('click', async () => {
        statusEl.innerHTML = '⏳ Menginjek panel...';
        try {
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
          statusEl.innerHTML = '🎉 Panel Auto-Fill Berhasil Ditampilkan!';
          statusEl.style.background = '#dcfce7';
          statusEl.style.color = '#15803d';
        } catch (err) {
          statusEl.innerHTML = '⚠️ Silakan Refresh Tab (F5)';
          statusEl.style.background = '#fef3c7';
          statusEl.style.color = '#b45309';
        }
      });
    } else {
      statusEl.innerHTML = 'ℹ️ Buka submit.shutterstock.com';
      statusEl.style.background = '#f1f5f9';
      statusEl.style.color = '#475569';
    }
  } catch (e) {
    statusEl.innerHTML = 'ℹ️ Buka submit.shutterstock.com';
  }

  document.getElementById('open-sstk').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://submit.shutterstock.com/' });
  });
});`;

  const extensionCss = `/* Shutterstock Auto-Filler Injected Panel & Launcher Styles v1.3.0 */
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
  transition: all 0.2s ease !important;
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
  max-width: 90vw !important;
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 16px !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08) !important;
  z-index: 2147483647 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #1e293b !important;
  overflow: hidden !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

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
}

.sstk-af-title {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.sstk-af-header-actions button {
  background: transparent !important;
  border: none !important;
  color: #ffffff !important;
  font-size: 16px !important;
  cursor: pointer !important;
  padding: 0 6px !important;
  opacity: 0.8 !important;
}

.sstk-af-header-actions button:hover {
  opacity: 1 !important;
}

.sstk-af-body {
  padding: 14px 16px !important;
}

.sstk-af-desc {
  font-size: 11px !important;
  color: #64748b !important;
  margin: 0 0 12px 0 !important;
  line-height: 1.4 !important;
}

.sstk-af-dropzone input[type="file"] {
  display: none !important;
}

.sstk-af-file-label {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 10px !important;
  border: 2px dashed #cbd5e1 !important;
  border-radius: 10px !important;
  cursor: pointer !important;
  background: #f8fafc !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #475569 !important;
  transition: all 0.2s ease !important;
}

.sstk-af-file-label:hover {
  border-color: #6366f1 !important;
  background: #eef2ff !important;
  color: #4f46e5 !important;
}

.sstk-af-status-box {
  background: #f1f5f9 !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  margin: 10px 0 !important;
  font-size: 11px !important;
}

.sstk-af-stat-row {
  display: flex !important;
  justify-content: space-between !important;
  margin: 3px 0 !important;
}

.sstk-match-highlight {
  color: #16a34a !important;
}

.sstk-af-actions {
  display: flex !important;
  gap: 8px !important;
  margin-top: 10px !important;
}

.sstk-btn {
  flex: 1 !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  border: none !important;
  transition: all 0.15s ease !important;
}

.sstk-btn-primary {
  background: #4f46e5 !important;
  color: #ffffff !important;
}

.sstk-btn-primary:hover:not(:disabled) {
  background: #4338ca !important;
}

.sstk-btn-secondary {
  background: #e2e8f0 !important;
  color: #334155 !important;
}

.sstk-btn:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}

.sstk-af-progress-container {
  margin: 10px 0 !important;
}

.sstk-af-progress-bar {
  height: 6px !important;
  background: #e2e8f0 !important;
  border-radius: 3px !important;
  overflow: hidden !important;
}

#sstk-af-progress-fill {
  height: 100% !important;
  background: #22c55e !important;
  transition: width 0.2s ease !important;
}

#sstk-af-progress-text {
  font-size: 10px !important;
  color: #64748b !important;
  display: block !important;
  text-align: right !important;
  margin-top: 4px !important;
}

.sstk-af-logs {
  max-height: 110px !important;
  overflow-y: auto !important;
  background: #0f172a !important;
  color: #e2e8f0 !important;
  font-family: monospace !important;
  font-size: 10px !important;
  padding: 6px 8px !important;
  border-radius: 6px !important;
  margin-top: 10px !important;
}

.sstk-log-item {
  margin-bottom: 2px !important;
  line-height: 1.3 !important;
}

.sstk-log-success { color: #4ade80 !important; }
.sstk-log-warning { color: #facc15 !important; }
.sstk-log-error { color: #f87171 !important; }
.sstk-log-info { color: #94a3b8 !important; }
`;

  // Download Chrome Extension ZIP Package
  const handleDownloadExtensionZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Extension files
      zip.file('manifest.json', extensionManifest);
      zip.file('content.js', extensionContentJs);
      zip.file('content.css', extensionCss);
      zip.file('popup.html', extensionPopupHtml);
      zip.file('popup.js', extensionPopupJs);

      // Create a basic 48x48 icon using canvas data
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

      // README file inside extension zip
      const readmeText = `# Shutterstock CSV Auto-Filler Chrome Extension

## Cara Pasang (Instalasi):
1. Ekstrak file ZIP ini ke dalam sebuah folder di komputer Anda (misalnya di Documents/shutterstock-extension).
2. Buka browser Google Chrome.
3. Kunjungi URL: chrome://extensions/
4. Di pojok kanan atas, nyalakan toggle "Developer mode" (Mode Pengembang).
5. Klik tombol "Load unpacked" (Muat yang belum dibongkar) di pojok kiri atas.
6. Pilih folder tempat Anda mengekstrak file ekstensi ini.
7. Selesai! Ekstensi kini aktif.

## Cara Menggunakan:
1. Buka halaman Contributor Shutterstock: https://submit.shutterstock.com/
2. Panel "Shutterstock CSV Filler" akan otomatis muncul di sudut kanan bawah.
3. Klik "Pilih File CSV (.csv)" dan unggah file CSV hasil export.
4. Klik "1. Scan & Cocokkan" untuk mendeteksi kecocokan nama file (contoh: file.eps).
5. Klik "2. Auto-Fill ke Form" untuk mengisi Title, Keywords, dan Kategori secara otomatis!
`;
      zip.file('README.txt', readmeText);

      // Generate zip blob
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'shutterstock_csv_autofill_extension.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast('Paket Ekstensi Chrome siap diunduh!', 'success');
    } catch (err: any) {
      addToast(`Gagal membuat ZIP ekstensi: ${err.message}`, 'error');
    } finally {
      setIsZipping(false);
    }
  };

  // Instant Console Script Generator
  const instantConsoleScript = `// 🚀 SHUTTERSTOCK CSV AUTO-FILLER INSTANT CONSOLE SCRIPT
// Paste this script directly into Shutterstock Contributor tab console (F12 -> Console -> Enter)
(async function() {
  const csvData = ${JSON.stringify(parsedRows.length > 0 ? parsedRows : [
    {
      filename: "3 icon.jpg",
      description: "Set of three colorful vector icons for web design and app interface",
      keywords: ["icon", "vector", "design", "graphic", "color", "app", "ui"],
      categories: ["Vectors", "Abstract"],
      illustration: "Yes"
    }
  ])};

  console.log("%c[Shutterstock Auto-Filler] Starting script with " + csvData.length + " entries.", "color: #4f46e5; font-weight: bold; font-size: 14px;");

  function findDescriptionInput() {
    const candidates = Array.from(document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]'));
    const sidebarFields = candidates.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left > 200 && window.getComputedStyle(el).display !== 'none';
    });

    for (const el of sidebarFields) {
      const attrStr = (el.name + ' ' + el.id + ' ' + el.placeholder + ' ' + el.getAttribute('aria-label') + ' ' + el.getAttribute('data-automation')).toLowerCase();
      if (attrStr.includes('description') || attrStr.includes('title') || attrStr.includes('deskripsi') || attrStr.includes('minimal') || attrStr.includes('word')) {
        return el;
      }
    }
    const textareas = sidebarFields.filter(el => el.tagName === 'TEXTAREA');
    return textareas[0] || sidebarFields[0] || null;
  }

  function findKeywordInput() {
    const candidates = Array.from(document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]'));
    const sidebarFields = candidates.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left > 200 && window.getComputedStyle(el).display !== 'none';
    });

    for (const el of sidebarFields) {
      const attrStr = (el.name + ' ' + el.id + ' ' + el.placeholder + ' ' + el.getAttribute('aria-label') + ' ' + el.getAttribute('data-automation')).toLowerCase();
      if (attrStr.includes('keyword') || attrStr.includes('kata kunci') || attrStr.includes('tag')) {
        return el;
      }
    }
    const descInput = findDescriptionInput();
    const nonDescInputs = sidebarFields.filter(el => el !== descInput && el.tagName === 'INPUT');
    return nonDescInputs[nonDescInputs.length - 1] || null;
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

      try { document.execCommand('insertText', false, value); } catch (e) {}

      try {
        const proto = Object.getPrototypeOf(el);
        const protoSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const ownSet = Object.getOwnPropertyDescriptor(el, 'value')?.set;
        if (protoSet && ownSet !== protoSet) protoSet.call(el, value);
        else if (ownSet) ownSet.call(el, value);
        else el.value = value;
        if (el._valueTracker) el._valueTracker.setValue('');
      } catch (e) {}

      el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: String(value) }));
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  // Find candidate cards on page
  const cards = Array.from(document.querySelectorAll('[data-automation="media-card"], .media-card, div[class*="MediaCard"], tr, div')).filter(el => {
    const t = el.textContent || '';
    const rect = el.getBoundingClientRect();
    return /\\.(eps|jpg|jpeg|png|svg)/i.test(t) && rect.width > 50 && rect.height > 50 && rect.left < 800;
  });

  console.log("[Shutterstock Auto-Filler] Found " + cards.length + " media cards on page.");

  let successCount = 0;
  for (const csv of csvData) {
    const baseName = csv.filename.replace(/\\.[^/.]+$/, '').toLowerCase();
    const targetCard = cards.find(c => (c.textContent || '').toLowerCase().includes(baseName) || (c.textContent || '').toLowerCase().includes(csv.filename.toLowerCase()));

    if (targetCard) {
      console.log("%c✓ Found matching card for: " + csv.filename, "color: green; font-weight: bold;");
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetCard.click();
      await new Promise(r => setTimeout(r, 600));

      const descInput = findDescriptionInput();
      if (descInput && csv.description) {
        await fillValueIntoElement(descInput, csv.description);
        console.log("  ↳ Title/Deskripsi set.");
      }

      await new Promise(r => setTimeout(r, 200));

      // 1. Fill categories first
      if (csv.categories) {
        const catList = Array.isArray(csv.categories) ? csv.categories : csv.categories.split(/[,;]/).map(c => c.trim()).filter(Boolean);
        for (let idx = 0; idx < Math.min(catList.length, 2); idx++) {
          const catVal = catList[idx];
          const idxStr = String(idx + 1);

          function getInteractiveConsole(el) {
            if (!el || isExtEl(el)) return null;
            if (['SELECT', 'BUTTON', 'INPUT'].includes(el.tagName)) return el;
            if (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'button') return el;
            const child = el.querySelector('select, button, input, [role="combobox"], [role="button"], div[class*="control"], div[class*="select"], div[class*="value"], div[class*="placeholder"], svg');
            return child && !isExtEl(child) ? child : el;
          }

          let rawTrigger = document.querySelector('[data-automation*="category' + idxStr + '"], [data-automation*="category-' + idxStr + '"], [id*="category' + idxStr + '"], [id*="category-' + idxStr + '"], [name*="category' + idxStr + '"]');
          if (!rawTrigger) {
            const combos = Array.from(document.querySelectorAll('button, select, [role="combobox"], [data-automation*="select"], div[class*="select"]')).filter(el => {
              const rect = el.getBoundingClientRect();
              const t = (el.textContent || '').toLowerCase();
              return rect.width > 0 && rect.left > 150 && !t.includes('submit') && !t.includes('upload') && !t.includes('csv');
            });
            if (combos.length >= idx + 1) rawTrigger = combos[idx];
          }

          let trigger = getInteractiveConsole(rawTrigger);

          if (trigger) {
            if (trigger.tagName === 'SELECT') {
              const opt = Array.from((trigger as HTMLSelectElement).options).find(o => o.textContent.toLowerCase().includes(catVal.toLowerCase()));
              if (opt) {
                (trigger as HTMLSelectElement).value = opt.value;
                trigger.dispatchEvent(new Event('change', { bubbles: true }));
                console.log("  ↳ Kategori " + (idx + 1) + " set: " + opt.textContent);
              }
            } else {
              const trEl = trigger as HTMLElement;
              trEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              if (typeof trEl.focus === 'function') { try { trEl.focus(); } catch(e){} }

              const rectTr = trEl.getBoundingClientRect();
              const trEvOpts = { bubbles: true, cancelable: true, view: window, clientX: rectTr.left + rectTr.width / 2, clientY: rectTr.top + rectTr.height / 2 };
              trEl.dispatchEvent(new PointerEvent('pointerdown', trEvOpts));
              trEl.dispatchEvent(new MouseEvent('mousedown', trEvOpts));
              trEl.dispatchEvent(new PointerEvent('pointerup', trEvOpts));
              trEl.dispatchEvent(new MouseEvent('mouseup', trEvOpts));
              trEl.dispatchEvent(new MouseEvent('click', trEvOpts));
              if (typeof trEl.click === 'function') trEl.click();

              try {
                trEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
                trEl.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
              } catch(e){}

              await new Promise(r => setTimeout(r, 500));

              function cleanAN(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
              function isExtEl(el) { return !!(el && el.closest('#sstk-csv-autofill-panel, #sstk-af-launcher-badge, [id*="sstk"], [class*="sstk-af"]')); }

              const listbox = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [data-automation*="menu"], ul[class*="select"], div[class*="menu"], div[class*="popover"]')).find(el => !isExtEl(el));
              const overlayContainer = listbox || document.body;
              const candidateEls = Array.from(overlayContainer.querySelectorAll('[role="option"], [data-automation*="option"], li, div[class*="option"], div[class*="item"], div[class*="select"] div, span, p, div')).filter(el => !isExtEl(el));
              let opts = candidateEls.filter(el => {
                if (isExtEl(el)) return false;
                if (el.closest('textarea, input, [contenteditable="true"]')) return false;
                const rect = el.getBoundingClientRect();
                const t = (el.textContent || '').trim();
                const cT = cleanAN(t);
                if (!cT || cT.length < 2) return false;
                const isVis = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
                return isVis && t.length > 0 && t.length < 50;
              });

              if (opts.length === 0) {
                opts = Array.from(document.querySelectorAll('li, div, span, [role="option"], p')).filter(el => {
                  if (isExtEl(el)) return false;
                  if (el.closest('textarea, input, [contenteditable="true"]')) return false;
                  const rect = el.getBoundingClientRect();
                  const t = (el.textContent || '').trim();
                  const cT = cleanAN(t);
                  if (!cT || cT.length < 2 || t.length > 40) return false;
                  const isVis = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
                  return isVis && (cT === cleanAN(catVal) || cleanAN(t).includes(cleanAN(catVal)));
                });
              }

              const targetClean = cleanAN(catVal);
              let opt = opts.find(o => cleanAN(o.textContent) === targetClean);
              if (!opt && targetClean.length >= 4) {
                opt = opts.find(o => {
                  const oC = cleanAN(o.textContent);
                  if (!oC || oC.length < 3) return false;
                  return oC.includes(targetClean) || targetClean.includes(oC);
                });
              }

              if (opt) {
                const rect = opt.getBoundingClientRect();
                const evOpts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
                opt.dispatchEvent(new PointerEvent('pointerdown', evOpts));
                opt.dispatchEvent(new MouseEvent('mousedown', evOpts));
                opt.dispatchEvent(new PointerEvent('pointerup', evOpts));
                opt.dispatchEvent(new MouseEvent('mouseup', evOpts));
                opt.dispatchEvent(new MouseEvent('click', evOpts));
                opt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                opt.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                if (typeof opt.click === 'function') opt.click();
                if (opt.parentElement && !isExtEl(opt.parentElement)) opt.parentElement.click();

                const rKey = Object.keys(opt).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
                if (rKey && opt[rKey]) {
                  const p = opt[rKey];
                  const dEv = { preventDefault: () => {}, stopPropagation: () => {}, target: opt, currentTarget: opt, bubbles: true, nativeEvent: new MouseEvent('click', evOpts) };
                  if (typeof p.onClick === 'function') p.onClick(dEv);
                  if (typeof p.onMouseDown === 'function') p.onMouseDown(dEv);
                  if (typeof p.onSelect === 'function') p.onSelect(dEv);
                }
                console.log("  ↳ Kategori " + (idx + 1) + " set: " + opt.textContent);
              } else {
                console.warn("  ↳ Kategori " + (idx + 1) + " (" + catVal + ") tidak cocok dari " + opts.length + " opsi.");
                document.body.click();
              }
            }
          }
          await new Promise(r => setTimeout(r, 200));
        }
      }

      await new Promise(r => setTimeout(r, 200));

      // 2. Fill Keywords last
      const kwInput = findKeywordInput();
      if (kwInput && csv.keywords) {
        const kwList = Array.isArray(csv.keywords) ? csv.keywords : csv.keywords.split(/[,;]/).map(k => k.trim()).filter(Boolean);
        if (kwList.length > 0) {
          await fillValueIntoElement(kwInput, kwList.join(', '));
          kwInput.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Comma', keyCode: 188, bubbles: true }));
          kwInput.dispatchEvent(new KeyboardEvent('keyup', { key: ',', code: 'Comma', keyCode: 188, bubbles: true }));
          kwInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          kwInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          console.log("  ↳ " + kwList.length + " Keywords set.");
        }
      }

      successCount++;
    }
  }

  alert("Shutterstock Auto-Fill Console Selesai! Berhasil mengisi " + successCount + " item.");
})();`;

  // Simulation match calculation
  const simulationResults = useMemo(() => {
    const testList = testFileListInput
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    if (parsedRows.length === 0 || testList.length === 0) {
      return {
        matched: [],
        unmatchedShutterstock: testList,
        unmatchedCsv: parsedRows,
        matchRate: 0
      };
    }

    const matched: Array<{ sstkFile: string; csv: CsvRow; matchType: 'exact' | 'base' }> = [];
    const unmatchedShutterstock: string[] = [];

    testList.forEach(sstkFile => {
      const sstkClean = sstkFile.toLowerCase();
      const sstkBase = sstkFile.replace(/\.[^/.]+$/, '').toLowerCase();

      // Exact match
      const exactMatch = parsedRows.find(r => r.filename.toLowerCase() === sstkClean);
      if (exactMatch) {
        matched.push({ sstkFile, csv: exactMatch, matchType: 'exact' });
        return;
      }

      // Base name match (e.g. file.eps vs file.jpg or file)
      const baseMatch = parsedRows.find(r => {
        const rowBase = r.filename.replace(/\.[^/.]+$/, '').toLowerCase();
        return rowBase === sstkBase;
      });

      if (baseMatch) {
        matched.push({ sstkFile, csv: baseMatch, matchType: 'base' });
        return;
      }

      unmatchedShutterstock.push(sstkFile);
    });

    const matchedCsvFilenames = new Set(matched.map(m => m.csv.filename.toLowerCase()));
    const unmatchedCsv = parsedRows.filter(r => !matchedCsvFilenames.has(r.filename.toLowerCase()));

    const matchRate = testList.length > 0 ? Math.round((matched.length / testList.length) * 100) : 0;

    return {
      matched,
      unmatchedShutterstock,
      unmatchedCsv,
      matchRate
    };
  }, [parsedRows, testFileListInput]);

  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return parsedRows;
    const query = searchFilter.toLowerCase();
    return parsedRows.filter(r => 
      r.filename.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query) ||
      r.keywords.some(k => k.toLowerCase().includes(query))
    );
  }, [parsedRows, searchFilter]);

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-700/40">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/30 backdrop-blur-md rounded-full text-xs font-bold text-indigo-200 border border-indigo-400/30">
              <Chrome className="w-3.5 h-3.5 text-indigo-300" />
              Chrome Extension & Contributor Auto-Filler
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Shutterstock CSV Importer
            </h1>
            <p className="text-indigo-200/90 text-sm leading-relaxed">
              Ekstensi Chrome cerdas untuk mencocokkan nama file di CSV (misal: <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs">file.eps</code>) dengan item yang diunggah ke Shutterstock Contributor dan mengisi Title, Keywords, & Kategori secara otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadExtensionZip}
              disabled={isZipping}
              className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 disabled:opacity-50"
              id="btn-download-extension-zip"
            >
              {isZipping ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Ekstensi (.ZIP)</span>
            </button>

            <a
              href="https://submit.shutterstock.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center gap-2 border border-white/15 transition-all"
            >
              <span>Buka Shutterstock</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('download')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
            activeTab === 'download'
              ? "bg-white text-indigo-600 shadow-sm font-black"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <FolderOpen className="w-4 h-4" />
          Panduan & Instalasi
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
            activeTab === 'simulator'
              ? "bg-white text-indigo-600 shadow-sm font-black"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Simulasi Match CSV
          {parsedRows.length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {parsedRows.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('script')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
            activeTab === 'script'
              ? "bg-white text-indigo-600 shadow-sm font-black"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Zap className="w-4 h-4" />
          Script Instan
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
            activeTab === 'code'
              ? "bg-white text-indigo-600 shadow-sm font-black"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Code className="w-4 h-4" />
          Source Code
        </button>
      </div>

      {/* Tab 1: Download & Step-by-Step Installation Guide */}
      {activeTab === 'download' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Download Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Chrome className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Paket Ekstensi Chrome (Manifest V3)</h2>
                <p className="text-xs text-slate-500">Kompatibel dengan Google Chrome, Microsoft Edge, Brave, dan Opera.</p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>shutterstock_csv_autofill_extension.zip</span>
                </div>
                <p className="text-xs text-slate-500">Berisi manifest.json, content script, popup UI, icon, dan stylesheet.</p>
              </div>

              <button
                onClick={handleDownloadExtensionZip}
                disabled={isZipping}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {isZipping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download Ekstensi (.ZIP)</span>
              </button>
            </div>

            {/* 4-Step Visual Guide */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-500" />
                Langkah Mudah Memasang Ekstensi di Chrome
              </h3>

              {/* Troubleshooting Alert Box */}
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>MENGAPA PANEL AUTO-FILL BELUM MUNCIUL DI POKOK KANAN BAWAH?</span>
                </div>
                <ul className="text-xs space-y-1.5 pl-5 list-disc text-amber-900/90 leading-relaxed font-medium">
                  <li>
                    <b>Penyebab Utama:</b> Tab Shutterstock (<code className="bg-amber-100 px-1 rounded text-amber-900 font-mono">submit.shutterstock.com</code>) sudah terbuka <i>sebelum</i> Anda memasang ekstensi. Chrome membutuhkan <b>Refresh Halaman (F5)</b> agar ekstensi baru bisa aktif.
                  </li>
                  <li>
                    <b>Cara Cepat 1 (Refresh F5):</b> Buka tab Shutterstock Anda, lalu tekan <kbd className="bg-white border border-amber-300 px-1.5 py-0.5 rounded shadow-xs font-mono font-bold text-[10px]">F5</kbd> atau tombol Refresh browser.
                  </li>
                  <li>
                    <b>Cara Cepat 2 (Injek Instan via Popup):</b> Klik ikon ekstensi <b>"SS"</b> di pojok kanan atas browser Chrome Anda, lalu klik tombol <b>"🚀 Tampilkan / Injek Panel Auto-Fill"</b>. Panel akan langsung muncul di pojok kanan bawah tanpa perlu refresh!
                  </li>
                  <li>
                    <b>Tanpa Ekstensi?</b> Beralih ke tab <b>"Script Instan"</b> di atas. Copy script-nya dan paste ke F12 Console browser untuk langsung memunculkan panel secara instan.
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Ekstrak File ZIP</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Setelah mengunduh <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">.zip</code>, ekstrak ke folder baru di komputer Anda (misal: <code>Documents/sstk-extension</code>).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Buka Menu Ekstensi Chrome</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Ketik <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">chrome://extensions</code> pada address bar Chrome lalu tekan Enter.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Aktifkan Developer Mode & Load</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Nyalakan toggle <b>Developer mode</b> di pojok kanan atas, lalu klik tombol <b>Load unpacked</b> (Muat yang belum dibongkar) dan pilih folder ekstrak tadi.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                    4
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Auto-Fill di Shutterstock</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Buka <a href="https://submit.shutterstock.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">submit.shutterstock.com</a>, panel widget otomatis aktif di kanan bawah layar untuk mengunggah CSV & auto-fill!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Feature Highlights */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Keunggulan Ekstensi
              </h3>

              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><b>Pencocokan Cerdas:</b> Mencocokkan nama file persis (contoh: <code className="bg-slate-100 px-1 py-0.5 rounded">file.eps</code>) maupun base name tanpa ekstensi.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><b>Native React Input Trigger:</b> Memperbarui state form Shutterstock secara instan tanpa ter-reset saat berpindah card.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><b>Pengisian Lengkap:</b> Mengisi Description/Title, Keywords, Kategori, serta otomatis menandai opsi <i>Illustration</i> untuk file .eps.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><b>100% Client-Side & Aman:</b> Berjalan langsung di browser Anda tanpa mengirim data ke server pihak ketiga.</span>
                </li>
              </ul>
            </div>

            {/* Quick CSV Export Bridge */}
            <div className="bg-indigo-50/70 rounded-3xl p-6 border border-indigo-100 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Gunakan Data dari AI Generator
              </h3>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                Sudah meng-generate metadata di tab utama? Anda bisa langsung memuatnya ke simulator atau mengekspor CSV Shutterstock siap pakai.
              </p>
              <button
                onClick={handleLoadFromCurrentApp}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Impor Hasil Generate ({images.filter(i => i.status === 'completed').length} Selesai)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Interactive CSV File Selector & Match Simulator */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: CSV Upload & File Input */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                1. Pilih File CSV
              </h3>

              {/* Upload area */}
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-all bg-slate-50/50">
                <input
                  type="file"
                  id="simulator-csv-upload"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="simulator-csv-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-600"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {csvFileName || 'Klik untuk Upload File CSV'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Format: Filename, Description, Keywords, Categories (.csv)
                  </span>
                </label>
              </div>

              <div className="text-center">
                <span className="text-[11px] text-slate-400 font-medium">atau</span>
              </div>

              <button
                onClick={handleLoadFromCurrentApp}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Gunakan Data dari AI Generator Saat Ini</span>
              </button>

              {/* CSV Summary stats */}
              {parsedRows.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1.5 text-xs text-emerald-800">
                  <div className="flex justify-between items-center font-bold">
                    <span>Total Baris Metadata:</span>
                    <span className="bg-emerald-200/80 px-2 py-0.5 rounded-full">{parsedRows.length} file</span>
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    File: <span className="font-mono">{csvFileName || 'shutterstock_batch.csv'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Shutterstock File List Simulator */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600" />
                  2. Simulasi Daftar Nama File di Shutterstock
                </h3>
                <span className="text-[11px] text-slate-500">
                  Ketik/Paste nama file yang ada di Shutterstock (1 per baris)
                </span>
              </div>

              <textarea
                value={testFileListInput}
                onChange={(e) => setTestFileListInput(e.target.value)}
                rows={4}
                placeholder="Contoh:&#10;vector_flower.eps&#10;travel_banner.jpg&#10;business_icon_set.eps"
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />

              {/* Simulation Result Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Item Diuji</div>
                  <div className="text-lg font-black text-slate-800">
                    {testFileListInput.split(/\r?\n/).filter(Boolean).length}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Cocok (Matched)</div>
                  <div className="text-lg font-black text-emerald-700">
                    {simulationResults.matched.length}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                  <div className="text-[10px] font-bold text-rose-600 uppercase">Tidak Cocok</div>
                  <div className="text-lg font-black text-rose-700">
                    {simulationResults.unmatchedShutterstock.length}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase">Tingkat Match</div>
                  <div className="text-lg font-black text-indigo-700">
                    {simulationResults.matchRate}%
                  </div>
                </div>
              </div>

              {/* Match Visual List */}
              {simulationResults.matched.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Hasil Pencocokan (Live Match Preview):</span>
                    <span className="text-[11px] text-emerald-600 font-bold">Siap di-fill otomatis</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {simulationResults.matched.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-mono font-bold text-slate-800">{m.sstkFile}</span>
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-mono">
                              {m.matchType === 'exact' ? 'Exact Match (.eps)' : 'Base Match'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {m.csv.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                            {m.csv.keywords.length} Keywords
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table of Parsed CSV Rows */}
          {parsedRows.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    Detail Baris CSV ({parsedRows.length} Baris)
                  </h3>
                  <p className="text-xs text-slate-500">Pratinjau data Title, Keywords, dan Kategori yang akan diisi ke Shutterstock.</p>
                </div>

                <div className="relative max-w-xs w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari nama file / keyword..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Filename</th>
                      <th className="p-3">Title / Description</th>
                      <th className="p-3">Keywords</th>
                      <th className="p-3">Categories</th>
                      <th className="p-3">Illustration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-indigo-600 whitespace-nowrap">
                          {row.filename}
                        </td>
                        <td className="p-3 text-slate-700 max-w-xs truncate" title={row.description}>
                          {row.description}
                        </td>
                        <td className="p-3 text-slate-500 max-w-xs truncate" title={row.keywords.join(', ')}>
                          <span className="font-semibold text-slate-700">({row.keywords.length})</span> {row.keywords.slice(0, 5).join(', ')}...
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">
                          {row.categories.join(', ')}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                            row.illustration.toLowerCase() === 'yes'
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          )}>
                            {row.illustration}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRows.length > 50 && (
                <p className="text-[11px] text-slate-400 text-center">
                  Menampilkan 50 dari {filteredRows.length} baris.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Instant Console Script / Bookmarklet */}
      {activeTab === 'script' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 mb-2">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                Metode Cepat Tanpa Install Ekstensi
              </div>
              <h2 className="text-xl font-bold text-slate-800">Script Console DevTools Instan</h2>
              <p className="text-xs text-slate-500">
                Jika Anda tidak ingin memasang ekstensi, cukup salin kode script di bawah dan jalankan langsung di Console browser (F12) pada tab Shutterstock Contributor.
              </p>
            </div>

            <button
              onClick={() => copyText(instantConsoleScript, 'Script Console')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {copiedCode === 'Script Console' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode === 'Script Console' ? 'Tersalin!' : 'Copy Script Console'}</span>
            </button>
          </div>

          {/* Quick instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800">1. Buka Shutterstock</span>
              <p className="text-[11px] text-slate-500">Buka halaman edit submit media di submit.shutterstock.com.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800">2. Buka Console (F12)</span>
              <p className="text-[11px] text-slate-500">Tekan tombol <kbd className="bg-white px-1 border rounded">F12</kbd> di keyboard lalu klik tab <b>Console</b>.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800">3. Paste & Enter</span>
              <p className="text-[11px] text-slate-500">Paste script di bawah dan tekan Enter. Script akan mencocokkan nama file secara otomatis.</p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute right-3 top-3 z-10">
              <button
                onClick={() => copyText(instantConsoleScript, 'Script Console')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                {copiedCode === 'Script Console' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode === 'Script Console' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl text-xs font-mono overflow-x-auto max-h-96 custom-scrollbar border border-slate-800 leading-relaxed">
              {instantConsoleScript}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: Extension Source Code Viewer */}
      {activeTab === 'code' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Source Code Ekstensi Chrome</h2>
              <p className="text-xs text-slate-500">Lihat atau modifikasi kode sumber Manifest V3 dari ekstensi ini.</p>
            </div>

            {/* File Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSelectedCodeFile('content')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'content' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                content.js
              </button>
              <button
                onClick={() => setSelectedCodeFile('manifest')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'manifest' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                manifest.json
              </button>
              <button
                onClick={() => setSelectedCodeFile('popup')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'popup' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                popup.js
              </button>
              <button
                onClick={() => setSelectedCodeFile('popupHtml')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'popupHtml' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                popup.html
              </button>
              <button
                onClick={() => setSelectedCodeFile('css')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedCodeFile === 'css' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                content.css
              </button>
            </div>
          </div>

          {/* Code Viewer Container */}
          <div className="relative">
            <div className="absolute right-3 top-3 z-10">
              <button
                onClick={() => {
                  const codeToCopy = 
                    selectedCodeFile === 'content' ? extensionContentJs :
                    selectedCodeFile === 'manifest' ? extensionManifest :
                    selectedCodeFile === 'popup' ? extensionPopupJs :
                    selectedCodeFile === 'popupHtml' ? extensionPopupHtml : extensionCss;
                  copyText(codeToCopy, selectedCodeFile);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                {copiedCode === selectedCodeFile ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode === selectedCodeFile ? 'Tersalin' : 'Copy File'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl text-xs font-mono overflow-x-auto max-h-[500px] custom-scrollbar border border-slate-800 leading-relaxed">
              {selectedCodeFile === 'content' && extensionContentJs}
              {selectedCodeFile === 'manifest' && extensionManifest}
              {selectedCodeFile === 'popup' && extensionPopupJs}
              {selectedCodeFile === 'popupHtml' && extensionPopupHtml}
              {selectedCodeFile === 'css' && extensionCss}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
