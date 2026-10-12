import { Alert, Button, Descriptions, Pagination, Spin, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { memberApi } from './api';
import type { HistoryStatus, LoanHistoryItem, MemberDetail, PageResponse } from './types';

const PAGE_SIZE = 10;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : '—';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—';
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 2,
  }).format(value);
}

function itemStatusLabel(status: LoanHistoryItem['itemStatus']): string {
  return status === 'BORROWED' ? 'Đang mượn' : 'Đã trả';
}

function loanStatusLabel(status: LoanHistoryItem['loanStatus']): string {
  const labels = {
    ACTIVE: 'Phiếu đang mở',
    PARTIALLY_RETURNED: 'Phiếu trả một phần',
    RETURNED: 'Phiếu đã đóng',
  } as const;
  return labels[status];
}

export function MemberDetailPage() {
  const { id: rawId } = useParams();
  const memberId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;
  const [memberReload, setMemberReload] = useState(0);
  const [historyReload, setHistoryReload] = useState(0);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [memberRequest, setMemberRequest] = useState<{
    key: string;
    status: 'success';
    data: MemberDetail;
  } | { key: string; status: 'error' } | null>(null);
  const [historyRequest, setHistoryRequest] = useState<{
    key: string;
    status: 'success';
    data: PageResponse<LoanHistoryItem>;
  } | { key: string; status: 'error' } | null>(null);

  const validMemberId = Number.isSafeInteger(memberId) && memberId > 0;
  const memberRequestKey = `${memberId}:${memberReload}`;
  const historyRequestKey = `${memberId}:${historyStatus}:${historyPage}:${historyReload}`;
  const currentMemberRequest = memberRequest?.key === memberRequestKey ? memberRequest : null;
  const currentHistoryRequest = historyRequest?.key === historyRequestKey ? historyRequest : null;
  const member = currentMemberRequest?.status === 'success' ? currentMemberRequest.data : null;
  const memberLoading = validMemberId && currentMemberRequest === null;
  const memberError = !validMemberId || currentMemberRequest?.status === 'error';
  const history = currentHistoryRequest?.status === 'success' ? currentHistoryRequest.data : null;
  const historyLoading = validMemberId && currentHistoryRequest === null;
  const historyError = validMemberId && currentHistoryRequest?.status === 'error';

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    if (!validMemberId) return () => controller.abort();
    void memberApi.getMember(memberId, controller.signal)
      .then((data) => {
        if (current) setMemberRequest({ key: memberRequestKey, status: 'success', data });
      })
      .catch(() => {
        if (current) setMemberRequest({ key: memberRequestKey, status: 'error' });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [memberId, memberReload, memberRequestKey, validMemberId]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    if (!validMemberId) return () => controller.abort();
    void memberApi.getLoanHistory(memberId, {
      status: historyStatus,
      page: historyPage - 1,
      size: PAGE_SIZE,
    }, controller.signal)
      .then((data) => {
        if (current) setHistoryRequest({ key: historyRequestKey, status: 'success', data });
      })
      .catch(() => {
        if (current) setHistoryRequest({ key: historyRequestKey, status: 'error' });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [memberId, historyStatus, historyPage, historyReload, historyRequestKey, validMemberId]);

  const historyColumns: TableColumnsType<LoanHistoryItem> = [
    { title: 'Sách', key: 'book', render: (_value, item) => <span><strong>{item.bookTitle}</strong><br />{item.bookCode} · {item.bookAuthor}{item.isbn ? ` · ISBN ${item.isbn}` : ''}</span> },
    { title: 'Mã phiếu', dataIndex: 'loanCode', key: 'loanCode', render: (value: string) => <span>{value}</span> },
    { title: 'Trạng thái sách', dataIndex: 'itemStatus', key: 'itemStatus', render: (status: LoanHistoryItem['itemStatus']) => <Tag color={status === 'BORROWED' ? 'blue' : 'green'}>{itemStatusLabel(status)}</Tag> },
    { title: 'Trạng thái phiếu', dataIndex: 'loanStatus', key: 'loanStatus', render: (status: LoanHistoryItem['loanStatus']) => <Tag>{loanStatusLabel(status)}</Tag> },
    { title: 'Ngày mượn', dataIndex: 'borrowedAt', key: 'borrowedAt', render: formatDateTime },
    { title: 'Hạn trả', dataIndex: 'dueDate', key: 'dueDate', render: formatDate },
    { title: 'Ngày trả', dataIndex: 'returnedAt', key: 'returnedAt', render: formatDateTime },
    { title: 'Phí mượn', dataIndex: 'borrowFee', key: 'borrowFee', align: 'right', render: formatMoney },
    { title: 'Phí trễ/ngày', dataIndex: 'lateFeePerDay', key: 'lateFeePerDay', align: 'right', render: formatMoney },
    { title: 'Phí trễ', dataIndex: 'lateFee', key: 'lateFee', align: 'right', render: formatMoney },
    { title: 'Tổng phí ghi nhận', dataIndex: 'recordedTotalFee', key: 'recordedTotalFee', align: 'right', render: formatMoney },
  ];

  return (
    <main className="role-stage member-stage">
      <section className="role-workspace member-workspace" aria-labelledby="member-detail-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">HỒ SƠ THÀNH VIÊN</p>
            <h1 id="member-detail-title">Thông tin thành viên</h1>
            <p className="role-intro">Hồ sơ và lược sử mượn/trả sách ở chế độ chỉ xem.</p>
          </div>
          <Link className="member-back-link" to="/admin/members">Quay lại danh sách</Link>
        </div>

        {memberLoading && <div className="member-loading" role="status"><Spin /> Đang tải hồ sơ thành viên…</div>}
        {memberError && <Alert
          type="error"
          showIcon
          role="alert"
          title="Không thể tải thông tin thành viên."
          action={<Button onClick={() => setMemberReload((previous) => previous + 1)}>Thử lại</Button>}
        />}
        {member && <section className="member-detail-card" aria-label="Hồ sơ thành viên">
          <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Mã thành viên">{member.memberCode}</Descriptions.Item>
            <Descriptions.Item label="Họ và tên">{member.fullName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">{member.email || '—'}</Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{member.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ngày sinh">{formatDate(member.dateOfBirth)}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">{member.address || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">{member.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</Descriptions.Item>
            <Descriptions.Item label="Tài khoản">{member.enabled ? 'Đang hoạt động' : 'Đã khóa'}</Descriptions.Item>
            <Descriptions.Item label="Sách đang mượn">{member.borrowedItemCount}</Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{formatDateTime(member.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật lần cuối">{formatDateTime(member.updatedAt)}</Descriptions.Item>
          </Descriptions>
        </section>}

        <section className="member-history" aria-labelledby="member-history-title">
          <div className="member-history__heading">
            <div>
              <p className="role-eyebrow">LƯỢC SỬ</p>
              <h2 id="member-history-title">Lịch sử mượn/trả sách</h2>
            </div>
            <label className="member-history__status-filter" htmlFor="member-history-status">
              <span>Lọc trạng thái sách</span>
              <select
                id="member-history-status"
                value={historyStatus}
                onChange={(event) => {
                  const status = event.target.value as HistoryStatus;
                  setHistoryStatus(status);
                  setHistoryPage(1);
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="BORROWED">Đang mượn</option>
                <option value="RETURNED">Đã trả</option>
              </select>
            </label>
          </div>
          {historyError && <Alert
            className="member-alert"
            type="error"
            showIcon
            role="alert"
            title="Không thể tải lịch sử mượn/trả sách."
            action={<Button onClick={() => setHistoryReload((previous) => previous + 1)}>Thử lại</Button>}
          />}
          <div className="member-table-wrap" aria-busy={historyLoading}>
            <Table<LoanHistoryItem>
              rowKey="loanItemId"
              columns={historyColumns}
              dataSource={history?.content ?? []}
              pagination={false}
              loading={historyLoading ? { indicator: <Spin aria-label="Đang tải lịch sử" /> } : false}
              locale={{ emptyText: historyError ? 'Không thể tải lịch sử. Hãy thử lại.' : 'Chưa có lịch sử mượn/trả sách' }}
            />
          </div>
          {history && history.totalElements > 0 && <div className="member-pagination-row">
            <span role="status">Tổng số {history.totalElements} lần mượn/trả</span>
            <Pagination
              aria-label="Phân trang lịch sử mượn/trả"
              current={historyPage}
              pageSize={PAGE_SIZE}
              total={history.totalElements}
              showSizeChanger={false}
              onChange={setHistoryPage}
            />
          </div>}
        </section>
      </section>
    </main>
  );
}
