import { Button, Input } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef } from 'react';

interface LibrarianBorrowLookupProps {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export function LibrarianBorrowLookup({ value, loading, onChange, onSearch }: LibrarianBorrowLookupProps) {
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return <div className="member-filter-field librarian-borrow-lookup">
    <label htmlFor="borrow-pickup-reference">Tìm yêu cầu mượn</label>
    <div className="librarian-borrow-lookup__controls">
    <Input
      id="borrow-pickup-reference"
      ref={inputRef}
      aria-label="Tìm theo QR, mã yêu cầu, mã hoặc họ tên thành viên"
      placeholder="QR, mã yêu cầu, mã hoặc họ tên thành viên"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onPressEnter={(event) => { if (!event.nativeEvent.isComposing) onSearch(); }}
      maxLength={200}
      allowClear
    />
    <Button type="primary" loading={loading} onClick={onSearch}>Tra cứu</Button>
    </div>
  </div>;
}
