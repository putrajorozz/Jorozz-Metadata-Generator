import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileDown, 
  FileText, 
  Check, 
  Loader2, 
  ArrowRight, 
  Download, 
  AlertTriangle, 
  X, 
  Trash2, 
  Sparkles,
  Info,
  Layers,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import JSZip from 'jszip';

interface EpFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMsg?: string;
  matchedRow?: {
    title: string;
    description: string;
    keywords: string[];
  };
}

interface CsvRow {
  filename: string;
  title: string;
  description: string;
  keywords: string[];
}

export function EpsMetadataInjector() {
  const [epsFiles, setEpsFiles] = useState<EpFile[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInjected, setIsInjected] = useState(false);
  
  const epsInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [isEpsDragging, setIsEpsDragging] = useState(false);
  const [isCsvDragging, setIsCsvDragging] = useState(false);

  // Helper: toast alert replacement
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'err' }[]>([]);
  
  const addToast = (msg: string, type: 'success' | 'err' = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Helper: Extract name from path and strip extension to get clean comparable basename
  function getCleanBaseName(pathOrName: string): string {
    if (!pathOrName) return "";
    // Clean string from backslashes or slashes
    const parts = pathOrName.split(/[\\/]/);
    const fileName = parts[parts.length - 1];
    // Strip file extension to get pure name
    return fileName.toLowerCase().trim().replace(/\.[^/.]+$/, "");
  }

  // CSV Parser with quote and escape support
  function parseCSV(text: string): CsvRow[] {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let entry = "";
    
    const cleanText = text.replace(/\r/g, "");
    
    // Detect separator (comma vs semicolon)
    let separator = ",";
    const firstLine = cleanText.split("\n")[0] || "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    if (semicolonCount > commaCount) {
      separator = ";";
    }
    
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            entry += '"';
            i++; // skip next quote
          } else {
            inQuotes = false;
          }
        } else {
          entry += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === separator) {
          row.push(entry.trim());
          entry = "";
        } else if (char === "\n") {
          row.push(entry.trim());
          lines.push(row);
          row = [];
          entry = "";
        } else {
          entry += char;
        }
      }
    }
    
    if (entry || row.length > 0) {
      row.push(entry.trim());
      lines.push(row);
    }
    
    if (lines.length === 0) return [];

    // Parse headers dynamically
    const headers = lines[0].map(h => h.toLowerCase().trim().replace(/^["']|["']$/g, ""));
    
    // Column indices mapping
    const fileIdx = headers.findIndex(h => h.includes("file") || h.includes("nama") || h === "name" || h === "image");
    const titleIdx = headers.findIndex(h => h.includes("title") || h.includes("judul") || h === "subject" || h === "headline");
    // Shutterstock style is description
    const descIdx = headers.findIndex(h => h.includes("description") || h.includes("desc") || h.includes("deskripsi") || h === "caption");
    const kwIdx = headers.findIndex(h => h.includes("keyword") || h.includes("tags") || h.includes("kata kunci"));

    const chosenFileIdx = fileIdx !== -1 ? fileIdx : 0;
    const chosenTitleIdx = titleIdx !== -1 ? titleIdx : (descIdx !== -1 ? descIdx : 1);
    const chosenDescIdx = descIdx !== -1 ? descIdx : (titleIdx !== -1 ? titleIdx : 1);
    const chosenKwIdx = kwIdx !== -1 ? kwIdx : 2;

    const matchedRows: CsvRow[] = [];
    
    for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
      const current = lines[rowIdx];
      // Skip empty or mismatching lines
      if (current.length <= Math.max(chosenFileIdx, chosenTitleIdx)) continue;
      
      const fileVal = current[chosenFileIdx] || "";
      if (!fileVal) continue;

      const titleVal = current[chosenTitleIdx] || "";
      const descVal = current[chosenDescIdx] || titleVal || "";
      const kwVal = current[chosenKwIdx] || "";

      // Keywords might be in "kw1, kw2, kw3" format or separated by semicolon
      let kwArray: string[] = [];
      if (kwVal) {
        kwArray = kwVal.split(/[,;\n\t|]+/).map(k => k.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      }

      matchedRows.push({
        filename: fileVal.replace(/^["']|["']$/g, "").trim(),
        title: titleVal.replace(/^["']|["']$/g, "").trim(),
        description: descVal.replace(/^["']|["']$/g, "").trim(),
        keywords: kwArray
      });
    }

    return matchedRows;
  }

  // Handle CSV file upload
  const handleCsvFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      addToast('File harus berkas .csv!', 'err');
      return;
    }
    
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = parseCSV(text);
        setCsvData(rows);
        addToast(`Berhasil memuat ${rows.length} baris data dari CSV!`, 'success');
        
        // Re-calculate matches for existing uploaded files
        setEpsFiles(prev => reconcileMatches(prev, rows));
      } catch (err) {
        addToast('Gagal memproses file CSV.', 'err');
      }
    };
    reader.readAsText(file, "utf-8");
  };

  // Reconcile and pair files with CSV rows using our base clean name helper
  const reconcileMatches = (filesList: EpFile[], csvList: CsvRow[]): EpFile[] => {
    return filesList.map(ep => {
      const cleanEpsBase = getCleanBaseName(ep.file.name);
      
      // Look for a row in CSV that matches either baseName, full file, or path segment
      const matched = csvList.find(row => {
        const cleanCsvBase = getCleanBaseName(row.filename);
        return cleanCsvBase === cleanEpsBase || row.filename.toLowerCase().trim() === ep.file.name.toLowerCase().trim();
      });

      return {
        ...ep,
        matchedRow: matched ? {
          title: matched.title,
          description: matched.description,
          keywords: matched.keywords
        } : undefined
      };
    });
  };

  // Handle EPS files upload
  const handleEpsFiles = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles: EpFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Accept .eps, but also generic image types (user requested EPS as example)
      newFiles.push({
        id: Math.random().toString() + i,
        file,
        status: 'pending'
      });
    }

    setEpsFiles(prev => {
      const combined = [...prev, ...newFiles];
      return reconcileMatches(combined, csvData);
    });
    addToast(`Ditambahkan ${files.length} file baru.`, 'success');
  };

  // Delete individual file from queue
  const removeEpsFile = (id: string) => {
    setEpsFiles(prev => prev.filter(f => f.id !== id));
  };

  // Remove uploaded CSV
  const removeCsv = () => {
    setCsvFile(null);
    setCsvData([]);
    setEpsFiles(prev => prev.map(f => ({ ...f, matchedRow: undefined, status: 'pending' })));
    addToast('File CSV dihapus.', 'success');
  };

  // Binary-Safe Metadata Replacement in EPS
  // Returns Blob
  async function performInjection(epFile: EpFile): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!epFile.matchedRow) {
        reject(new Error("Tidak ada baris metadata CSV yang cocok."));
        return;
      }

      const { title, description, keywords } = epFile.matchedRow;
      const reader = new FileReader();

      reader.onerror = () => reject(new Error("Gagal membaca file berkas."));
      reader.onload = (e) => {
        try {
          // Read using ISO-8859-1 (latin1) to guarantee 1-to-1 byte preservation
          let content = e.target?.result as string;

          // 1. Update classic DSC headers in the PostScript file
          content = replaceDscHeader(content, "Title", title);
          if (keywords.length > 0) {
            content = replaceDscHeader(content, "Keywords", keywords.slice(0, 50).join(", "));
          }

          // 2. Inject/Replace dynamic XMP package
          const xmpStartMarker = '<?xpacket begin=';
          const xmpEndMarker = '<?xpacket end=';
          const startIndex = content.indexOf(xmpStartMarker);
          
          if (startIndex !== -1) {
            const endIdxTemp = content.indexOf(xmpEndMarker, startIndex);
            if (endIdxTemp !== -1) {
              // Find the boundary closing tag (usually ?> is right after end="w")
              const endIndex = content.indexOf('?>', endIdxTemp) + 2;
              const originalXmp = content.substring(startIndex, endIndex);

              // Perform replacing inside the XMP segment
              let updatedXmp = originalXmp;
              updatedXmp = replaceOrInsertXmpTag(updatedXmp, "dc:title", title, false);
              updatedXmp = replaceOrInsertXmpTag(updatedXmp, "dc:description", description || title, false);
              updatedXmp = replaceOrInsertXmpTag(updatedXmp, "dc:subject", "", true, keywords);

              // Replace original block
              content = content.slice(0, startIndex) + updatedXmp + content.slice(endIndex);
            }
          } else {
            // No existing XMP Packet. Let's create a fresh XMP metadata block and insert it
            // before the end of the file %%EOF, or at the end
            const xmpPacket = createXmpPacket(title, description || title, keywords);
            const eofMarker = '%%EOF';
            const eofIndex = content.lastIndexOf(eofMarker);
            if (eofIndex !== -1) {
              content = content.slice(0, eofIndex) + xmpPacket + "\n" + content.slice(eofIndex);
            } else {
              content = content + "\n" + xmpPacket;
            }
          }

          // 3. Convert ISO-8859-1 string back to exact Uint8Array bytes
          const outputBytes = new Uint8Array(content.length);
          for (let i = 0; i < content.length; i++) {
            outputBytes[i] = content.charCodeAt(i) & 0xFF;
          }

          const outputBlob = new Blob([outputBytes], { type: epFile.file.type || 'application/postscript' });
          resolve(outputBlob);
        } catch (error) {
          reject(error);
        }
      };

      // Read as binary preservable ISO-8859-1
      reader.readAsText(epFile.file, "ISO-8859-1");
    });
  }

  // Inject metadata for classic PostScript Document Structuring Comments
  function replaceDscHeader(content: string, headerName: string, value: string): string {
    const regex = new RegExp(`^%%${headerName}:\\s*(.*)$`, 'm');
    const sanitizedVal = value.replace(/[\r\n]/g, " ").slice(0, 200); // strip line breaks
    
    if (regex.test(content)) {
      return content.replace(regex, `%%${headerName}: ${sanitizedVal}`);
    } else {
      // Find standard PS header and append right after it
      const headerIndex = content.search(/^%!PS-Adobe-.*$/m);
      if (headerIndex !== -1) {
        const insertionLine = `%%${headerName}: ${sanitizedVal}`;
        const newlineIdx = content.indexOf("\n", headerIndex);
        if (newlineIdx !== -1) {
          return content.slice(0, newlineIdx + 1) + insertionLine + "\n" + content.slice(newlineIdx + 1);
        }
      }
    }
    return content;
  }

  // XML replacement routine
  function replaceOrInsertXmpTag(
    xmp: string,
    tagName: string,
    content: string,
    isList: boolean,
    listItems?: string[]
  ): string {
    const escapeXml = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    const escapedContent = escapeXml(content);
    let newTagContent = "";

    if (isList && listItems) {
      const listElements = listItems.map(item => `      <rdf:li>${escapeXml(item.trim())}</rdf:li>`).join("\n");
      newTagContent = `<${tagName}>\n    <rdf:Bag>\n${listElements}\n    </rdf:Bag>\n   </${tagName}>`;
    } else {
      newTagContent = `<${tagName}>\n    <rdf:Alt>\n     <rdf:li xml:lang="x-default">${escapedContent}</rdf:li>\n    </rdf:Alt>\n   </${tagName}>`;
    }

    // Match exact tags
    const tagRegex = new RegExp(`<${tagName}(?:\\s+[^>]*)?>[\\s\\S]*?<\\/${tagName}>`, 'i');
    const selfClosingRegex = new RegExp(`<${tagName}\\s*\\/>`, 'i');

    if (tagRegex.test(xmp)) {
      return xmp.replace(tagRegex, newTagContent);
    } else if (selfClosingRegex.test(xmp)) {
      return xmp.replace(selfClosingRegex, newTagContent);
    } else {
      // Find Description block opening and inject
      const descOpenRegex = /<rdf:Description\s[^>]*>/i;
      const simpleDescOpenRegex = /<rdf:Description>/i;
      
      if (descOpenRegex.test(xmp)) {
        return xmp.replace(descOpenRegex, (match) => `${match}\n   ${newTagContent}`);
      } else if (simpleDescOpenRegex.test(xmp)) {
        return xmp.replace(simpleDescOpenRegex, `<rdf:Description>\n   ${newTagContent}`);
      } else {
        // Fallback: put inside first RDF block
        const rdfOpenRegex = /<rdf:RDF[^>]*>/i;
        if (rdfOpenRegex.test(xmp)) {
          return xmp.replace(rdfOpenRegex, (match) => `${match}\n  <rdf:Description rdf:about="">\n   ${newTagContent}\n  </rdf:Description>`);
        }
      }
    }
    return xmp;
  }

  // Create clean XMP block if non-existent
  function createXmpPacket(title: string, description: string, keywords: string[]): string {
    const escapeXml = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    const xmlKeywords = keywords.map(k => `     <rdf:li>${escapeXml(k)}</rdf:li>`).join("\n");

    return `%BeginXML: metadata
<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c148 79.164036, 2019/08/13-01:06:57">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escapeXml(description)}</rdf:li>
    </rdf:Alt>
   </dc:description>
   <dc:subject>
    <rdf:Bag>
${xmlKeywords}
    </rdf:Bag>
   </dc:subject>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
%EndXML`;
  }

  // Inject All
  const processInjectionAll = async () => {
    const matchesCount = epsFiles.filter(f => f.matchedRow).length;
    if (matchesCount === 0) {
      addToast('Tidak ada baris CSV yang cocok untuk disuntikkan.', 'err');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;

    const processedFiles = await Promise.all(
      epsFiles.map(async (ep) => {
        if (!ep.matchedRow) return ep;
        
        try {
          const injectedBlob = await performInjection(ep);
          successCount++;
          // Safe object replacement with generated blob as internal data source
          // Override ep file reference with newly compiled code
          const modifiedFile = new File([injectedBlob], ep.file.name, { type: ep.file.type });
          return {
            ...ep,
            file: modifiedFile,
            status: 'completed' as const
          };
        } catch (err: any) {
          return {
            ...ep,
            status: 'error' as const,
            errorMsg: err.message || "Failed"
          };
        }
      })
    );

    setEpsFiles(processedFiles);
    setIsProcessing(false);
    setIsInjected(true);
    addToast(`Berhasil menyuntik metadata ke ${successCount} file!`, 'success');
  };

  // Download Individual File
  const downloadSingleFile = (ep: EpFile) => {
    const url = URL.createObjectURL(ep.file);
    const link = document.createElement("a");
    link.href = url;
    link.download = ep.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Mengunduh ${ep.file.name}`);
  };

  // Download All as ZIP
  const downloadAllZip = async () => {
    const completedFiles = epsFiles.filter(f => f.status === 'completed');
    if (completedFiles.length === 0) {
      addToast('Tidak ada file yang siap diproses untuk diunduh.', 'err');
      return;
    }

    addToast('Menyiapkan file ZIP...');
    const zip = new JSZip();

    completedFiles.forEach((ep) => {
      zip.file(ep.file.name, ep.file);
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Metadata_Injected_Vectors_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Berhasil mengunduh bulk ZIP!', 'success');
    } catch (e) {
      addToast('Gagal membuat file ZIP.', 'err');
    }
  };

  // Filtered lists shown in UI
  const filteredFiles = epsFiles.filter(f => 
    f.file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Toast Manager */}
      <div className="fixed top-24 right-6 z-[120] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "px-4 py-2.5 rounded-2xl shadow-xl border backdrop-blur-md flex items-center gap-3 pointer-events-auto",
                toast.type === "success" 
                  ? "bg-emerald-500/90 text-white border-emerald-400" 
                  : "bg-rose-500/90 text-white border-rose-400"
              )}
            >
              {toast.type === 'success' ? (
                <Check className="w-4 h-4 bg-white/20 rounded-full p-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-white shrink-0" />
              )}
              <span className="text-xs font-black tracking-wide uppercase">{toast.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header and Info */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 p-1.5 px-3 bg-indigo-50 border border-indigo-100/50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full">
            <Layers className="w-3.5 h-3.5" />
            Penyuntik Metadata EPS via CSV
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">CSV to Vector Metadata Injector</h1>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Suntikkan judul, deskripsi, dan keyword dari file CSV langsung ke dalam file vektor (.eps) Anda secara aman. 
            Semua proses pengolahan dilakukan <strong>100% lokal langsung di dalam browser Anda</strong>, menjaga keaslian data biner tanpa risiko merusak visual artwork.
          </p>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-sm shrink-0">
          <div className="flex gap-2 text-xs text-slate-600 font-medium">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-700 mb-0.5">Format Kolom CSV yang didukung:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px]">
                <li>File Name / Filename</li>
                <li>Title / Judul (or Description)</li>
                <li>Keywords / Tags</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CSV Dropzone */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsCsvDragging(true); }}
          onDragLeave={() => setIsCsvDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsCsvDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleCsvFile(e.dataTransfer.files[0]);
            }
          }}
          className={cn(
            "bg-white border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all min-h-[220px]",
            isCsvDragging ? "border-indigo-500 bg-indigo-50/30" : "border-slate-200 hover:border-slate-300",
            csvFile ? "border-emerald-200 bg-emerald-50/5" : ""
          )}
        >
          <input 
            type="file" 
            ref={csvInputRef}
            onChange={(e) => e.target.files && handleCsvFile(e.target.files[0])}
            accept=".csv" 
            className="hidden"
          />
          
          {csvFile ? (
            <div className="space-y-4 w-full">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-50">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm truncate max-w-xs mx-auto">{csvFile.name}</h3>
                <p className="text-xs text-slate-400 mt-1">Teridentifikasi <strong>{csvData.length} baris</strong> metadata siap suntik</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button 
                  onClick={() => csvInputRef.current?.click()}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Ganti File
                </button>
                <button 
                  onClick={removeCsv}
                  className="px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                  title="Hapus CSV"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 text-sm">Upload File CSV</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  Drag & drop file CSV yang berisi metadata atau klik tombol dibawah untuk menelusuri file.
                </p>
              </div>
              <button 
                onClick={() => csvInputRef.current?.click()}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-slate-100 transition-all active:scale-95"
              >
                Cari Berkas CSV
              </button>
            </div>
          )}
        </div>

        {/* EPS Dropzone */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsEpsDragging(true); }}
          onDragLeave={() => setIsEpsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsEpsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleEpsFiles(e.dataTransfer.files);
            }
          }}
          className={cn(
            "bg-white border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all min-h-[220px]",
            isEpsDragging ? "border-indigo-500 bg-indigo-50/30" : "border-slate-200 hover:border-slate-300",
            epsFiles.length > 0 ? "border-indigo-200 bg-indigo-50/5" : ""
          )}
        >
          <input 
            type="file" 
            ref={epsInputRef}
            onChange={(e) => handleEpsFiles(e.target.files)}
            multiple 
            accept=".eps" 
            className="hidden"
          />
          
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-md shadow-indigo-50">
              <Upload className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-700 text-sm">Upload File EPS</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                Drag & drop berkas <strong>.eps</strong> yang ingin disuntik, atau klik pencarian berkas.
              </p>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <button 
                onClick={() => epsInputRef.current?.click()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
              >
                Cari File EPS
              </button>
              {epsFiles.length > 0 && (
                <button 
                  onClick={() => setEpsFiles([])}
                  className="px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-xl font-bold border border-rose-100"
                >
                  Kosongkan List
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* CSV Metadata List Preview */}
      {csvData.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-750 rounded-full text-[10px] font-black uppercase tracking-wider mb-1">
                <FileText className="w-3.5 h-3.5" />
                Daftar Metadata CSV Terbaca
              </div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Daftar Baris CSV ({csvData.length} Item)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Sistem memisahkan beberapa baris metadata dari berkas CSV secara detail</p>
            </div>
            
            <div className="text-xs font-black text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shrink-0">
              Link Terpasang: <span className="text-emerald-600 font-extrabold">{epsFiles.filter(f => f.matchedRow).length}</span> / <span className="font-extrabold">{epsFiles.length}</span> Berkas EPS
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl divide-y divide-slate-150/60 bg-slate-50/20">
            {csvData.map((row, idx) => {
              // Check if any uploaded EPS file matches this row
              const cleanRowBase = getCleanBaseName(row.filename);
              const isMatchedByUploaded = epsFiles.some(f => getCleanBaseName(f.file.name) === cleanRowBase || f.file.name.toLowerCase().trim() === row.filename.toLowerCase().trim());

              return (
                <div key={idx} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:bg-white transition-colors">
                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-black">
                        BARIS #{idx + 1}
                      </span>
                      <p className="font-bold text-slate-700 truncate max-w-sm" title={row.filename}>
                        {row.filename}
                      </p>
                    </div>
                    <p className="font-black text-indigo-600 truncate max-w-xl" title={row.title}>
                      {row.title}
                    </p>
                    {row.description && row.description !== row.title && (
                      <p className="text-slate-400 truncate max-w-xl text-[11px]" title={row.description}>
                        {row.description}
                      </p>
                    )}
                    {row.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {row.keywords.slice(0, 10).map((kw, kwIdx) => (
                          <span key={kwIdx} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200/50">
                            {kw}
                          </span>
                        ))}
                        {row.keywords.length > 10 && (
                          <span className="text-[9px] text-slate-400 font-black pt-0.5 pl-1">
                            +{row.keywords.length - 10} lainnya
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    {isMatchedByUploaded ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                        <Check className="w-3 h-3" />
                        Terpasang (Ada EPS)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50/70 text-rose-600 border border-rose-100/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        Belum Diupload EPS
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Files Table & Verification Layout */}
      {epsFiles.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm space-y-4 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Antrian File Suntik ({epsFiles.length} Berkas)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Rekonsiliasi baris data otomatis berdasarkan kemiripan nama file</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="text" 
                placeholder="Cari dalam antrian..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 w-full sm:w-48"
              />
              
              {/* Trigger Button */}
              {!isInjected ? (
                <button 
                  onClick={processInjectionAll}
                  disabled={isProcessing || !csvFile || epsFiles.filter(f => f.matchedRow).length === 0}
                  className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Mulai Suntik
                </button>
              ) : (
                <button 
                  onClick={downloadAllZip}
                  className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 animation-pulse"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Download Semua (ZIP)
                </button>
              )}
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="py-3 px-4">Nama File EPS</th>
                  <th className="py-3 px-4">Pencarian di CSV</th>
                  <th className="py-3 px-4">Recocile Judul/Description</th>
                  <th className="py-3 px-4">Keywords</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredFiles.map((ep) => {
                  const isMatched = !!ep.matchedRow;
                  
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[9px]">
                              EPS
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate max-w-[170px]">{ep.file.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{(ep.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isMatched ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100/50 rounded-lg text-[10px] font-bold">
                            <Check className="w-3 h-3 shrink-0" />
                            Cocok
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100/30 rounded-lg text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            Tidak Ada
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {isMatched ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={ep.matchedRow!.title}>
                              {ep.matchedRow!.title}
                            </p>
                            {ep.matchedRow!.description && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={ep.matchedRow!.description}>
                                {ep.matchedRow!.description}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">Lewati proses injection</p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isMatched ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-1.5 py-0.5 rounded-full border border-slate-200">
                              {ep.matchedRow!.keywords.length} Kata Kunci
                            </span>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {ep.status === 'pending' && (
                          <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100/80 px-2.5 py-1 rounded-full">
                            Menunggu
                          </span>
                        )}
                        {ep.status === 'processing' && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Proses
                          </span>
                        )}
                        {ep.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                            <Check className="w-3 h-3" />
                            Selesai
                          </span>
                        )}
                        {ep.status === 'error' && (
                          <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full" title={ep.errorMsg}>
                            Gagal
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ep.status === 'completed' && (
                            <button
                              onClick={() => downloadSingleFile(ep)}
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100"
                              title="Download Berkas"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => removeEpsFile(ep.id)}
                            className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick instructions / Help */}
          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-300 shrink-0" />
            <span>
              Tips: Sistem akan membandingkan nama file EPS dengan kolom nama file di CSV (terlepas dari ekstensi). Pastikan berkas CSV diekspor dari aplikasi generator kami untuk integritas pencocokan tercepat.
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
