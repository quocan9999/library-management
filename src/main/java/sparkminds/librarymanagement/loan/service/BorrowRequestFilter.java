package sparkminds.librarymanagement.loan.service;

import org.springframework.http.HttpStatus;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.util.List;
import java.util.Locale;

/** Nhóm tab là filter, không phải trạng thái được lưu vào LoanItem. */
public enum BorrowRequestFilter {
    ALL, PENDING, HISTORY, RESERVED, PREPARING, READY_FOR_PICKUP,
    BORROWED, RETURNED, CANCELLED, EXPIRED, REJECTED;

    public List<LoanItemStatus> statuses() {
        return switch (this) {
            case ALL -> List.of(LoanItemStatus.values());
            case PENDING -> List.of(LoanItemStatus.RESERVED, LoanItemStatus.PREPARING);
            case HISTORY -> List.of(LoanItemStatus.RETURNED, LoanItemStatus.CANCELLED,
                    LoanItemStatus.EXPIRED, LoanItemStatus.REJECTED);
            default -> List.of(LoanItemStatus.valueOf(name()));
        };
    }

    public static BorrowRequestFilter parse(String input) {
        if (input == null || input.isBlank()) return ALL;
        try {
            return valueOf(input.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_PARAMETER",
                    "Bộ lọc trạng thái không hợp lệ");
        }
    }
}
