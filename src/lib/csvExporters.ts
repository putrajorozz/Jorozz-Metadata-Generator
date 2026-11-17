import { ImageData } from '../types';
import { cleanShutterstockText } from './metadataUtils';

export interface CsvExportOptions {
  images: ImageData[];
  exportExtension: string;
  isGenerativeAI?: boolean;
  aiModel?: string;
}

function triggerCsvDownload(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Freepik / Magnific CSV Export
 * Format: filename;title;tags;is_ai;ai_prompt;ai_model;people_count (semicolon-separated, without quotes)
 */
export function exportFreepikCSV({
  images,
  exportExtension,
  isGenerativeAI = false,
  aiModel = ''
}: CsvExportOptions): { count: number } {
  const imagesToExport = images.filter(img => img.status === 'completed' && img.metadata);
  if (imagesToExport.length === 0) return { count: 0 };

  const sanitizeCell = (value: string) =>
    value.replace(/[\r\n]+/g, ' ').replace(/;/g, ',').replace(/"/g, '').trim();

  const headers = [
    'filename',
    'title',
    'tags',
    'is_ai',
    'ai_prompt',
    'ai_model',
    'people_count'
  ];

  const rows = imagesToExport.map(img => {
    let title = img.metadata!.title || '';
    if (title.length > 100) {
      title = title.substring(0, 100);
    }

    let keywordsArray = [...img.metadata!.keywords];
    if (isGenerativeAI) {
      keywordsArray = keywordsArray.slice(0, 49);
    }

    const fileNameWithExt = img.file.name.replace(/\.[^/.]+$/, '') + exportExtension;
    const filename = sanitizeCell(fileNameWithExt);
    const cleanTitle = sanitizeCell(title);
    const tags = sanitizeCell(keywordsArray.join(','));
    const isAi = isGenerativeAI ? 'yes' : 'no';
    const aiPrompt = isGenerativeAI ? sanitizeCell(img.metadata!.prompt || '') : '';
    const aiModelName = isGenerativeAI ? sanitizeCell(aiModel || '') : '';
    const peopleCount = '0';

    return [filename, cleanTitle, tags, isAi, aiPrompt, aiModelName, peopleCount];
  });

  const csvContent = [headers, ...rows].map(e => e.join(';')).join('\n');
  const fileName =
    imagesToExport.length === 1
      ? `freepik_${imagesToExport[0].file.name.split('.')[0]}.csv`
      : `freepik_bulk_${new Date().toISOString().split('T')[0]}.csv`;

  triggerCsvDownload(csvContent, fileName);
  return { count: imagesToExport.length };
}

/**
 * Adobe Stock CSV Export
 * Format: Filename,Title,Keywords
 */
export function exportAdobeStockCSV({
  images,
  exportExtension
}: CsvExportOptions): { count: number } {
  const imagesToExport = images.filter(img => img.status === 'completed' && img.metadata);
  if (imagesToExport.length === 0) return { count: 0 };

  const headers = ['Filename', 'Title', 'Keywords'];
  const rows = imagesToExport.map(img => {
    const fileNameWithExt = img.file.name.replace(/\.[^/.]+$/, '') + exportExtension;
    return [
      fileNameWithExt,
      `"${img.metadata!.title.replace(/"/g, '""')}"`,
      `"${img.metadata!.keywords.join(', ').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const fileName =
    imagesToExport.length === 1
      ? `adobestock_${imagesToExport[0].file.name.split('.')[0]}.csv`
      : `adobestock_bulk_${new Date().toISOString().split('T')[0]}.csv`;

  triggerCsvDownload(csvContent, fileName);
  return { count: imagesToExport.length };
}

/**
 * Shutterstock CSV Export
 * Format: Filename,Description,Keywords,Categories,Editorial,Mature content,Illustration
 */
export function exportShutterstockCSV({
  images,
  exportExtension
}: CsvExportOptions): { count: number } {
  const imagesToExport = images.filter(img => img.status === 'completed' && img.metadata);
  if (imagesToExport.length === 0) return { count: 0 };

  const headers = [
    'Filename',
    'Description',
    'Keywords',
    'Categories',
    'Editorial',
    'Mature content',
    'Illustration'
  ];

  const rows = imagesToExport.map(img => {
    const fileNameWithExt = img.file.name.replace(/\.[^/.]+$/, '') + exportExtension;
    const isIllustration = exportExtension === '.eps' ? 'Yes' : 'No';
    const rawDescription = img.metadata!.title || img.metadata!.description;
    const description = cleanShutterstockText(rawDescription);
    const cleanKeywords = img.metadata!.keywords
      .map(kw => cleanShutterstockText(kw))
      .filter(Boolean)
      .join(', ');

    return [
      fileNameWithExt,
      `"${description.replace(/"/g, '""')}"`,
      `"${cleanKeywords.replace(/"/g, '""')}"`,
      `"${(img.metadata!.categories || ['Miscellaneous']).join(',').replace(/"/g, '""')}"`,
      img.metadata!.editorialRecommendation === 'editorial' ? 'Yes' : 'No',
      'No',
      isIllustration
    ];
  });

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const fileName =
    imagesToExport.length === 1
      ? `shutterstock_${imagesToExport[0].file.name.split('.')[0]}.csv`
      : `shutterstock_bulk_${new Date().toISOString().split('T')[0]}.csv`;

  triggerCsvDownload(csvContent, fileName);
  return { count: imagesToExport.length };
}
