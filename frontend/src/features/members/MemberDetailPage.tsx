import { Alert, Button, Descriptions, Modal, Pagination, Spin, Table, Tag } from 'antd';
import axios from 'axios';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePermission } from '../../auth/permissions';
import { useAppNotification } from '../../components/AppNotificationProvider';
import { memberApi } from './api';
import { MemberProfileEditModal } from './MemberProfileEditModal';
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
  const navigate = useNavigate();
  const { notify } = useAppNotification();
  const memberId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;
  const canUpdateProfile = usePermission('member:update');
  const canUpdateAccountStatus = usePermission('member:status:update');
  const canDeleteMember = usePermission('member:delete');
  const [editingProfile, setEditingProfile] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
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

  /** Giữ dialog hiện tại khi lỗi tạm thời; xung đột CAS đóng dialog rồi đọc lại trạng thái mới. */
  const updateAccountStatus = async () => {
    if (!member) return;
    setStatusUpdating(true);
    setStatusActionError(null);
    try {
      await memberApi.updateAccountStatus(member.id, {
        expectedEnabled: member.enabled,
        enabled: !member.enabled,
      });
      notify('success', {
        title: member.enabled ? 'Đã vô hiệu hóa tài khoản' : 'Đã kích hoạt tài khoản',
        description: member.enabled
          ? 'Tài khoản thành viên đã được vô hiệu hóa.'
          : 'Tài khoản thành viên đã được kích hoạt.',
      });
      setStatusDialogOpen(false);
      setStatusNotice(null);
      setMemberReload((previous) => previous + 1);
    } catch (error) {
      if (axios.isAxiosError(error)
        && error.response?.status === 409
        && error.response.data?.code === 'MEMBER_ACCOUNT_STATUS_CONFLICT') {
        setStatusDialogOpen(false);
        setStatusNotice('Trạng thái tài khoản đã thay đổi. Hồ sơ đã được tải lại.');
        setMemberReload((previous) => previous + 1);
      } else {
        setStatusActionError('Không thể cập nhật trạng thái tài khoản lúc này. Hãy thử lại.');
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  const deleteCurrentMember = async () => {
    if (!member) return;
    setDeletePending(true);
    setDeleteError(null);
    setDeleteNotice(null);
    try {
      await memberApi.deleteMember(member.id);
      notify('success', {
        title: 'Xóa thành viên thành công',
        description: 'Thành viên và tài khoản liên kết đã được xóa.',
      });
      navigate('/admin/members', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error)
        && error.response?.status === 409
        && error.response.data?.code === 'MEMBER_HAS_LOAN_HISTORY') {
        setDeleteDialogOpen(false);
        setDeleteNotice('Không thể xóa thành viên có lịch sử mượn sách. Hồ sơ và lịch sử vẫn được giữ nguyên.');
      } else {
        setDeleteError('Không thể xóa thành viên lúc này. Hãy thử lại.');
      }
    } finally {
      setDeletePending(false);
    }
  };

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
            <p className="role-intro">Thông tin hồ sơ và lịch sử mượn/trả sách của thành viên.</p>
          </div>
          <div className="member-detail-actions">
            {member && canUpdateProfile && <Button onClick={() => setEditingProfile(true)}>Chỉnh sửa hồ sơ</Button>}
            {member && canUpdateAccountStatus && <Button
              danger={member.enabled}
              onClick={() => {
                setStatusActionError(null);
                setStatusNotice(null);
                setStatusDialogOpen(true);
              }}
            >{member.enabled ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'}</Button>}
            {member && canDeleteMember && <Button
              danger
              onClick={() => {
                setDeleteError(null);
                setDeleteNotice(null);
                setDeleteDialogOpen(true);
              }}
            >Xóa thành viên</Button>}
            <Link className="member-back-link" to="/admin/members">Quay lại danh sách</Link>
          </div>
        </div>

        {statusNotice && <Alert
          className="member-alert"
          type="warning"
          showIcon
          role="status"
          title={statusNotice}
          closable
          onClose={() => setStatusNotice(null)}
        />}
        {deleteNotice && <Alert
          className="member-alert"
          type="warning"
          showIcon
          role="status"
          title={deleteNotice}
          closable
          onClose={() => setDeleteNotice(null)}
        />}

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
            <Descriptions.Item label="Xác minh email">{member.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</Descriptions.Item>
            <Descriptions.Item label="Tài khoản">{member.enabled ? 'Đang hoạt động' : 'Đã khóa'}</Descriptions.Item>
            <Descriptions.Item label="Sách đang mượn">{member.borrowedItemCount}</Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{formatDateTime(member.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật lần cuối">{formatDateTime(member.updatedAt)}</Descriptions.Item>
          </Descriptions>
        </section>}

        {member && editingProfile && <MemberProfileEditModal
          key={member.id}
          member={member}
          onCancel={() => setEditingProfile(false)}
          onSaved={() => {
            setEditingProfile(false);
            setMemberReload((previous) => previous + 1);
          }}
          onMemberReloaded={(latest) => {
            setMemberRequest({ key: memberRequestKey, status: 'success', data: latest });
          }}
        />}

        {statusDialogOpen && <Modal
          open
          title={member?.enabled ? 'Xác nhận vô hiệu hóa tài khoản' : 'Xác nhận kích hoạt tài khoản'}
          okText={member?.enabled ? 'Vô hiệu hóa' : 'Kích hoạt'}
          cancelText="Hủy"
          okButtonProps={{ danger: member?.enabled }}
          confirmLoading={statusUpdating}
          onCancel={() => {
            if (!statusUpdating) setStatusDialogOpen(false);
          }}
          onOk={updateAccountStatus}
        >
          {member && <>
            <p>{member.enabled
              ? `Bạn xác nhận vô hiệu hóa tài khoản ${member.fullName || member.memberCode} (${member.memberCode})? Tài khoản sẽ không thể đăng nhập sau khi thao tác hoàn tất.`
              : `Bạn xác nhận kích hoạt tài khoản ${member.fullName || member.memberCode} (${member.memberCode})? Các phiên cũ vẫn hết hiệu lực và thành viên cần đăng nhập lại.`}</p>
            {member.enabled && member.borrowedItemCount > 0 && <Alert
              type="warning"
              showIcon
              title={`Đang mượn ${member.borrowedItemCount} cuốn sách chưa trả`}
            />}
            {statusActionError && <Alert className="member-alert" type="error" showIcon title={statusActionError} />}
          </>}
        </Modal>}

        {deleteDialogOpen && <Modal
          open
          title="Xác nhận xóa thành viên"
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          confirmLoading={deletePending}
          onCancel={() => {
            if (!deletePending) setDeleteDialogOpen(false);
          }}
          onOk={deleteCurrentMember}
        >
          {member && <>
            <p>{`Bạn xác nhận xóa ${member.fullName || member.memberCode} (${member.memberCode}) cùng tài khoản đăng nhập và token liên kết? Thao tác này không thể khôi phục.`}</p>
            <p>Thành viên có bất kỳ lịch sử mượn nào sẽ không bị xóa.</p>
            {member.borrowedItemCount > 0 && <Alert
              type="warning"
              showIcon
              title={`Còn ${member.borrowedItemCount} cuốn sách chưa trả; yêu cầu xóa sẽ bị từ chối.`}
            />}
            {deleteError && <Alert className="member-alert" type="error" showIcon role="alert" title={deleteError} />}
          </>}
        </Modal>}

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
