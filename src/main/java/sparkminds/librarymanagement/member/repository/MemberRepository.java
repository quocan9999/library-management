package sparkminds.librarymanagement.member.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import sparkminds.librarymanagement.member.entity.Member;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface MemberRepository extends JpaRepository<Member, Integer> {

    // Tìm thông tin thành viên theo ID của tài khoản liên kết.
    Optional<Member> findByAccountId(Integer accountId);

    // Tìm thành viên theo mã thành viên duy nhất.
    Optional<Member> findByMemberCode(String memberCode);

    // Kiểm tra mã thành viên đã tồn tại hay chưa.
    boolean existsByMemberCode(String memberCode);

    boolean existsByPhoneAndIdNot(String phone, Integer id);

    boolean existsByPhone(String phone);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select member from Member member where member.account.id = :accountId")
    Optional<Member> findByAccountIdForUpdate(@Param("accountId") Integer accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select member from Member member where member.id = :memberId")
    Optional<Member> findByIdForUpdate(@Param("memberId") Integer memberId);

    @Query("""
            select member from Member member join member.account account join account.role role
            where account.enabled = true and account.emailVerified = true and role.enabled = true and role.code = 'USER'
              and (:search = '' or lower(member.memberCode) like :pattern escape '!'
                or lower(coalesce(member.fullName, '')) like :pattern escape '!')
            """)
    Page<Member> searchEligibleForCounter(@Param("search") String search, @Param("pattern") String pattern,
                                          Pageable pageable);
}
