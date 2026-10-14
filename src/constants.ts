export const MODAL_TYPE = {
  CONFIRM: 'confirm',
  ERROR: 'error',
  SUCCESS: 'success'
};

export const MODELS = [
  // 1. KELOMPOK GRATISAN / SUPER HEMAT KUOTA (Flash Lite Series)
  { 
    id: "gemini-3.1-flash-lite", 
    name: "Gemini 3.1 Flash Lite", 
    badge: "Gratis (Paling Hemat)", 
    badgeType: "free-saver" as const,
    category: "Hemat Kuota",
    description: "Paling hemat kuota (RPM/RPD tertinggi), sangat ramah limit & super cepat" 
  },
  { 
    id: "gemini-3.5-flash-lite", 
    name: "Gemini 3.5 Flash Lite", 
    badge: "Gratis (Hemat Kuota)", 
    badgeType: "free-saver" as const,
    category: "Hemat Kuota",
    description: "Sangat cepat & efisiensi kuota tinggi dengan konsumsi token minimal" 
  },
  { 
    id: "gemini-flash-lite-latest", 
    name: "Gemini Flash Lite Latest", 
    badge: "Gratis (Lite Terbaru)", 
    badgeType: "free-saver" as const,
    category: "Hemat Kuota",
    description: "Model Flash Lite default otomatis versi terbaru dari Google" 
  },

  // 2. KELOMPOK GRATISAN / GENERASI TERBARU (Flash Series Mutakhir)
  { 
    id: "gemini-3.8-flash", 
    name: "Gemini 3.8 Flash", 
    badge: "Gratis (Terbaru)", 
    badgeType: "free-latest" as const,
    category: "Generasi Terbaru",
    description: "Generasi 3.8 Flash paling mutakhir, sangat cerdas, visual tajam & gratis tier" 
  },
  { 
    id: "gemini-flash-latest", 
    name: "Gemini Flash Latest", 
    badge: "Gratis (Default Terbaru)", 
    badgeType: "free-latest" as const,
    category: "Generasi Terbaru",
    description: "Model Flash default versi terbaru Google, performa seimbang & cepat" 
  },
  { 
    id: "gemini-3.7-flash", 
    name: "Gemini 3.7 Flash", 
    badge: "Gratis", 
    badgeType: "free" as const,
    category: "Flash Standard",
    description: "Model generasi 3.7 Flash cerdas, responsif & akurat membaca detail visual" 
  },
  { 
    id: "gemini-3.6-flash", 
    name: "Gemini 3.6 Flash", 
    badge: "Gratis", 
    badgeType: "free" as const,
    category: "Flash Standard",
    description: "Model generasi 3.6 Flash cepat dengan tingkat akurasi tinggi" 
  },
  { 
    id: "gemini-3.5-flash", 
    name: "Gemini 3.5 Flash", 
    badge: "Gratis", 
    badgeType: "free" as const,
    category: "Flash Standard",
    description: "Model Flash stabil dan seimbang untuk pemrosesan batch gambar" 
  },

  // 3. KELOMPOK KAPASITAS TINGGI / PRO (Penalaran Kompleks)
  { 
    id: "gemini-3.1-pro-preview", 
    name: "Gemini 3.1 Pro Preview", 
    badge: "Pro / Kapasitas Tinggi", 
    badgeType: "pro" as const,
    category: "Pro / Kapasitas Tinggi",
    description: "Penalaran visual mendalam & detail tingkat lanjut (konsumsi kuota lebih tinggi)" 
  },
  { 
    id: "gemini-pro-latest", 
    name: "Gemini Pro Latest", 
    badge: "Pro / Kapasitas Tinggi", 
    badgeType: "pro" as const,
    category: "Pro / Kapasitas Tinggi",
    description: "Model Pro default dengan kemampuan analisis dan logika tertinggi" 
  },
];

export const GROQ_MODELS = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout (17B)", description: "Model Llama 4 standard yang efisien" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", description: "Model Llama 4 Maverick lebih kreatif" }
];

export const CHANGELOG_DATA = [
  {
    id: "v1.4.0",
    date: "14 Oktober 2026",
    title: "Update Model Gemini Terbaru & Prioritas Gratis",
    changes: [
      { type: "new", text: "Menambahkan model Gemini 3.8 Flash generasi terbaru yang sangat cerdas & responsif." },
      { type: "improvement", text: "Urutan model diprioritaskan mulai dari model gratisan & hemat kuota (Flash Lite series) ke generasi terbaru, lalu Pro series." },
      { type: "new", text: "Label badge status gratisan/hemat kuota pada pilihan model untuk kemudahan kontributor." }
    ]
  },
  {
    id: "v1.3.0",
    date: "10 Oktober 2026",
    title: "Pendeteksi AI Visual & Indikator Khusus Editorial",
    changes: [
      { type: "new", text: "Fitur Pendeteksi AI murni (Visual AI Detection) dengan badge 'DICURIGAI AI' tanpa mengotori metadata microstock." },
      { type: "new", text: "Badge pembeda khusus EDITORIAL pada daftar gambar dan analisis alasan lisensi." }
    ]
  },
  {
    id: "v1.2.0",
    date: "7 April 2026",
    title: "Update UI & Export Options",
    changes: [
      { type: "new", text: "Halaman Informasi & Changelog dengan riwayat versi (buka/tutup)." },
      { type: "new", text: "Pilihan cakupan ekspor (Download Semua Gambar vs Gambar Terpilih Saja)." },
      { type: "improvement", text: "UI pemilihan ekstensi file (.eps, .jpg, .png) diubah menjadi tombol inline agar lebih mudah diklik." }
    ]
  },
  {
    id: "v1.1.0",
    date: "6 April 2026",
    title: "Metadata Editor & Multi API Key",
    changes: [
      { type: "improvement", text: "Pengaturan batas minimal kata untuk Judul (5-20 kata)." },
      { type: "new", text: "Edit metadata (Judul, Deskripsi, Kata Kunci) secara manual sebelum diunduh." },
      { type: "new", text: "Rotasi Multi API Key untuk mencegah limit (Rate Limit)." }
    ]
  }
];
