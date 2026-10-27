import axios from 'axios';
import type { ApiEnvelope } from '../../auth/types';

interface ApiErrorData {
  code?: string;
  message?: string;
}

export function borrowErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export function borrowErrorCode(error: unknown): string | undefined {
  return axios.isAxiosError<ApiEnvelope<unknown>>(error) ? error.response?.data?.code : undefined;
}

export function borrowErrorNotificationType(error: unknown): 'warning' | 'error' {
  const status = borrowErrorStatus(error);
  const code = borrowErrorCode(error);
  return status === 409 || ['BORROW_FEE_MISMATCH', 'BORROW_INVALID_HANDOVER_SET', 'BORROW_VERSION_CONFLICT'].includes(code ?? '')
    ? 'warning'
    : 'error';
}

export function borrowErrorMessage(error: unknown, action: 'read' | 'create' | 'update' = 'update'): string {
  if (!axios.isAxiosError<ApiEnvelope<unknown> & ApiErrorData>(error)) {
    return 'Không thể hoàn tất thao tác. Hãy thử lại sau.';
  }

  const status = error.response?.status;
  const code = error.response?.data?.code;
  if (status === 503 && code === 'MAINTENANCE_MODE_ACTIVE') {
    return 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.';
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || !error.response) {
    return action === 'create'
      ? 'Chưa xác nhận được kết quả. Hãy tải danh sách yêu cầu trước khi gửi lại để tránh tạo trùng.'
      : 'Kết nối bị gián đoạn. Hãy tải lại trạng thái trước khi tiếp tục.';
  }
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403 && code === 'AUTH_ACCOUNT_DISABLED') return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.';
  if (code === 'BORROW_ACCOUNT_INELIGIBLE') return 'Tài khoản thành viên chưa đủ điều kiện tạo hoặc nhận yêu cầu mượn.';
  if (status === 403) return 'Tài khoản hiện không có quyền xem hoặc thực hiện thao tác này.';
  if (code === 'BORROW_ACTIVE_LIMIT_EXCEEDED') return 'Mỗi thành viên chỉ được có tối đa 3 đầu sách đang hoạt động.';
  if (code === 'BORROW_OUTSTANDING_OBLIGATION') return 'Bạn đang có sách quá hạn chưa giải quyết nên chưa thể đặt mượn.';
  if (code === 'BORROW_DUPLICATE_ACTIVE_BOOK') return 'Đầu sách này đã có trong một yêu cầu đang hoạt động.';
  if (code === 'BORROW_BOOK_OUT_OF_STOCK') return error.response?.data?.message || 'Sách đã hết bản sẵn có để mượn.';
  if (status === 404) return 'Không tìm thấy sách hoặc yêu cầu bằng mã đã nhập.';
  if (code === 'BORROW_PICKUP_EXPIRED') return 'Thời hạn nhận sách đã hết. Hãy tải lại để xem trạng thái mới.';
  if (status === 409 || code === 'BORROW_VERSION_CONFLICT' || code === 'BORROW_INVALID_HANDOVER_SET') {
    return action === 'create'
      ? 'Tình trạng sách hoặc yêu cầu đã thay đổi. Hãy tải lại danh mục và kiểm tra danh sách yêu cầu.'
      : 'Yêu cầu đã thay đổi ở nơi khác. Danh sách đã được tải lại; hãy kiểm tra trạng thái mới.';
  }
  if (code === 'BORROW_FEE_MISMATCH') return 'Số phí xác nhận không khớp phí đã chốt. Hãy tải lại và xác nhận lại các sách sẵn sàng nhận.';
  if (code === 'BORROW_RENEWAL_NOT_ALLOWED') return 'Sách chưa ở trong thời gian gia hạn hoặc đã được gia hạn một lần.';
  if (status === 422) return 'Thông tin gửi lên chưa hợp lệ. Hãy kiểm tra dữ liệu rồi thử lại.';
  if (status && status >= 500) return 'Dịch vụ đang gặp sự cố. Dữ liệu chưa được xác nhận; hãy thử tải lại.';
  if (action === 'read') return 'Không thể tải dữ liệu mượn sách. Hãy thử tải lại.';
  return 'Không thể hoàn tất thao tác. Hãy tải lại trạng thái trước khi thử tiếp.';
}
