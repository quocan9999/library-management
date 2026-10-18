import { Alert, DatePicker, Form, Input, InputNumber, Modal } from 'antd';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { useState, type ChangeEvent } from 'react';
import type { ApiEnvelope } from '../../auth/types';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { bookApi } from './api';
import { BookCoverPicker } from './BookCoverPicker';
import { formatVndInput, isValidIsbn, parseVndInput } from './formatting';
import type { BookDetail, BookUpdateInput, BookWriteInput } from './types';

interface BookFormValues {
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  publishedDate: Dayjs | null;
  totalQuantity: number | null;
  borrowFee: string;
  lateFeePerDay: string;
}

function toFormValues(book?: BookDetail): BookFormValues {
  return {
    title: book?.title ?? '',
    author: book?.author ?? '',
    isbn: book?.isbn ?? '',
    publisher: book?.publisher ?? '',
    publishedDate: book?.publishedDate ? dayjs(book.publishedDate) : null,
    totalQuantity: book?.totalQuantity ?? 0,
    borrowFee: formatVndInput(book?.borrowFee ?? 0),
    lateFeePerDay: formatVndInput(book?.lateFeePerDay ?? 0),
  };
}

function responseBody(error: unknown): ApiEnvelope<unknown> | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  return error.response?.data ?? null;
}

function errorMessage(error: unknown): string {
  const body = responseBody(error);
  switch (body?.code) {
    case 'BOOK_ISBN_DUPLICATED': return 'ISBN này đã được sử dụng cho một sách khác.';
    case 'BOOK_NOT_FOUND': return 'Sách không còn tồn tại. Hãy tải lại danh sách.';
    case 'BOOK_COVER_STORAGE_UNAVAILABLE': return 'Chưa thể tải ảnh bìa lên. Vui lòng kiểm tra cấu hình Cloudinary hoặc thử lại sau.';
    case 'BOOK_COVER_UPLOAD_FAILED': return 'Tải ảnh bìa thất bại. Sách chưa được lưu; hãy thử lại.';
    case 'BOOK_COVER_TOO_LARGE': return 'Ảnh bìa không được vượt quá 5 MiB.';
    case 'BOOK_VALIDATION_ERROR':
    case 'VALIDATION_ERROR': return 'Thông tin chưa hợp lệ. Hãy kiểm tra các trường được đánh dấu.';
    default: return 'Không thể lưu thông tin sách lúc này. Hãy thử lại.';
  }
}

function buildInput(values: BookFormValues): BookWriteInput {
  const borrowFee = parseVndInput(values.borrowFee);
  const lateFeePerDay = parseVndInput(values.lateFeePerDay);
  if (borrowFee === null || lateFeePerDay === null) {
    throw new Error('Phí phải được validation thành công trước khi tạo request.');
  }
  return {
    title: values.title.trim(),
    author: values.author.trim(),
    isbn: values.isbn.trim() || null,
    publisher: values.publisher.trim() || null,
    publishedDate: values.publishedDate?.format('YYYY-MM-DD') ?? null,
    totalQuantity: values.totalQuantity ?? 0,
    borrowFee,
    lateFeePerDay,
  };
}

async function validateFeeInput(_: unknown, value?: string) {
  if (value && parseVndInput(value) === null) {
    throw new Error('Nhập số tiền không âm, tối đa 2 chữ số thập phân sau dấu phẩy.');
  }
}

