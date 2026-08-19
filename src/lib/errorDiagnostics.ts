import { ErrorDiagnostic } from '../types';

export function categorizeApiError(
  error: any,
  context?: { modelName?: string; keyMasked?: string }
): ErrorDiagnostic {
  const raw = error?.message || (typeof error === 'string' ? error : JSON.stringify(error || ''));
  const lower = raw.toLowerCase();

  let type: ErrorDiagnostic['type'] = 'unknown';
  let badge = 'Error API';
  let title = 'Terjadi Kesalahan Pemrosesan AI';
  let description = raw.slice(0, 160) || 'Kesalahan respon dari server AI.';

  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit_exceeded') ||
    lower.includes('too many requests')
  ) {
    type = 'rate_limit';
    badge = '429 Rate Limit';
    title = 'Limit Kuota / Rate Limit Tercapai (429)';
    description = 'API key mencapai batas request per menit (RPM) atau kuota token/harian habis.';
  } else if (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('model not found') ||
    lower.includes('models/') ||
    lower.includes('does not exist') ||
    lower.includes('unsupported model')
  ) {
    type = 'model_not_found';
    badge = '404 Model Not Found';
    title = 'Model AI Tidak Ditemukan / Tidak Tersedia (404)';
    description = 'Model yang diminta tidak ditemukan atau tidak tersedia pada API key / akun ini.';
  } else if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('expired')
  ) {
    type = 'invalid_key';
    badge = '401/403 Invalid Key';
    title = 'API Key Tidak Valid / Akses Ditolak';
    description = 'API key salah, telah kedaluwarsa, atau tidak memiliki izin akses ke model ini.';
  } else if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('internet')
  ) {
    type = 'network';
    badge = 'Network Error';
    title = 'Gangguan Koneksi Jaringan / Timeout';
    description = 'Gagal terhubung ke endpoint server AI. Periksa koneksi internet Anda.';
  }

  return {
    type,
    badge,
    title,
    description,
    rawMessage: raw,
    modelName: context?.modelName,
    keyMasked: context?.keyMasked
  };
}

export function maskApiKey(key: string, index?: number): string {
  if (!key) return '';
  const trimmed = key.trim();
  const indexPrefix = index !== undefined ? `#${index + 1} ` : '';
  if (trimmed.length <= 8) return `${indexPrefix}••••${trimmed.slice(-3)}`;
  return `${indexPrefix}••••${trimmed.slice(-4)}`;
}
