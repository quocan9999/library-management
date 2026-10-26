package sparkminds.librarymanagement.loan.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class LoanStatusCalculatorTests {

    @ParameterizedTest
    @CsvSource({
            "BORROWED|RETURNED, PARTIALLY_RETURNED",
            "BORROWED|RESERVED, ACTIVE",
            "BORROWED|CANCELLED, ACTIVE",
            "RETURNED|READY_FOR_PICKUP, PARTIALLY_RETURNED",
            "RESERVED|PREPARING|READY_FOR_PICKUP, OPEN",
            "RETURNED|CANCELLED|EXPIRED, RETURNED",
            "CANCELLED|EXPIRED|REJECTED, CLOSED"
    })
    void derivesStatusFromItemsInsteadOfLoanDates(String itemStatuses, String expectedStatus) {
        var statuses = Arrays.stream(itemStatuses.split("\\|"))
                .map(LoanItemStatus::valueOf).toList();

        assertThat(LoanStatusCalculator.calculate(statuses)).isEqualTo(LoanStatus.valueOf(expectedStatus));
    }
}
