import { Alert, Button, Descriptions, Modal, Spin } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePermission } from '../../auth/permissions';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { BookFormModal } from './BookFormModal';
import { bookApi } from './api';
import { formatVnd } from './formatting';
import type { BookDetail } from './types';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = dayjs(value);
  return date.isValid() ? date.format('DD/MM/YYYY') : '—';
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = dayjs(value);
  return date.isValid() ? date.format('DD/MM/YYYY HH:mm') : '—';
}

export function BookDetailPage() {
  const { id } = useParams();
  const bookId = Number(id);
  const validBookId = Number.isSafeInteger(bookId) && bookId > 0;
  const canUpdate = usePermission('book:update');
  const canDelete = usePermission('book:delete');
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const [request, setRequest] = useState<{ key: number; state: 'loading' | 'success' | 'error'; data?: BookDetail }>({ key: 0, state: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!validBookId) return undefined;
    const controller = new AbortController();
    let current = true;
    void bookApi.getBook(bookId, controller.signal)
      .then((book) => {
        if (current) setRequest({ key: reloadKey, state: 'success', data: book });
      })
      .catch(() => {
        if (current) setRequest({ key: reloadKey, state: 'error' });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [bookId, reloadKey, validBookId]);

  const book = request.key === reloadKey && request.state === 'success' ? request.data : undefined;
  const loading = validBookId && (request.key !== reloadKey || request.state === 'loading');
  const failed = !validBookId || (request.key === reloadKey && request.state === 'error');

  const deleteCurrentBook = async () => {
    if (!book || deletePending) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await bookApi.deleteBook(book.id);
      notify('success', {
        title: 'Đã xóa sách',
        description: `${book.bookCode} · ${book.title}`,
      });
      navigate('/admin/books', { replace: true });
    } catch (error: unknown) {
      const code = axios.isAxiosError(error) ? error.response?.data?.code : undefined;
      if (code === 'BOOK_HAS_LOAN_HISTORY') {
        setDeleteOpen(false);
        setDeleteNotice('Không thể xóa sách đã có lịch sử mượn. Thông tin sách vẫn được giữ nguyên.');
      } else {
        setDeleteError('Không thể xóa sách lúc này. Sách vẫn được giữ nguyên; hãy thử lại.');
      }
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <main className="role-stage member-stage">
      <section className="role-workspace member-workspace book-workspace" aria-labelledby="book-detail-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">HỒ SƠ KHO SÁCH</p>
            <h1 id="book-detail-title">Thông tin sách</h1>
            <p className="role-intro">Chi tiết xuất bản, số lượng và mức phí áp dụng.</p>
          </div>
          <div className="member-detail-actions">
            {book && canUpdate && <Button onClick={() => setEditing(true)}>Chỉnh sửa</Button>}
            {book && canDelete && <Button danger onClick={() => { setDeleteError(null); setDeleteNotice(null); setDeleteOpen(true); }}>Xóa sách</Button>}
            <Link className="member-back-link" to="/admin/books">Quay lại danh sách</Link>
          </div>
        </div>

        {deleteNotice && <Alert className="book-alert" type="warning" showIcon role="status" title={deleteNotice} closable onClose={() => setDeleteNotice(null)} />}
        {loading && <div className="member-loading" role="status"><Spin /> Đang tải thông tin sách…</div>}
        {failed && <Alert
          className="book-alert"
          type="error"
          showIcon
          role="alert"
          title={validBookId ? 'Không thể tải thông tin sách.' : 'Mã sách không hợp lệ.'}
          action={validBookId ? <Button onClick={() => setReloadKey((key) => key + 1)}>Thử lại</Button> : undefined}
        />}
        {book && <section className="member-detail-card" aria-label="Thông tin sách">
          <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Mã sách">{book.bookCode}</Descriptions.Item>
            <Descriptions.Item label="Tên sách">{book.title}</Descriptions.Item>
            <Descriptions.Item label="Tác giả">{book.author}</Descriptions.Item>
            <Descriptions.Item label="ISBN">{book.isbn || '—'}</Descriptions.Item>
            <Descriptions.Item label="Nhà xuất bản">{book.publisher || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ngày xuất bản">{formatDate(book.publishedDate)}</Descriptions.Item>
            <Descriptions.Item label="Sẵn có / Tổng">{book.availableQuantity} / {book.totalQuantity}</Descriptions.Item>
            <Descriptions.Item label="Phí mượn">{formatVnd(book.borrowFee)}</Descriptions.Item>
            <Descriptions.Item label="Phí trễ mỗi ngày">{formatVnd(book.lateFeePerDay)}</Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{formatDateTime(book.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật lần cuối">{formatDateTime(book.updatedAt)}</Descriptions.Item>
          </Descriptions>
        </section>}

        {book && editing && <BookFormModal
          key={`${book.id}-${book.version}`}
          book={book}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => setRequest({ key: reloadKey, state: 'success', data: updated })}
          onBookReloaded={(latest) => setRequest({ key: reloadKey, state: 'success', data: latest })}
        />}

        <Modal
          open={deleteOpen}
          title="Xác nhận xóa sách"
          okText="Xóa sách"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          confirmLoading={deletePending}
          onCancel={() => { if (!deletePending) setDeleteOpen(false); }}
          onOk={() => void deleteCurrentBook()}
        >
          {book && <>
            <p>Bạn có chắc muốn xóa {book.bookCode} · {book.title}?</p>
            <p>Sách có lịch sử mượn sẽ được giữ nguyên và thao tác bị từ chối.</p>
            {deleteError && <Alert className="book-alert" type="error" showIcon role="alert" title={deleteError} />}
          </>}
        </Modal>
      </section>
    </main>
  );
}
