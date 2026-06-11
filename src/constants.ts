export const MODAL_TYPE = {
  CONFIRM: 'confirm',
  ERROR: 'error',
  SUCCESS: 'success'
};

export const MODELS = [
  { id: "gemini-pro-latest", name: "Gemini Pro Latest", description: "Model Pro terbaru, kemampuan penalaran kuat" },
  { id: "gemini-flash-latest", name: "Gemini Flash Latest", description: "Model Flash terbaru, efisien & cepat" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Model terbaru, sangat cepat & akurat" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Versi ringan Gemini 2.5 Flash" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Model Gemini 2.0 Flash handal" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "Versi ringan Gemini 2.0 Flash" },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite (Free Tier)", description: "Paling hemat kuota & cepat" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Free Tier)", description: "Keseimbangan kualitas & kecepatan" },
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
