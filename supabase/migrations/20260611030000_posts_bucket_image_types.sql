-- ============================================================================
-- Broaden the posts bucket's allowed image types: add AVIF/BMP/TIFF, which
-- uploaded fine before server-side limits existed (20260611000000). SVG stays
-- intentionally blocked (it can carry script → stored-XSS in a public bucket).
-- Idempotent: sets the full allow-list.
-- ============================================================================
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv'
    ]
where id = 'posts';
