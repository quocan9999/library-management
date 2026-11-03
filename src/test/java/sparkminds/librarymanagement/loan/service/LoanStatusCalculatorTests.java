package sparkminds.librarymanagement.loan.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kiểm thử đơn vị cho thuật toán tổng hợp trạng thái đơn mượn (LoanStatusCalculator).
 * Đảm bảo các trạng thái thành phần kể cả LOST được tổng hợp chính xác.
 */
class LoanStatusCalculatorTests {

    @ParameterizedTest
    @CsvSource({
            "BORROWED|RETURNED, PARTIALLY_RETURNED",
            "BORROWED|LOST, PARTIALLY_RETURNED",
            "BORROWED|RESERVED, ACTIVE",
            "BORROWED|CANCELLED, ACTIVE",
            "RETURNED|READY_FOR_PICKUP, PARTIALLY_RETURNED",
            "LOST|READY_FOR_PICKUP, PARTIALLY_RETURNED",
            "RESERVED|PREPARING|READY_FOR_PICKUP, OPEN",
            "RETURNED|CANCELLED|EXPIRED, RETURNED",
            "LOST|CANCELLED|EXPIRED, RETURNED",
            "LOST|RETURNED, RETURNED",
            "LOST, RETURNED",
            "CANCELLED|EXPIRED|REJECTED, CLOSED"
    })
    void derivesStatusFromItemsInsteadOfLoanDates(String itemStatuses, String expectedStatus) {
        var statuses = Arrays.stream(itemStatuses.split("\\|"))
                .map(LoanItemStatus::valueOf).toList();

        assertThat(LoanStatusCalculator.calculate(statuses)).isEqualTo(LoanStatus.valueOf(expectedStatus));
    }
}
