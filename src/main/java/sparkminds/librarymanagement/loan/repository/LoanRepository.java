package sparkminds.librarymanagement.loan.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.util.Optional;
import java.time.LocalDateTime;
import java.util.Collection;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface LoanRepository extends JpaRepository<Loan, Integer> {
    // Tìm phiếu mượn theo mã phiếu mượn duy nhất.
    Optional<Loan> findByLoanCode(String loanCode);

    // Kiểm tra mã phiếu mượn đã tồn tại hay chưa.
    boolean existsByLoanCode(String loanCode);

    @Query("select loan from Loan loan where loan.loanCode = :code and loan.member.account.id = :accountId")
    Optional<Loan> findOwnedByCode(@Param("accountId") Integer accountId, @Param("code") String code);

    /** EXISTS lọc theo item trước pagination, tránh lặp Loan khi nhiều item cùng khớp tab. */
    @Query("""
            select loan from Loan loan where loan.member.account.id = :accountId
              and (:allStatuses = true or exists (
                select item.id from LoanItem item where item.loan.id = loan.id and item.status in :statuses))
            """)
    Page<Loan> findOwnedRequests(@Param("accountId") Integer accountId, @Param("allStatuses") boolean allStatuses,
                                 @Param("statuses") Collection<LoanItemStatus> statuses, Pageable page);

    /** CAS cả aggregate/version để các item khác nhau trong cùng Loan không ghi đè trạng thái của nhau. */
    @Modifying(flushAutomatically = true)
    @Query("""
            update Loan loan set loan.status = :status, loan.version = loan.version + 1, loan.updatedAt = :now
            where loan.id = :loanId and loan.version = :version
            """)
    int updateAggregate(@Param("loanId") Integer loanId, @Param("version") long version,
                        @Param("status") LoanStatus status, @Param("now") LocalDateTime now);
}
