package sparkminds.librarymanagement.loan.service;

import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.util.Collection;

public final class LoanStatusCalculator {

    private LoanStatusCalculator() {
    }

    /**
     * Tổng hợp trạng thái để hiển thị; từng LoanItem vẫn quyết định tồn kho và điều kiện nhận sách.
     * Item đã trả phải được giữ trong kết quả ngay cả khi các item khác còn chờ chuẩn bị.
     */
    public static LoanStatus calculate(Collection<LoanItemStatus> statuses) {
        boolean borrowed = statuses.contains(LoanItemStatus.BORROWED);
        boolean returned = statuses.contains(LoanItemStatus.RETURNED);
        boolean pending = statuses.stream().anyMatch(LoanItemStatus::isPending);
        if (borrowed) {
            return returned ? LoanStatus.PARTIALLY_RETURNED : LoanStatus.ACTIVE;
        }
        if (pending) {
            return returned ? LoanStatus.PARTIALLY_RETURNED : LoanStatus.OPEN;
        }
        return returned ? LoanStatus.RETURNED : LoanStatus.CLOSED;
    }
}
