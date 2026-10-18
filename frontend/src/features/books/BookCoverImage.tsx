import { useState } from 'react';

export function BookCoverImage({ url, title, large = false }: { url?: string | null; title: string; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const className = large ? 'book-cover-image book-cover-image-large' : 'book-cover-image';
  return url && failedUrl !== url
    ? <img className={className} src={url} alt={`Bìa ${title}`} loading="lazy" onError={() => setFailedUrl(url)} />
    : <span className={`${className} book-cover-empty`} aria-label="Chưa có ảnh bìa">—</span>;
}
