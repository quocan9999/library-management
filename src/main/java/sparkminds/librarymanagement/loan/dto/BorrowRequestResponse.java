package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanStatus;
import sparkminds.librarymanagement.loan.entity.LoanPaymentMethod;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record BorrowRequestResponse(String loanCode, String pickupReference, LoanStatus status, Instant createdAt,
                                    long version, LoanPaymentStatus paymentStatus, LoanPaymentMethod paymentMethod,
                                    BigDecimal paymentAmount, Instant paymentExpiresAt, Instant paidAt,
                                    List<BorrowItemResponse> items) {
}
