package sparkminds.librarymanagement.member.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.member.entity.Member;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Integer> {

    // Tìm thông tin thành viên theo ID của tài khoản liên kết.
    Optional<Member> findByAccountId(Integer accountId);

    // Tìm thành viên theo mã thành viên duy nhất.
    Optional<Member> findByMemberCode(String memberCode);

    // Kiểm tra mã thành viên đã tồn tại hay chưa.
    boolean existsByMemberCode(String memberCode);

    boolean existsByPhoneAndIdNot(String phone, Integer id);
}
