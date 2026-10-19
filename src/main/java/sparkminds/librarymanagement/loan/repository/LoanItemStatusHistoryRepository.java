package sparkminds.librarymanagement.loan.repository;

import org.springframework.data.repository.Repository;
import sparkminds.librarymanagement.loan.entity.LoanItemStatusHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Chỉ cung cấp ghi thêm sự kiện; không mở API xóa lịch sử nghiệp vụ. */
public interface LoanItemStatusHistoryRepository extends Repository<LoanItemStatusHistory, Long> {
    LoanItemStatusHistory save(LoanItemStatusHistory history);

    Page<LoanItemStatusHistory> findByLoanItemId(Integer loanItemId, Pageable page);

    Page<LoanItemStatusHistory> findByLoanItemLoanId(Integer loanId, Pageable page);
}
