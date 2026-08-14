export interface BuildPromptOptions {
  isTransparent?: boolean;
  titleLength?: number;
  keywordCount?: number;
  styleHint?: string;
  titlePreset?: 'commercial' | 'minimalist' | 'detailed' | 'ecommerce';
}

export const BANNED_WORDS = [
  'oriental', 'png', 'download', 'free', 'stock', 'high quality',
  'vector illustration of', 'photo of', 'image of', 'picture of',
  'isolated on white', 'isolated on white background', 'white background'
];

export function buildMicrostockPrompt({
  isTransparent = false,
  titleLength = 100,
  keywordCount = 50,
  styleHint = '',
  titlePreset = 'commercial'
}: BuildPromptOptions): string {
  const presetInstruction = {
    commercial: "Style Focus: High-converting Commercial Microstock. Maximum SEO impact, action & subject first.",
    minimalist: "Style Focus: Clean, Minimalist & Direct. Precise subject and core style without fluff.",
    detailed: "Style Focus: Highly Detailed & Descriptive. Rich in color palette, mood, medium, and contextual utility.",
    ecommerce: "Style Focus: Product & E-Commerce Ready. Emphasize object clarity, presentation, and design versatility."
  }[titlePreset] || "Style Focus: High-converting Commercial Microstock.";

  const customHintSection = styleHint && styleHint.trim().length > 0 
    ? `\nIMPORTANT USER STYLE/NICHE CONTEXT: "${styleHint.trim()}". (Naturally incorporate this specific artistic medium/niche into the title and keywords).`
    : '';

  return `You are an elite Microstock SEO Metadata Specialist (Shutterstock, Adobe Stock, Freepik, PNGTree, Getty Images, VectorStock).
Analyze this image with high precision to generate maximum commercial-value, highly searchable microstock metadata.

${presetInstruction}${customHintSection}
${isTransparent ? "IMPORTANT: This asset has a TRANSPARENT background (no solid background). DO NOT mention 'white background', 'isolated on white', or any solid color in title, description, or keywords. Use 'transparent background', 'cutout', or 'isolated' if needed.\n" : ""}

Generate the following metadata in JSON format:

1. "title": High-converting, natural title for microstock buyers.
   - Format: [Primary Subject / Object] + [Action / Pose / State] + [Environment / Setting] + [Artistic Medium / Style / Mood].
   - Target length: approximately ${titleLength} characters (aim between ${Math.max(35, titleLength - 20)} and ${titleLength + 15} characters).
   - Capitalization: Title Case or clear natural English.
   - MANDATORY RULES:
     * DO NOT start with robotic or generic filler phrases ("A", "An", "The", "Vector illustration of", "An image of", "Close up of", "Photo showing", "3D render of", "Isolated on").
     * Start immediately with the main subject (e.g., "Cute Golden Retriever Puppy Playing with Ball in Green Park at Sunrise").
     * If the target length is long (>70 chars), naturally expand with rich visual details (lighting, color palette, texture, composition, concept) rather than fluff or repetition.

2. "description": A concise, natural 15-25 word description suitable for stock catalogs.
   - Describe subject, dominant colors, atmosphere, and practical design usage (e.g. ideal for website banner, poster, invitation, branding, social media).
   - NO robotic starters like "This is a photo of" or "An image featuring".

3. "keywords": Exactly ${keywordCount} SPECIFIC, buyer-searchable tags in English.
   - Hierarchy of tags to cover:
     a) Primary subject & object nouns
     b) Specific visual elements & action verbs
     c) Artistic medium / technique (e.g., watercolor, flat vector, line art, 3d illustration, photorealistic photo, oil painting)
     d) Dominant color palette & lighting (e.g., pastel, vibrant, dark moody, golden hour)
     e) Emotional mood / vibe (e.g., joyful, serene, professional, festive, luxury)
     f) Commercial usage concepts & formats (e.g., banner, poster, sticker, pattern, logo, background, mockup, template)
   - MANDATORY RULES:
     * Must be single words or concise 2-word key phrases (e.g. "green grass", "watercolor flower").
     * NO generic spam words, NO duplicates, NO trailing hashes or punctuation, NO single-letter tags.
     * All keywords MUST be in lowercase.

4. "categories": Select exactly 2 most relevant categories from this list:
   [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage]

5. "adobeCategory": Select exactly 1 most relevant category from this list:
   [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel]

6. PNGTree Specific Fields:
   - "pngTreeMainKeywords": Exactly 3 most high-traffic core keywords for PNGTree.
   - "pngTreeSecondaryKeywords": Exactly 20 unique tags describing style, elements, and usage.
   - "pngTreeMainCopy": Primary text present in the image (if any) or relevant non-English keywords (e.g. Indonesian/Malay/Spanish terms).

CRITICAL CONSTRAINTS:
- DO NOT use banned stock clutter words: "oriental", "png", "download", "free", "stock", "high quality", "buy".
- Return raw JSON matching the requested fields cleanly.`;
}

