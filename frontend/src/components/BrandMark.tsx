export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark${compact ? ' brand-mark--compact' : ''}`}>
      <span className="brand-mark__icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="M5.25 7.5c4.27-.75 7.85.07 10.75 2.5v15c-2.9-2.43-6.48-3.25-10.75-2.5v-15Z" />
          <path d="M26.75 7.5C22.48 6.75 18.9 7.57 16 10v15c2.9-2.43 6.48-3.25 10.75-2.5v-15Z" />
          <path d="M16 10v15" />
          <path d="M8.5 12.25c2.04-.08 3.93.29 5.67 1.1M8.5 16c2.04-.08 3.93.29 5.67 1.1M23.5 12.25c-2.04-.08-3.93.29-5.67 1.1M23.5 16c-2.04-.08-3.93.29-5.67 1.1" />
        </svg>
      </span>
      <span className="brand-mark__text">
        <span className="brand-mark__title">Quản lý Thư viện</span>
        {!compact && <span className="brand-mark__subtitle">Mỗi câu chuyện đều có chỗ riêng</span>}
      </span>
    </div>
  );
}
