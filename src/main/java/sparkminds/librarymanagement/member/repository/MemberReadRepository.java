package sparkminds.librarymanagement.member.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import sparkminds.librarymanagement.member.dto.LoanHistoryItemResponse;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.dto.MemberListItemResponse;
import sparkminds.librarymanagement.member.dto.PagedResponse;
import sparkminds.librarymanagement.member.service.MemberSearchCriteria;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Truy vấn dạng projection để trang hóa theo bản ghi và không phát sinh truy vấn riêng cho từng Member. */
@Repository
@RequiredArgsConstructor
public class MemberReadRepository {

    private static final String MEMBER_ACCOUNT_FROM = " FROM members m JOIN accounts a ON a.id = m.account_id ";

    private static final RowMapper<MemberListItemResponse> MEMBER_LIST_ROW = (rs, rowNum) ->
            new MemberListItemResponse(
                    rs.getInt("id"),
                    rs.getString("member_code"),
                    rs.getString("full_name"),
                    rs.getString("email"),
                    rs.getString("phone"),
                    rs.getObject("date_of_birth", java.time.LocalDate.class),
                    rs.getObject("created_at", java.time.LocalDateTime.class),
                    rs.getBoolean("email_verified"),
                    rs.getBoolean("enabled")
            );

    private static final RowMapper<MemberDetailResponse> MEMBER_DETAIL_ROW = (rs, rowNum) ->
            new MemberDetailResponse(
                    rs.getInt("id"),
                    rs.getString("member_code"),
                    rs.getString("full_name"),
                    rs.getString("email"),
                    rs.getString("phone"),
                    rs.getObject("date_of_birth", java.time.LocalDate.class),
                    rs.getString("address"),
                    rs.getObject("created_at", java.time.LocalDateTime.class),
                    rs.getObject("updated_at", java.time.LocalDateTime.class),
                    rs.getBoolean("email_verified"),
                    rs.getBoolean("enabled"),
                    rs.getLong("version"),
                    rs.getLong("borrowed_item_count")
            );

    private static final RowMapper<LoanHistoryItemResponse> LOAN_HISTORY_ROW = MemberReadRepository::mapLoanHistory;

    private final JdbcTemplate jdbcTemplate;

