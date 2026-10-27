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
    String STAFF_SEARCH_WHERE = """
             where (:allStatuses = true or exists (
               select item.id from LoanItem item where item.loan.id = loan.id and item.status in :statuses))
             and loan.paymentStatus <> sparkminds.librarymanagement.loan.entity.LoanPaymentStatus.PENDING
             and (:search = '' or loan.pickupReference = :search
               or lower(loan.loanCode) like :pattern escape '!'
               or lower(member.memberCode) like :pattern escape '!'
               or lower(member.fullName) like :pattern escape '!'
               or exists (select li.id from LoanItem li where li.loan.id = loan.id and lower(li.book.bookCode) like :pattern escape '!'))
            """;

    /** Lọc trước phân trang; đếm toàn bộ sách của yêu cầu, không chỉ sách khớp trạng thái. */
    @Query(value = """
            select loan, (select count(bookItem.id) from LoanItem bookItem where bookItem.loan.id = loan.id) as itemCount
            from Loan loan join fetch loan.member member
            """ + STAFF_SEARCH_WHERE,
            countQuery = "select count(loan.id) from Loan loan join loan.member member " + STAFF_SEARCH_WHERE)
    Page<Object[]> searchStaffRequests(@Param("allStatuses") boolean allStatuses,
            @Param("statuses") Collection<LoanItemStatus> statuses, @Param("search") String search,
            @Param("pattern") String pattern, Pageable page);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "member")
    Optional<Loan> findByPickupReference(String pickupReference);

    @Query("select loan.id from Loan loan where loan.paymentStatus = :status and loan.paymentExpiresAt <= :now order by loan.paymentExpiresAt, loan.id")
    java.util.List<Integer> findExpiredPaymentIds(
            @Param("status") sparkminds.librarymanagement.loan.entity.LoanPaymentStatus status,
            @Param("now") LocalDateTime now, Pageable page);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select loan from Loan loan where loan.id = :loanId")
    Optional<Loan> findByIdForUpdate(@Param("loanId") Integer loanId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "member")
    @Query("""
            select loan from Loan loan where loan.paymentStatus <> sparkminds.librarymanagement.loan.entity.LoanPaymentStatus.PENDING
              and (:allStatuses = true or exists (
                select item.id from LoanItem item where item.loan.id = loan.id and item.status in :statuses))
            """)
    Page<Loan> findStaffRequests(@Param("allStatuses") boolean allStatuses,
                                 @Param("statuses") Collection<LoanItemStatus> statuses, Pageable page);

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