export function BookFormModal({
  book,
  onCancel,
  onSaved,
  onBookReloaded,
}: {
  book?: BookDetail;
  onCancel: () => void;
  onSaved: (book: BookDetail) => void;
  onBookReloaded?: (book: BookDetail) => void;
}) {
  const [form] = Form.useForm<BookFormValues>();
  const { notify } = useAppNotification();
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [similarConfirmation, setSimilarConfirmation] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);

  const reloadLatest = async () => {
    if (!book) return;
    setReloadError(null);
    try {
      const latest = await bookApi.getBook(book.id);
      form.setFieldsValue(toFormValues(latest));
      setConflict(false);
      setSimilarConfirmation(false);
      onBookReloaded?.(latest);
    } catch {
      setReloadError('Không thể tải dữ liệu mới nhất. Các nội dung đang nhập vẫn được giữ lại.');
    }
  };

  const submit = async (values: BookFormValues) => {
    if (coverError || saving) return;
    setSaving(true);
    setConflict(false);
    setReloadError(null);
    try {
      const input = buildInput(values);
      const saved = book
        ? await bookApi.updateBook(book.id, { ...input, version: book.version } satisfies BookUpdateInput, coverFile)
        : await bookApi.createBook({ ...input, confirmSimilar: similarConfirmation }, coverFile);
      notify('success', {
        title: book ? 'Cập nhật sách thành công' : 'Tạo sách thành công',
        description: `${saved.bookCode} · ${saved.title}`,
      });
      onSaved(saved);
      onCancel();
    } catch (error: unknown) {
      const body = responseBody(error);
      if (body?.code === 'SIMILAR_BOOK_CONFIRMATION_REQUIRED' && !book) {
        setSimilarConfirmation(true);
        return;
      }
      if (body?.code === 'BOOK_VERSION_CONFLICT') {
        setConflict(true);
        return;
      }
      const fieldErrors = body?.errors ?? {};
      if (fieldErrors.cover) {
        setCoverError(fieldErrors.cover);
        return;
      }
      const mapped = (['title', 'author', 'isbn', 'publisher', 'publishedDate', 'totalQuantity', 'borrowFee', 'lateFeePerDay'] as const)
        .flatMap((field) => fieldErrors[field] ? [{ name: field, errors: [fieldErrors[field]] }] : []);
      if (mapped.length > 0) {
        form.setFields(mapped);
        return;
      }
      setReloadError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!saving) onCancel();
  };

  return (
    <Form<BookFormValues>
      form={form}
      layout="vertical"
      initialValues={toFormValues(book)}
      onValuesChange={(changed: Partial<BookFormValues>) => {
        if (changed.title !== undefined || changed.author !== undefined) setSimilarConfirmation(false);
      }}
      onFinish={submit}
      requiredMark="optional"
    >
      <Modal
        open
        title={book ? `Chỉnh sửa sách · ${book.bookCode}` : 'Thêm sách mới'}
        okText={book ? 'Lưu thay đổi' : 'Thêm sách'}
        cancelText="Hủy"
        confirmLoading={saving}
        onCancel={cancel}
        onOk={() => form.submit()}
        destroyOnHidden
        width={680}
      >
        {conflict && <Alert
          className="book-alert"
          type="warning"
          showIcon
          role="alert"
          title="Sách đã được Admin khác cập nhật."
          description="Tải bản mới nhất để tiếp tục. Thao tác này sẽ thay thế dữ liệu đang hiển thị trong biểu mẫu."
          action={<button className="book-alert-action" type="button" onClick={() => void reloadLatest()}>Tải dữ liệu mới</button>}
        />}
        {reloadError && <Alert className="book-alert" type="error" showIcon role="alert" title={reloadError} />}
        {similarConfirmation && <Alert
          className="book-alert"
          type="warning"
          showIcon
          role="status"
          title="Đã có sách cùng tên và tác giả chưa có ISBN."
          description="Kiểm tra thông tin trùng trước khi tiếp tục tạo sách thủ công."
          closable
          onClose={() => setSimilarConfirmation(false)}
        />}
        {book && <Form.Item label="Mã sách">
          <Input value={book.bookCode} readOnly aria-label="Mã sách" />
        </Form.Item>}
        <Form.Item label="Ảnh bìa" htmlFor="book-cover-file" validateStatus={coverError ? 'error' : undefined} help={coverError}>
          <BookCoverPicker value={coverFile} existingUrl={book?.coverImageUrl} disabled={saving} error={coverError} onChange={(file, error) => { setCoverFile(file); setCoverError(error); }} />
        </Form.Item>
        <Form.Item
          label="Tên sách"
          name="title"
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập tên sách.' },
            { max: 255, message: 'Tên sách không được vượt quá 255 ký tự.' },
          ]}
        >
          <Input maxLength={255} aria-label="Tên sách" />
        </Form.Item>
        <Form.Item
          label="Tác giả"
          name="author"
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập tác giả.' },
            { max: 150, message: 'Tác giả không được vượt quá 150 ký tự.' },
          ]}
        >
          <Input maxLength={150} aria-label="Tác giả" />
        </Form.Item>
        <div className="book-form-grid">
          <Form.Item
            label="ISBN"
            name="isbn"
            rules={[
              { max: 20, message: 'ISBN không được vượt quá 20 ký tự.' },
              { validator: async (_, value: string) => {
                if (!isValidIsbn(value ?? '')) throw new Error('ISBN-10 hoặc ISBN-13 không hợp lệ.');
              } },
            ]}
          >
            <Input maxLength={20} aria-label="ISBN" />
          </Form.Item>
          <Form.Item label="Nhà xuất bản" name="publisher" rules={[{ max: 150, message: 'Nhà xuất bản không được vượt quá 150 ký tự.' }]}>
            <Input maxLength={150} aria-label="Nhà xuất bản" />
          </Form.Item>
          <Form.Item label="Ngày xuất bản" name="publishedDate">
            <DatePicker format="DD/MM/YYYY" placeholder="Chọn ngày" aria-label="Ngày xuất bản" />
          </Form.Item>
          <Form.Item
            label="Tổng số lượng"
            name="totalQuantity"
            rules={[{ required: true, type: 'number', min: 0, message: 'Số lượng phải từ 0 trở lên.' }]}
          >
            <InputNumber min={0} max={2147483647} precision={0} aria-label="Tổng số lượng" />
          </Form.Item>
          <Form.Item
            label="Phí mượn (VND)"
            name="borrowFee"
            getValueFromEvent={(event: ChangeEvent<HTMLInputElement>) => formatVndInput(event.target.value)}
            rules={[{ required: true, message: 'Phí mượn phải từ 0 VND trở lên.' }, { validator: validateFeeInput }]}
          >
            <Input inputMode="decimal" aria-label="Phí mượn (VND)" />
          </Form.Item>
          <Form.Item
            label="Phí trễ mỗi ngày (VND)"
            name="lateFeePerDay"
            getValueFromEvent={(event: ChangeEvent<HTMLInputElement>) => formatVndInput(event.target.value)}
            rules={[{ required: true, message: 'Phí trễ phải từ 0 VND trở lên.' }, { validator: validateFeeInput }]}
          >
            <Input inputMode="decimal" aria-label="Phí trễ mỗi ngày (VND)" />
          </Form.Item>
        </div>
      </Modal>
    </Form>
  );
}
