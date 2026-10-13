package sparkminds.librarymanagement.member.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MemberLoanHistoryRepository {

    private final JdbcTemplate jdbcTemplate;

    /** Dùng EXISTS để chỉ kiểm tra sự hiện diện; FK vẫn là chốt chặn khi Loan được thêm đồng thời. */
    public boolean existsForMember(Integer memberId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM loans WHERE member_id = ?)", Boolean.class, memberId);
        return Boolean.TRUE.equals(exists);
    }
}
