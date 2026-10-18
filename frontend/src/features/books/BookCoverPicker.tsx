import { Button } from 'antd';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';

/** Chỉ đọc ảnh ở máy để xem trước; file được upload cùng lần lưu sách. */
export function BookCoverPicker({ value, existingUrl, disabled, error, onChange }: {
  value: File | null;
  existingUrl?: string | null;
  disabled: boolean;
  error?: string | null;
  onChange: (file: File | null, error: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!value) return;
    const reader = new FileReader();
    let current = true;
    reader.onload = () => {
      if (current && typeof reader.result === 'string') setPreview({ file: value, url: reader.result });
    };
    reader.readAsDataURL(value);
    return () => {
      current = false;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [value]);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      onChange(null, 'Chỉ chấp nhận ảnh JPEG hoặc PNG.');
    } else if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      onChange(null, 'Ảnh phải có dung lượng lớn hơn 0 và không quá 5 MiB.');
    } else {
      onChange(file, null);
    }
    event.target.value = '';
  };

  const previewUrl = value && preview?.file === value ? preview.url : existingUrl;
  return <div className="book-cover-picker">
    {previewUrl && <img className="book-cover-preview" src={previewUrl} alt="Ảnh bìa xem trước" />}
    <div>
      <input ref={inputRef} id="book-cover-file" type="file" accept="image/jpeg,image/png" aria-label="Chọn ảnh bìa" disabled={disabled} onChange={selectFile} />
      <p className="book-cover-hint">JPEG hoặc PNG, tối đa 5 MiB. Ảnh được tải lên khi lưu sách.</p>
      {(value || error) && <Button type="text" disabled={disabled} onClick={() => onChange(null, null)}>Bỏ ảnh đã chọn</Button>}
    </div>
  </div>;
}