    public PagedResponse<MemberListItemResponse> search(MemberSearchCriteria criteria) {
        QueryParts queryParts = memberWhere(criteria);
        String orderBy = sortExpression(criteria.sortColumn()) + " " + criteria.sortDirection()
                + ", m.id DESC";

        List<Object> pageArguments = new ArrayList<>(queryParts.arguments());
        pageArguments.add(criteria.size());
        pageArguments.add((long) criteria.page() * criteria.size());
        List<MemberListItemResponse> content = jdbcTemplate.query(
                "SELECT m.id, m.member_code, m.full_name, a.email, m.phone, m.date_of_birth, "
                        + "m.created_at, a.email_verified, a.enabled"
                        + MEMBER_ACCOUNT_FROM + queryParts.whereClause()
                        + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?",
                MEMBER_LIST_ROW,
                pageArguments.toArray()
        );
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*)" + MEMBER_ACCOUNT_FROM + queryParts.whereClause(),
                Long.class,
                queryParts.arguments().toArray()
        );
        return PagedResponse.of(content, criteria.page(), criteria.size(), total == null ? 0 : total);
    }

    public Optional<MemberDetailResponse> findDetailById(Integer memberId) {
        List<MemberDetailResponse> rows = jdbcTemplate.query("""
                SELECT m.id, m.member_code, m.full_name, a.email, m.phone, m.date_of_birth, m.address,
                       m.created_at, m.updated_at, a.email_verified, a.enabled, m.version,
                       (SELECT COUNT(*)
                        FROM loan_items li
                        JOIN loans l ON l.id = li.loan_id
                        WHERE l.member_id = m.id AND li.status = 'BORROWED') AS borrowed_item_count
                FROM members m
                JOIN accounts a ON a.id = m.account_id
                WHERE m.id = ?
                """, MEMBER_DETAIL_ROW, memberId);
        return rows.stream().findFirst();
    }

    public boolean existsMember(Integer memberId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM members WHERE id = ?)", Boolean.class, memberId);
        return Boolean.TRUE.equals(exists);
    }

    public PagedResponse<LoanHistoryItemResponse> findLoanHistory(
            Integer memberId,
            MemberSearchCriteria.LoanItemStatusFilter status,
            int page,
            int size
    ) {
        String statusClause = status == MemberSearchCriteria.LoanItemStatusFilter.ALL
                ? "" : " AND li.status = ?";
        List<Object> countArguments = new ArrayList<>();
        countArguments.add(memberId);
        if (!statusClause.isEmpty()) {
            countArguments.add(status.name());
        }
        Long total = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM loan_items li
                JOIN loans l ON l.id = li.loan_id
                WHERE l.member_id = ?
                """ + statusClause, Long.class, countArguments.toArray());

        List<Object> pageArguments = new ArrayList<>(countArguments);
        pageArguments.add(size);
        pageArguments.add((long) page * size);
        // Một hàng là một LoanItem; phí đọc từ snapshot lịch sử thay vì mức phí hiện tại của Book.
        List<LoanHistoryItemResponse> content = jdbcTemplate.query("""
                SELECT li.id AS loan_item_id, l.id AS loan_id, l.loan_code, l.status AS loan_status,
                       b.id AS book_id, b.book_code, b.title AS book_title, b.author AS book_author, b.isbn,
                       li.status AS item_status, l.borrowed_at, l.due_date, li.returned_at,
                       li.borrow_fee, li.late_fee_per_day, li.late_fee,
                       li.borrow_fee + li.late_fee AS recorded_total_fee
                FROM loan_items li
                JOIN loans l ON l.id = li.loan_id
                JOIN books b ON b.id = li.book_id
                WHERE l.member_id = ?
                """ + statusClause + " ORDER BY l.borrowed_at DESC, l.id DESC, li.id DESC LIMIT ? OFFSET ?",
                LOAN_HISTORY_ROW,
                pageArguments.toArray()
        );
        return PagedResponse.of(content, page, size, total == null ? 0 : total);
    }

    private QueryParts memberWhere(MemberSearchCriteria criteria) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> arguments = new ArrayList<>();

        if (criteria.fullName() != null) {
            where.append(" AND LOWER(REPLACE(REPLACE(m.full_name, 'Đ', 'D'), 'đ', 'd'))")
                    .append(" COLLATE utf8mb4_0900_ai_ci LIKE ? COLLATE utf8mb4_0900_ai_ci");
            arguments.add(pattern(criteria.fullName()));
        }
        if (criteria.memberCode() != null) {
            where.append(" AND LOWER(m.member_code) LIKE ?");
            arguments.add(pattern(criteria.memberCode()));
        }
        if (criteria.email() != null) {
            where.append(" AND LOWER(a.email) LIKE ?");
            arguments.add(pattern(criteria.email()));
        }
        if (criteria.phoneDigits() != null) {
            where.append(" AND REGEXP_REPLACE(COALESCE(m.phone, ''), '[^0-9]', '') LIKE ?");
            arguments.add("%" + criteria.phoneDigits() + "%");
        }
        if (criteria.birthFrom() != null) {
            where.append(" AND m.date_of_birth >= ?");
            arguments.add(criteria.birthFrom());
        }
        if (criteria.birthTo() != null) {
            where.append(" AND m.date_of_birth <= ?");
            arguments.add(criteria.birthTo());
        }
        if (criteria.emailVerified() != null) {
            where.append(" AND a.email_verified = ?");
            arguments.add(criteria.emailVerified());
        }
        if (criteria.enabled() != null) {
            where.append(" AND a.enabled = ?");
            arguments.add(criteria.enabled());
        }
        if (criteria.book() != null || criteria.borrowStatus() != MemberSearchCriteria.LoanItemStatusFilter.ALL) {
            // EXISTS buộc Book và trạng thái cùng thuộc một LoanItem, đồng thời giữ mỗi Member đúng một lần.
            where.append(" AND EXISTS (SELECT 1 FROM loan_items li")
                    .append(" JOIN loans l ON l.id = li.loan_id")
                    .append(" JOIN books b ON b.id = li.book_id")
                    .append(" WHERE l.member_id = m.id");
            if (criteria.book() != null) {
                where.append(" AND (LOWER(b.book_code) LIKE ? OR ")
                        .append("LOWER(REPLACE(REPLACE(b.title, 'Đ', 'D'), 'đ', 'd'))")
                        .append(" COLLATE utf8mb4_0900_ai_ci LIKE ? COLLATE utf8mb4_0900_ai_ci)");
                arguments.add(pattern(criteria.book()));
                arguments.add(pattern(criteria.book()));
            }
            if (criteria.borrowStatus() != MemberSearchCriteria.LoanItemStatusFilter.ALL) {
                where.append(" AND li.status = ?");
                arguments.add(criteria.borrowStatus().name());
            }
            where.append(")");
        }
        return new QueryParts(where.toString(), arguments);
    }

    private String sortExpression(String field) {
        return switch (field) {
            case "memberCode" -> "m.member_code";
            case "fullName" -> "m.full_name COLLATE utf8mb4_0900_ai_ci";
            case "dateOfBirth" -> "m.date_of_birth";
            default -> "m.created_at";
        };
    }

    private static String pattern(String value) {
        return "%" + value.toLowerCase(java.util.Locale.ROOT)
                .replace('Đ', 'D').replace('đ', 'd') + "%";
    }

    private static LoanHistoryItemResponse mapLoanHistory(ResultSet rs, int rowNum) throws SQLException {
        return new LoanHistoryItemResponse(
                rs.getInt("loan_item_id"),
                rs.getInt("loan_id"),
                rs.getString("loan_code"),
                rs.getString("loan_status"),
                rs.getInt("book_id"),
                rs.getString("book_code"),
                rs.getString("book_title"),
                rs.getString("book_author"),
                rs.getString("isbn"),
                rs.getString("item_status"),
                rs.getObject("borrowed_at", java.time.LocalDateTime.class),
                rs.getObject("due_date", java.time.LocalDate.class),
                rs.getObject("returned_at", java.time.LocalDateTime.class),
                rs.getBigDecimal("borrow_fee"),
                rs.getBigDecimal("late_fee_per_day"),
                rs.getBigDecimal("late_fee"),
                rs.getBigDecimal("recorded_total_fee")
        );
    }

    private record QueryParts(String whereClause, List<Object> arguments) {
    }
}
