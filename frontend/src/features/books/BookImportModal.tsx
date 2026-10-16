import { Alert, Button, Modal, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
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
    case 'INVALID_BOOK_IMPORT_HEADER': return 'Header CSV không đúng mẫu quản lý sách.';
    case 'INVALID_BOOK_IMPORT_ENCODING': return 'File phải được mã hóa UTF-8 hợp lệ.';
    case 'INVALID_BOOK_IMPORT_CSV': return 'Nội dung CSV không hợp lệ hoặc không đọc được.';
    case 'EMPTY_BOOK_IMPORT_FILE': return 'File CSV không có dòng dữ liệu.';
    default: return 'Không thể xử lý file CSV lúc này. Hãy thử lại.';
  }
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
        <p>Chọn file UTF-8 CSV theo mẫu import sách. Tối đa 5 MiB; mỗi dòng được xử lý độc lập.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Chọn file CSV"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
        {file && <p role="status">Đã chọn: {file.name} · {(file.size / 1024).toFixed(1)} KiB</p>}
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
        {report.errors.length > 0 && <Table<BookImportError>
          aria-label="Các dòng CSV bị lỗi"
          rowKey={(error) => `${error.rowNumber}-${error.field}-${error.code}`}
          columns={columns}
          dataSource={report.errors}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="small"
        />}
        {report.omittedErrorCount > 0 && <p role="status">Còn {report.omittedErrorCount} lỗi khác không hiển thị trong báo cáo này.</p>}
        <Button onClick={resetFile}>Chọn file khác</Button>
      </section>}
    </Modal>
  );
}
