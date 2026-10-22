package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.CounterMemberOptionResponse;
import sparkminds.librarymanagement.member.repository.MemberRepository;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StaffCounterBorrowService {
    private final StaffBorrowLockService staffLocks;
    private final MemberRepository memberRepository;

    public List<CounterMemberOptionResponse> searchMembers(Integer actorId, String query) {
        staffLocks.actor(actorId, "borrow:prepare");
        String search = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (search.length() < 2) return List.of();
        if (search.length() > 100) throw invalidSearch();
        String pattern = "%" + search.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        return memberRepository.searchEligibleForCounter(search, pattern,
                        PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "memberCode")))
                .map(member -> new CounterMemberOptionResponse(member.getId(), member.getMemberCode(),
                        member.getFullName() == null || member.getFullName().isBlank()
                                ? "Chưa cập nhật họ tên" : member.getFullName().trim()))
                .getContent();
    }

    private BusinessException invalidSearch() {
        return new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_PARAMETER",
                "Từ khóa tìm thành viên không hợp lệ");
    }
}
