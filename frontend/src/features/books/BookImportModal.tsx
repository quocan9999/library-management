import { Alert, Button, Modal, Space, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import type { ApiEnvelope } from '../../auth/types';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { bookApi } from './api';
import type { BookImportError, BookImportReport } from './types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function precheck(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Chỉ nhận file có đuôi .csv.';
  if (file.size === 0) return 'File CSV đang rỗng.';
  if (file.size >= MAX_FILE_BYTES) return 'File phải nhỏ hơn 5 MiB.';
  return null;
}

function responseBody(error: unknown): ApiEnvelope<unknown> | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  return error.response?.data ?? null;
}

function importErrorMessage(error: unknown): string {
  const body = responseBody(error);
  switch (body?.code) {
    case 'BOOK_IMPORT_FILE_TOO_LARGE': return 'File phải nhỏ hơn 5 MiB.';
    case 'INVALID_BOOK_IMPORT_HEADER': return 'Header CSV không đúng mẫu quản lý sách (cần có title, author, total_quantity, borrow_fee, price, late_fee_per_day).';
    case 'INVALID_BOOK_IMPORT_ENCODING': return 'File phải được mã hóa UTF-8 hợp lệ.';
    case 'INVALID_BOOK_IMPORT_CSV': return 'Nội dung CSV không hợp lệ hoặc không đọc được.';
    case 'EMPTY_BOOK_IMPORT_FILE': return 'File CSV không có dòng dữ liệu.';
    default: return 'Không thể xử lý file CSV lúc này. Hãy thử lại.';
  }
}

function exportFailedRowsToCsv(errors: BookImportError[]) {
  const headers = ['title', 'author', 'total_quantity', 'borrow_fee', 'price', 'late_fee_per_day', 'isbn', 'publisher', 'published_date'];
  const escapeCsv = (val?: string) => {
    if (val === undefined || val === null) return '';
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = errors.map((err) => {
    const data = err.rowData || {};
    return headers.map((h) => escapeCsv(data[h] ?? '')).join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sach_loi_import_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadTemplateCsv() {
  const headers = ['title', 'author', 'total_quantity', 'borrow_fee', 'price', 'late_fee_per_day', 'isbn', 'publisher', 'published_date'];
  const sampleRow = ['Clean Code', 'Robert C. Martin', '5', '10000', '150000', '2000', '9780132350884', 'Prentice Hall', '2008-08-01'];
  const csvContent = '\uFEFF' + [headers.join(','), sampleRow.join(',')].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mau_nhap_sach.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const columns: TableColumnsType<BookImportError> = [
  { title: 'Dòng', dataIndex: 'rowNumber', key: 'rowNumber', width: 75 },
  { title: 'Trường', dataIndex: 'field', key: 'field', width: 140, render: (value: string) => value || '—' },
  { title: 'Lý do', dataIndex: 'message', key: 'message' },
];

export function BookImportModal({ onCancel, onImported }: { onCancel: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useAppNotification();
  const [file, setFile] = useState<File | null>(null);
  const [precheckError, setPrecheckError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [report, setReport] = useState<BookImportReport | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectFile = (selected: File | null) => {
    setReport(null);
    setRequestError(null);
    setFile(selected);
    setPrecheckError(selected ? precheck(selected) : null);
  };

  const submit = async () => {
    if (!file || precheckError || submitting) return;
    setSubmitting(true);
    setRequestError(null);
    try {
      const result = await bookApi.importBooks(file);
      setReport(result);
      if (result.importedRows > 0) {
        onImported();
        notify('success', {
          title: 'Đã xử lý file CSV',
          description: `${result.importedRows} sách được nhập, ${result.failedRows} dòng lỗi.`,
        });
      }
    } catch (error: unknown) {
      setRequestError(importErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const resetFile = () => {
    setFile(null);
    setReport(null);
    setPrecheckError(null);
    setRequestError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const similarErrors = report?.errors.filter((error) => error.code === 'SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION') ?? [];

  return (
    <Modal
      open
      title="Nhập sách từ CSV"
      okText={report ? 'Đóng báo cáo' : 'Nhập CSV'}
      cancelText="Hủy"
      confirmLoading={submitting}
      okButtonProps={{ disabled: !report && (!file || Boolean(precheckError)) }}
      onCancel={() => { if (!submitting) onCancel(); }}
      onOk={() => { if (report) onCancel(); else void submit(); }}
      width={760}
      destroyOnHidden
    >
      {!report && <>
        <p>
          Chọn file UTF-8 CSV theo mẫu import sách. Tối đa 5 MiB; mỗi dòng được xử lý độc lập.
          <br />
          <strong>Lưu ý:</strong> Bắt buộc có cột <code>price</code> (giá gốc sách). Dòng nào có giá bằng 0đ hoặc thiếu giá sẽ bị từ chối nhập.
        </p>
        <div style={{ marginBottom: 16 }}>
          <Button type="link" onClick={downloadTemplateCsv} style={{ padding: 0 }}>
            Tải file mẫu CSV chuẩn (mau_nhap_sach.csv)
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Chọn file CSV"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
        {file && <p role="status" style={{ marginTop: 8 }}>Đã chọn: {file.name} · {(file.size / 1024).toFixed(1)} KiB</p>}
        {precheckError && <Alert className="book-alert" type="error" showIcon role="alert" title={precheckError} />}
        {requestError && <Alert className="book-alert" type="error" showIcon role="alert" title={requestError} />}
      </>}

      {report && <section aria-label="Kết quả nhập CSV">
        <Alert
          className="book-alert"
          type={report.failedRows > 0 ? (report.importedRows > 0 ? 'warning' : 'error') : 'success'}
          showIcon
          role="status"
          title={`${report.importedRows} sách được nhập`}
          description={`${report.failedRows} dòng lỗi trên tổng ${report.totalRows} dòng dữ liệu.`}
        />
        {similarErrors.length > 0 && <Alert
          className="book-alert"
          type="info"
          showIcon
          title="Một số dòng cần được xác nhận thủ công"
          description="Hãy tạo từng sách từ biểu mẫu để kiểm tra sách cùng tên và tác giả trước khi xác nhận. Các dòng này không được tự bỏ qua trong batch."
        />}
        {report.errors.length > 0 && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
            <span style={{ fontWeight: 600 }}>Danh sách dòng lỗi ({report.failedRows}):</span>
            <Button
              type="primary"
              size="small"
              onClick={() => exportFailedRowsToCsv(report.errors)}
            >
              Xuất file CSV các dòng lỗi (.csv)
            </Button>
          </div>
          <Table<BookImportError>
            aria-label="Các dòng CSV bị lỗi"
            rowKey={(error) => `${error.rowNumber}-${error.field}-${error.code}`}
            columns={columns}
            dataSource={report.errors}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            size="small"
          />
        </>}
        {report.omittedErrorCount > 0 && <p role="status">Còn {report.omittedErrorCount} lỗi khác không hiển thị trong báo cáo này.</p>}
        <Space style={{ marginTop: 16 }}>
          <Button onClick={resetFile}>Chọn file khác</Button>
          {report.errors.length > 0 && (
            <Button onClick={() => exportFailedRowsToCsv(report.errors)}>
              Tải lại file CSV dòng lỗi
            </Button>
          )}
        </Space>
      </section>}
    </Modal>
  );
}
