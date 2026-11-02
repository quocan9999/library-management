package sparkminds.librarymanagement.loan.service;

import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.util.Collection;

/**
 * Tính toán trạng thái tổng hợp của đơn mượn (Loan) dựa trên trạng thái của các sách thành phần (LoanItem).
 * Hỗ trợ trạng thái LOST: sách bị mất được xem như đã hoàn tất nghĩa vụ mượn (đã xử lý tịch thu cọc).
 */
public final class LoanStatusCalculator {

    private LoanStatusCalculator() {
    }

    /**
     * Tổng hợp trạng thái để hiển thị; từng LoanItem vẫn quyết định tồn kho và điều kiện nhận sách.
     * Item đã trả (RETURNED) hoặc đã báo mất (LOST) được xem là hoàn tất xử lý.
     */
    public static LoanStatus calculate(Collection<LoanItemStatus> statuses) {
        boolean borrowed = statuses.contains(LoanItemStatus.BORROWED);
        boolean completed = statuses.contains(LoanItemStatus.RETURNED) || statuses.contains(LoanItemStatus.LOST);
        boolean pending = statuses.stream().anyMatch(LoanItemStatus::isPending);

        if (borrowed) {
            return completed ? LoanStatus.PARTIALLY_RETURNED : LoanStatus.ACTIVE;
        }
        if (pending) {
            return completed ? LoanStatus.PARTIALLY_RETURNED : LoanStatus.OPEN;
        }
        return completed ? LoanStatus.RETURNED : LoanStatus.CLOSED;
    }
}
