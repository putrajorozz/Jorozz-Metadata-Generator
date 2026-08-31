export const MODAL_TYPE = {
  CONFIRM: 'confirm',
  ERROR: 'error',
  SUCCESS: 'success'
};

export const MODELS = [
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite (Gratisan/Hemat Kuota)", description: "Paling hemat kuota, efisien & sangat cepat" },
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite (Gratisan/Hemat Kuota)", description: "Sangat cepat & efisien dengan konsumsi kuota sangat rendah" },
  { id: "gemini-flash-lite-latest", name: "Gemini Flash Lite Latest (Gratisan/Hemat Kuota)", description: "Model Flash Lite default versi terbaru, sangat ramah limit" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview (Gratisan)", description: "Model Gemini 3 Flash versi preview yang efisien" },
  { id: "gemini-flash-latest", name: "Gemini Flash Latest (Hemat Kuota)", description: "Model Flash default versi terbaru, seimbang dan cepat" },
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", description: "Model generasi 3.7 Flash paling mutakhir, sangat cerdas & responsif" },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", description: "Model generasi 3.6 Flash terbaru dengan performa tinggi" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", description: "Seimbang antara performa akurat dan kecepatan optimal" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview (Kapasitas Tinggi)", description: "Penalaran kuat & pemahaman konteks mendalam (Konsumsi kuota lebih tinggi)" },
  { id: "gemini-pro-latest", name: "Gemini Pro Latest (Kapasitas Tinggi)", description: "Model Pro default dengan kemampuan penalaran tinggi" },
];

export const GROQ_MODELS = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout (17B)", description: "Model Llama 4 standard yang efisien" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", description: "Model Llama 4 Maverick lebih kreatif" }
];

export const CHANGELOG_DATA = [
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
