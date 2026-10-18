package sparkminds.librarymanagement.loan.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.loan.entity.LoanItem;

import java.util.List;
import java.util.Optional;

public interface LoanItemRepository extends JpaRepository<LoanItem, Integer> {
    // Lấy toàn bộ sách thuộc một phiếu mượn.
    List<LoanItem> findByLoanId(Integer loanId);

    // Tìm một sách cụ thể trong một phiếu mượn.
    Optional<LoanItem> findByLoanIdAndBookId(Integer loanId, Integer bookId);

    // Kiểm tra sách đã tồn tại trong phiếu mượn hay chưa.
    boolean existsByLoanIdAndBookId(Integer loanId, Integer bookId);

    boolean existsByBookId(Integer bookId);
}
