import { Button, Select } from 'antd';
import { STAFF_DESK_FILTERS, type StaffDeskFilter } from './staffBorrowPresentation';
import { LibrarianBorrowLookup } from './LibrarianBorrowLookup';

interface LibrarianBorrowRequestFiltersProps {
  value: StaffDeskFilter;
  onChange: (filter: StaffDeskFilter) => void;
  lookupValue: string;
  lookupLoading: boolean;
  onLookupChange: (value: string) => void;
  onLookup: () => void;
  onClear: () => void;
}

export function LibrarianBorrowRequestFilters({
  value, onChange, lookupValue, lookupLoading, onLookupChange, onLookup, onClear,
}: LibrarianBorrowRequestFiltersProps) {
  return <section className="member-filter-panel librarian-borrow-search" aria-label="Bộ lọc yêu cầu mượn">
    <div className="member-filter-grid librarian-borrow-filter-grid">
      <LibrarianBorrowLookup
        value={lookupValue}
        loading={lookupLoading}
        onChange={onLookupChange}
        onSearch={onLookup}
      />
      <div className="member-filter-field">
        <label htmlFor="borrow-request-status">Trạng thái xử lý sách</label>
        <Select<StaffDeskFilter>
          id="borrow-request-status"
          value={value}
          onChange={onChange}
          options={STAFF_DESK_FILTERS.map(({ key, label }) => ({ value: key, label }))}
        />
        <span className="librarian-borrow-filter-hint">Lọc yêu cầu có sách thuộc trạng thái đã chọn.</span>
      </div>
    </div>
    <div className="member-filter-actions">
      <Button onClick={onClear}>Xóa tất cả bộ lọc</Button>
    </div>
  </section>;
}
