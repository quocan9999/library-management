package sparkminds.librarymanagement.loan.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.util.List;
import java.util.Optional;
import java.util.Collection;
import java.time.LocalDate;
import org.springframework.data.domain.Pageable;

public interface LoanItemRepository extends JpaRepository<LoanItem, Integer> {
    // Lấy toàn bộ sách thuộc một phiếu mượn.
    List<LoanItem> findByLoanId(Integer loanId);

    // Tìm một sách cụ thể trong một phiếu mượn.
    Optional<LoanItem> findByLoanIdAndBookId(Integer loanId, Integer bookId);

    // Kiểm tra sách đã tồn tại trong phiếu mượn hay chưa.
    boolean existsByLoanIdAndBookId(Integer loanId, Integer bookId);

    boolean existsByBookId(Integer bookId);

    long countByBookIdAndStatus(Integer bookId, LoanItemStatus status);

    long countByLoanMemberIdAndStatusIn(Integer memberId, Collection<LoanItemStatus> statuses);

    boolean existsByLoanMemberIdAndBookIdInAndStatusIn(Integer memberId, Collection<Integer> bookIds,
                                                     Collection<LoanItemStatus> statuses);

    boolean existsByLoanMemberIdAndStatusAndDueDateBefore(Integer memberId, LoanItemStatus status, LocalDate date);

    @Query("select count(item) > 0 from LoanItem item where item.loan.member.id = :memberId and item.lateFee > 0 and item.lateFeePaidAt is null")
    boolean hasUnpaidLateFee(@Param("memberId") Integer memberId);

    @Query("select item.id from LoanItem item where item.status = :status and item.pickupExpiresAt <= :now order by item.pickupExpiresAt, item.id")
    List<Integer> findExpiredPickupIds(@Param("status") LoanItemStatus status,
                                       @Param("now") java.time.LocalDateTime now, Pageable page);


    @Query("select item from LoanItem item join fetch item.book where item.loan.id = :loanId order by item.id")
    List<LoanItem> findWithBookByLoanId(@Param("loanId") Integer loanId);

    @Query("select item from LoanItem item join fetch item.book where item.loan.id in :loanIds order by item.loan.id, item.id")
    List<LoanItem> findWithBookByLoanIdIn(@Param("loanIds") Collection<Integer> loanIds);

    boolean existsByIdAndLoanId(Integer itemId, Integer loanId);

    List<LoanItem> findByLoanIdIn(Collection<Integer> loanIds);

    List<LoanItem> findByBookIdAndStatusOrderByWaitlistedAtAscIdAsc(Integer bookId, LoanItemStatus status, Pageable page);

    /** Đếm cả trang sách trong một query để catalog không truy vấn queue riêng cho từng hàng. */
    @Query("""
            select item.book.id as bookId, count(item) as waitingCount from LoanItem item
            where item.book.id in :bookIds and item.status = :status group by item.book.id
            """)
    List<BookStatusCount> countByBooksAndStatus(@Param("bookIds") Collection<Integer> bookIds,
                                               @Param("status") LoanItemStatus status);

    interface BookStatusCount {
        Integer getBookId();
        long getWaitingCount();
    }
}
