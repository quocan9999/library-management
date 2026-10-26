import { Alert, Button, Empty, Input, List, Modal, Select, Skeleton, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { formatVnd } from '../books/formatting';
import { borrowApi, MAX_BORROW_BOOKS } from './api';
import { borrowErrorMessage, borrowErrorNotificationType } from './errors';
import type { CatalogBook, CounterMemberOption, PageResponse, StaffBorrowRequest } from './types';

interface LibrarianCounterBorrowRequestModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (request: StaffBorrowRequest) => void;
}

export function LibrarianCounterBorrowRequestModal({ open, onClose, onCreated }: LibrarianCounterBorrowRequestModalProps) {
  const { notify } = useAppNotification();
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<CounterMemberOption[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CounterMemberOption | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState('');
  const [selectedBooks, setSelectedBooks] = useState<CatalogBook[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const submitLock = useRef(false);
  const totalFee = useMemo(() => selectedBooks.reduce((total, book) => total + book.borrowFee, 0), [selectedBooks]);

  useEffect(() => {
    if (!open) return;
    setMemberQuery('');
    setMembers([]);
    setSelectedMember(null);
    setBookQuery('');
    setSelectedBooks([]);
    setBooksError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = bookQuery.trim();
    if (query.length < 2) {
      setBooks([]);
      setBooksError('');
      setBooksLoading(false);
      return;
    }
    setBooksLoading(true);
    setBooksError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void borrowApi.listCatalog({
        q: query,
        page: 0, size: 10, sort: 'title,asc',
      }, controller.signal)
        .then((result: PageResponse<CatalogBook>) => {
          if (!controller.signal.aborted) setBooks(result.content);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setBooksError(borrowErrorMessage(error, 'read'));
        })
        .finally(() => { if (!controller.signal.aborted) setBooksLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [bookQuery, open, reloadKey]);

  useEffect(() => {
    if (!open || memberQuery.trim().length < 2) {
      setMembers([]);
      setMemberLoading(false);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      setMemberLoading(true);
      void borrowApi.searchCounterMembers(memberQuery.trim())
        .then((result) => { if (current) setMembers(result); })
        .catch((error: unknown) => {
          if (current) notify(borrowErrorNotificationType(error), {
            title: 'Không thể tìm thành viên', description: borrowErrorMessage(error, 'read'),
          });
        })
        .finally(() => { if (current) setMemberLoading(false); });
    }, 300);
    return () => { current = false; window.clearTimeout(timer); };
  }, [memberQuery, notify, open]);

  const addBook = (book: CatalogBook) => {
    if (book.availableQuantity < 1
      || selectedBooks.length >= MAX_BORROW_BOOKS || selectedBooks.some((item) => item.id === book.id)) return;
    setSelectedBooks((current) => {
      if (current.length >= MAX_BORROW_BOOKS || current.some((item) => item.id === book.id)) return current;
      return [...current, book];
    });
    setBookQuery('');
    setBooks([]);
    setBooksError('');
    setBooksLoading(false);
  };

  const removeBook = (bookId: number) => {
    setSelectedBooks((current) => current.filter((book) => book.id !== bookId));
  };

  const submit = async () => {
    if (!selectedMember || selectedBooks.length === 0 || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const request = await borrowApi.createCounterRequest(selectedMember.id, selectedBooks.map((book) => book.id));
      notify('success', {
        title: `Đã tạo yêu cầu ${request.loanCode}`,
        description: 'Yêu cầu đã được lưu. Nếu đóng chi tiết, thủ thư có thể tìm lại theo mã yêu cầu hoặc tên thành viên.',
      });
      onCreated(request);
    } catch (error: unknown) {
      notify(borrowErrorNotificationType(error), {
        title: 'Không thể tạo yêu cầu tại quầy',
        description: borrowErrorMessage(error, 'create'),
      });
      setReloadKey((key) => key + 1);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return <Modal
    open={open}
    centered
    width={820}
    title="Tạo yêu cầu mượn tại quầy"
    okText="Tạo yêu cầu và mở chi tiết"
    cancelText="Đóng"
    confirmLoading={submitting}
    okButtonProps={{ disabled: !selectedMember || selectedBooks.length === 0 }}
    onCancel={() => { if (!submitting) onClose(); }}
    onOk={() => { void submit(); }}
  >
    <div className="librarian-counter-create">
      <Alert showIcon type="info" title="Yêu cầu được lưu ngay khi tạo. Có thể đóng chi tiết và tìm lại trong danh sách để tiếp tục chuẩn bị, thu phí tại quầy và bàn giao." />
      <label htmlFor="counter-member-search">Thành viên</label>
      <Select
        id="counter-member-search"
        showSearch
        allowClear
        filterOption={false}
        loading={memberLoading}
        value={selectedMember?.id}
        placeholder="Tìm theo mã thành viên hoặc họ tên (ít nhất 2 ký tự)"
        searchValue={memberQuery}
        onSearch={(value) => {
          setMemberQuery(value);
          if (value.trim()) setSelectedMember(null);
        }}
        onClear={() => { setMemberQuery(''); setSelectedMember(null); }}
        onChange={(id) => {
          if (id == null) {
            setSelectedMember(null);
            return;
          }
          const member = members.find((candidate) => candidate.id === id);
          if (member) {
            setSelectedMember(member);
            setMemberQuery('');
          }
        }}
        options={[
          ...(selectedMember && !members.some((member) => member.id === selectedMember.id) ? [selectedMember] : []),
          ...members,
        ].map((member) => ({ value: member.id, label: `${member.fullName} · ${member.memberCode}` }))}
        notFoundContent={memberQuery.trim().length < 2 ? 'Nhập ít nhất 2 ký tự để tìm.' : 'Không tìm thấy thành viên phù hợp.'}
      />

      <div className="librarian-counter-create__book-heading">
        <label htmlFor="counter-book-search">Tìm sách</label>
        <Typography.Text type="secondary">Chọn tối đa {MAX_BORROW_BOOKS} đầu sách</Typography.Text>
      </div>
      <Input.Search
        id="counter-book-search"
        allowClear
        placeholder="Nhập mã sách, tên sách, ISBN hoặc tác giả để tìm"
        value={bookQuery}
        onChange={(event) => setBookQuery(event.target.value)}
        onSearch={setBookQuery}
      />
      {booksError && <Alert type="error" showIcon title={booksError}
        action={<Button onClick={() => setReloadKey((key) => key + 1)}>Tải lại</Button>} />}
      {booksLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : bookQuery.trim().length >= 2 && <div className="librarian-counter-create__search-results">
        <Typography.Text type="secondary">Kết quả tìm kiếm</Typography.Text>
        <List
          dataSource={books}
          locale={{ emptyText: <Empty description="Không tìm thấy sách phù hợp với từ khóa." /> }}
          renderItem={(book) => {
            const selected = selectedBooks.some((item) => item.id === book.id);
            return <List.Item key={book.id}>
              <span className="librarian-counter-create__book">
                <Typography.Text strong>{book.title}</Typography.Text>
                <Typography.Text type="secondary">{book.bookCode} · {book.author}</Typography.Text>
              </span>
              <span className="librarian-counter-create__book-meta">
                {book.availableQuantity < 1 ? <Typography.Text type="danger">Hết bản sẵn</Typography.Text>
                  : <Typography.Text type="secondary">Còn {book.availableQuantity} bản</Typography.Text>}
                <Typography.Text strong>{formatVnd(book.borrowFee)}/cuốn</Typography.Text>
              </span>
              <Button
                type={selected ? 'default' : 'primary'}
                disabled={selected || book.availableQuantity < 1 || selectedBooks.length >= MAX_BORROW_BOOKS}
                onClick={() => addBook(book)}
              >{selected ? 'Đã chọn' : 'Chọn'}</Button>
            </List.Item>;
          }}
        />
      </div>}
      <div className="librarian-counter-create__selected-heading">
        <Typography.Text strong>Sách đã chọn</Typography.Text>
        <Typography.Text type="secondary">{selectedBooks.length}/{MAX_BORROW_BOOKS}</Typography.Text>
      </div>
      <div className="librarian-counter-create__book-list">
        <List
          dataSource={selectedBooks}
          locale={{ emptyText: <Empty description="Chưa chọn sách nào." /> }}
          renderItem={(book) => <List.Item key={book.id}>
            <span className="librarian-counter-create__book">
              <Typography.Text strong>{book.title}</Typography.Text>
              <Typography.Text type="secondary">{book.bookCode} · {book.author}</Typography.Text>
            </span>
            <span className="librarian-counter-create__book-meta">
              <Typography.Text type="secondary">Còn {book.availableQuantity} bản</Typography.Text>
              <Typography.Text strong>{formatVnd(book.borrowFee)}/cuốn</Typography.Text>
            </span>
            <Button danger type="text" onClick={() => removeBook(book.id)}>Bỏ</Button>
          </List.Item>}
        />
      </div>
      <div className="librarian-counter-create__summary">
        <Typography.Text>{selectedBooks.length}/{MAX_BORROW_BOOKS} đầu sách đã chọn</Typography.Text>
        <Typography.Text strong>Tổng phí dự kiến {formatVnd(totalFee)}</Typography.Text>
      </div>
    </div>
  </Modal>;
}
