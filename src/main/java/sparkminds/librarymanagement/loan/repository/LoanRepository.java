package sparkminds.librarymanagement.loan.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.loan.entity.Loan;

import java.util.Optional;

public interface LoanRepository extends JpaRepository<Loan, Integer> {
    // Tìm phiếu mượn theo mã phiếu mượn duy nhất.
    Optional<Loan> findByLoanCode(String loanCode);

    // Kiểm tra mã phiếu mượn đã tồn tại hay chưa.
    boolean existsByLoanCode(String loanCode);
}