export function sanitizeMicrostockMetadata(raw: any, targetKeywordCount = 50) {
  let title = String(raw.title || '').trim();
  // Strip robotic prefix if model accidentally includes it
  title = title.replace(/^(a|an|the|image of|photo of|vector of|vector illustration of|3d render of|illustration of|close up of|picture of)\s+/i, '');
  // Format Title Case
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.endsWith('.')) {
      title = title.slice(0, -1);
    }
  }

  let description = String(raw.description || '').trim();
  description = description.replace(/^(this is a|an image of|a photo of|picture showing)\s+/i, '');
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  // Sanitize keywords
  let rawKeywords: string[] = [];
  if (Array.isArray(raw.keywords)) {
    rawKeywords = raw.keywords;
  } else if (typeof raw.keywords === 'string') {
    rawKeywords = raw.keywords.split(/[,;\n]/);
  }

  const cleanedKeywordsSet = new Set<string>();
  const bannedLower = BANNED_WORDS.map(w => w.toLowerCase());

  for (let kw of rawKeywords) {
    let clean = String(kw || '').toLowerCase().trim();
    clean = clean.replace(/[^a-z0-9\s-]/g, '').trim();
    if (clean.length <= 1) continue;
    if (bannedLower.some(banned => clean.includes(banned))) continue;
    cleanedKeywordsSet.add(clean);
  }

  const keywords = Array.from(cleanedKeywordsSet).slice(0, targetKeywordCount);

  // Categories fallback
  const categories = Array.isArray(raw.categories) && raw.categories.length > 0 
    ? raw.categories.slice(0, 2) 
    : ["Backgrounds/Textures", "Objects"];

  const adobeCategory = String(raw.adobeCategory || "Graphic Resources").trim();

  // PNGTree fallback
  const ptMain = Array.isArray(raw.pngTreeMainKeywords) && raw.pngTreeMainKeywords.length > 0
    ? raw.pngTreeMainKeywords.slice(0, 3) 
    : keywords.slice(0, 3);
  const ptSec = Array.isArray(raw.pngTreeSecondaryKeywords) && raw.pngTreeSecondaryKeywords.length > 0
    ? raw.pngTreeSecondaryKeywords.slice(0, 20) 
    : keywords.slice(0, 20);
  const ptCopy = String(raw.pngTreeMainCopy || '').trim();

  return {
    title,
    description,
    keywords,
    categories,
    adobeCategory,
    pngTree: {
      title,
      mainKeywords: ptMain,
      secondaryKeywords: ptSec,
      mainCopy: ptCopy
    }
  };
}

export function calculateSeoScore(metadata: any, isTransparent = false) {
  if (!metadata) return { score: 0, level: 'poor', items: [] };

  const items: { label: string; passed: boolean; tip: string }[] = [];
  let totalPoints = 0;

  // Title check (30 pts)
  const titleLen = metadata.title?.length || 0;
  const titleWords = (metadata.title || '').trim().split(/\s+/).filter(Boolean).length;
  const hasRoboticStart = /^(a|an|the|image of|photo of|vector of|picture of)\b/i.test(metadata.title || '');

  if (titleLen >= 35 && titleLen <= 150 && !hasRoboticStart && titleWords >= 4) {
    totalPoints += 30;
    items.push({ label: 'Judul SEO Optimal', passed: true, tip: `${titleLen} karakter, ${titleWords} kata. Format bebas robotic.` });
  } else if (titleLen > 12) {
    totalPoints += 18;
    items.push({ label: 'Judul Cukup Baik', passed: false, tip: 'Disarankan 35-120 karakter tanpa kata pembuka "A photo of".' });
  } else {
    items.push({ label: 'Judul Terlalu Pendek', passed: false, tip: 'Judul terlalu singkat untuk algoritma pencarian stock.' });
  }

  // Keywords check (30 pts)
  const kwCount = metadata.keywords?.length || 0;
  if (kwCount >= 30) {
    totalPoints += 30;
    items.push({ label: 'Keywords Lengkap', passed: true, tip: `${kwCount} tags unik dan relevan.` });
  } else if (kwCount >= 15) {
    totalPoints += 18;
    items.push({ label: 'Jumlah Tag Sedang', passed: false, tip: 'Tambahkan hingga 30-50 tag untuk jangkauan pencarian maksimal.' });
  } else {
    items.push({ label: 'Keywords Sedikit', passed: false, tip: 'Sangat disarankan minimal 25-50 keywords.' });
  }

  // Banned words check (20 pts)
  const fullText = `${metadata.title} ${metadata.description} ${(metadata.keywords || []).join(' ')}`.toLowerCase();
  const foundBanned = BANNED_WORDS.filter(w => fullText.includes(w.toLowerCase()));
  if (isTransparent && (fullText.includes('white background') || fullText.includes('isolated on white'))) {
    foundBanned.push('white background (pada asset transparan)');
  }

  if (foundBanned.length === 0) {
    totalPoints += 20;
    items.push({ label: 'Bebas Banned Words', passed: true, tip: 'Tidak ditemukan kata terlarang stock agency.' });
  } else {
    items.push({ label: 'Ditemukan Kata Terlarang', passed: false, tip: `Mengandung kata terlarang: ${foundBanned.slice(0, 3).join(', ')}.` });
  }

  // Description & Categories (20 pts)
  const descLen = metadata.description?.length || 0;
  const hasCat = metadata.categories?.length > 0 && metadata.adobeCategory;
  if (descLen >= 15 && hasCat) {
    totalPoints += 20;
    items.push({ label: 'Kategori & Deskripsi Lengkap', passed: true, tip: 'Siap ekspor ke Adobe Stock, Shutterstock, & Freepik.' });
  } else {
    totalPoints += 10;
    items.push({ label: 'Kategori / Deskripsi Kurang', passed: false, tip: 'Lengkapi deskripsi & kategori agar peninjau stock menyetujui asset.' });
  }

  let level: 'excellent' | 'good' | 'average' | 'poor' = 'poor';
  if (totalPoints >= 85) level = 'excellent';
  else if (totalPoints >= 70) level = 'good';
  else if (totalPoints >= 50) level = 'average';

  return { score: totalPoints, level, items };
}
