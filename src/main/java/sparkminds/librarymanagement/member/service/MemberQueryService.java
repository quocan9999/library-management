package sparkminds.librarymanagement.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.PagedResponse;
import sparkminds.librarymanagement.member.dto.LoanHistoryItemResponse;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.dto.MemberListItemResponse;
import sparkminds.librarymanagement.member.repository.MemberReadRepository;
import sparkminds.librarymanagement.member.service.MemberSearchCriteria.LoanItemStatusFilter;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MemberQueryService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final Set<String> SORT_FIELDS = Set.of("createdAt", "memberCode", "fullName", "dateOfBirth");
    private static final Map<String, String> SORT_DIRECTIONS = Map.of("asc", "ASC", "desc", "DESC");

    private final MemberReadRepository memberReadRepository;

    public PagedResponse<MemberListItemResponse> searchMembers(
            String fullName,
            String memberCode,
            String email,
            String phone,
            String birthFrom,
            String birthTo,
            String book,
            String borrowStatus,
            String emailVerified,
            String enabled,
            String page,
            String size,
            String sort
    ) {
        MemberSearchCriteria criteria = new MemberSearchCriteria(
                optionalText(fullName),
                optionalText(memberCode),
                optionalText(email),
                normalizePhone(phone),
                parseDate(birthFrom, "birthFrom"),
                parseDate(birthTo, "birthTo"),
                optionalText(book),
                parseStatus(borrowStatus, "borrowStatus"),
                parseBoolean(emailVerified, "emailVerified"),
                parseBoolean(enabled, "enabled"),
                parsePage(page),
                parseSize(size),
                parseSortField(sort),
                parseSortDirection(sort)
        );
        if (criteria.birthFrom() != null && criteria.birthTo() != null
                && criteria.birthFrom().isAfter(criteria.birthTo())) {
            throw invalid("birthFrom phải nhỏ hơn hoặc bằng birthTo");
        }
        return memberReadRepository.search(criteria);
    }

    public MemberDetailResponse getMember(Integer memberId) {
        requirePositiveId(memberId);
        return memberReadRepository.findDetailById(memberId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên"));
    }

    public PagedResponse<LoanHistoryItemResponse> getLoanHistory(
            Integer memberId,
            String status,
            String page,
            String size
    ) {
        requirePositiveId(memberId);
        LoanItemStatusFilter itemStatus = parseStatus(status, "status");
        int pageNumber = parsePage(page);
        int pageSize = parseSize(size);
        if (!memberReadRepository.existsMember(memberId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên");
        }
        return memberReadRepository.findLoanHistory(memberId, itemStatus, pageNumber, pageSize);
    }

    private static String optionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizePhone(String value) {
        String text = optionalText(value);
        if (text == null) {
            return null;
        }
        String digits = text.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            throw invalid("phone phải có ít nhất một chữ số");
        }
        return digits;
    }

    private static LocalDate parseDate(String value, String field) {
        String text = optionalText(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException exception) {
            throw invalid(field + " phải có định dạng yyyy-MM-dd");
        }
    }

    private static Boolean parseBoolean(String value, String field) {
        String text = optionalText(value);
        if (text == null) {
            return null;
        }
        if ("true".equalsIgnoreCase(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text)) {
            return false;
        }
        throw invalid(field + " chỉ nhận true hoặc false");
    }

    private static LoanItemStatusFilter parseStatus(String value, String field) {
        String text = optionalText(value);
        if (text == null) {
            return LoanItemStatusFilter.ALL;
        }
        try {
            return LoanItemStatusFilter.valueOf(text.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw invalid(field + " chỉ nhận ALL, BORROWED hoặc RETURNED");
        }
    }

    private static int parsePage(String value) {
        int page = parseInteger(value, 0, "page");
        if (page < 0) {
            throw invalid("page không được âm");
        }
        return page;
    }

    private static int parseSize(String value) {
        int size = parseInteger(value, DEFAULT_PAGE_SIZE, "size");
        if (size < 1 || size > DEFAULT_PAGE_SIZE) {
            throw invalid("size phải nằm trong khoảng 1 đến 10");
        }
        return size;
    }

    private static int parseInteger(String value, int defaultValue, String field) {
        String text = optionalText(value);
        if (text == null) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException exception) {
            throw invalid(field + " phải là số nguyên");
        }
    }

    private static String parseSortField(String sort) {
        String[] parts = sortParts(sort);
        if (!SORT_FIELDS.contains(parts[0])) {
            throw invalid("sort field không được hỗ trợ");
        }
        return parts[0];
    }

    private static String parseSortDirection(String sort) {
        String[] parts = sortParts(sort);
        String direction = SORT_DIRECTIONS.get(parts[1].toLowerCase(Locale.ROOT));
        if (direction == null) {
            throw invalid("sort direction chỉ nhận asc hoặc desc");
        }
        return direction;
    }

    private static String[] sortParts(String sort) {
        if (optionalText(sort) == null) {
            return new String[]{"createdAt", "desc"};
        }
        String[] parts = sort.split(",", -1);
        if (parts.length != 2) {
            throw invalid("sort phải theo dạng field,asc|desc");
        }
        parts[0] = parts[0].trim();
        parts[1] = parts[1].trim();
        return parts;
    }

    private static void requirePositiveId(Integer memberId) {
        if (memberId == null || memberId < 1) {
            throw invalid("id thành viên phải là số nguyên dương");
        }
    }

    private static BusinessException invalid(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_MEMBER_QUERY", message);
    }
}
