package sparkminds.librarymanagement.adminaccount.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountPageResponse;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountResponse;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.util.List;
import java.util.Map;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminAccountReadService {
    private static final int MAX_PAGE = 10_000;
    private static final int MAX_SIZE = 50;
    private static final Map<String, String> SORT_COLUMNS = Map.of(
            "username", "a.username",
            "email", "a.email",
            "roleCode", "r.code",
            "enabled", "a.enabled",
            "emailVerified", "a.email_verified",
            "createdAt", "a.created_at"
    );

    private final NamedParameterJdbcTemplate jdbc;
    private final AccountRepository accountRepository;

    @Transactional(readOnly = true)
    public AdminAccountPageResponse search(
            CustomUserPrincipal actor,
            String username,
            String email,
            String roleCode,
            Boolean enabled,
            Boolean emailVerified,
            Integer page,
            Integer size,
            String sort
    ) {
        ensureAdmin(actor);
        int currentPage = page == null ? 0 : page;
        int pageSize = size == null ? 10 : size;
        if (currentPage < 0 || currentPage > MAX_PAGE || pageSize < 1 || pageSize > MAX_SIZE
                || tooLong(username) || tooLong(email) || tooLong(roleCode)) {
            throw searchInvalid();
        }
        Sort sortSpec = parseSort(sort);
        MapSqlParameterSource params = filters(username, email, roleCode, enabled, emailVerified);
        String where = " from accounts a join roles r on r.id = a.role_id where r.code <> 'USER'"
                + filterSql(username, email, roleCode, enabled, emailVerified);
        Long total = jdbc.queryForObject("select count(*)" + where, params, Long.class);
        params.addValue("limit", pageSize).addValue("offset", (long) currentPage * pageSize);
        List<AdminAccountResponse> rows = jdbc.query(
                "select a.id, a.username, a.email, r.code role_code, r.display_name, a.email_verified, "
                        + "a.enabled, a.is_system_account, a.session_version, a.created_at" + where
                        + " order by " + sortSpec.column() + " " + sortSpec.direction() + ", a.id ASC limit :limit offset :offset",
                params,
                (rs, row) -> new AdminAccountResponse(
                        rs.getInt("id"), rs.getString("username"), rs.getString("email"),
                        rs.getString("role_code"), rs.getString("display_name"), rs.getBoolean("email_verified"),
                        rs.getBoolean("enabled"), rs.getBoolean("is_system_account"), rs.getLong("session_version"),
                        rs.getTimestamp("created_at").toLocalDateTime())
        );
        return AdminAccountPageResponse.of(rows, currentPage, pageSize, total == null ? 0 : total);
    }

    @Transactional(readOnly = true)
    public AdminAccountResponse get(CustomUserPrincipal actor, Integer accountId) {
        ensureAdmin(actor);
        if (accountId == null || accountId <= 0) throw accountNotFound();
        List<AdminAccountResponse> rows = jdbc.query("""
                select a.id, a.username, a.email, r.code role_code, r.display_name, a.email_verified,
                       a.enabled, a.is_system_account, a.session_version, a.created_at
                from accounts a join roles r on r.id = a.role_id
                where a.id = :id and r.code <> 'USER'
                """, Map.of("id", accountId), (rs, row) -> new AdminAccountResponse(
                rs.getInt("id"), rs.getString("username"), rs.getString("email"), rs.getString("role_code"),
                rs.getString("display_name"), rs.getBoolean("email_verified"), rs.getBoolean("enabled"),
                rs.getBoolean("is_system_account"), rs.getLong("session_version"), rs.getTimestamp("created_at").toLocalDateTime()));
        if (rows.isEmpty()) throw accountNotFound();
        return rows.get(0);
    }

    private void ensureAdmin(CustomUserPrincipal actor) {
        var account = accountRepository.findById(actor.getAccountId())
                .orElseThrow(() -> new AccessDeniedException("Tài khoản không còn khả dụng"));
        if (!account.isEnabled() || !"ADMIN".equals(account.getRole().getCode())) {
            throw new AccessDeniedException("Chỉ ADMIN mới được quản lý tài khoản quản trị");
        }
    }

    private static MapSqlParameterSource filters(String username, String email, String roleCode,
                                                  Boolean enabled, Boolean emailVerified) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (username != null && !username.isBlank()) params.addValue("username", "%" + username.trim().toLowerCase(Locale.ROOT) + "%");
        if (email != null && !email.isBlank()) params.addValue("email", "%" + email.trim().toLowerCase(Locale.ROOT) + "%");
        if (roleCode != null && !roleCode.isBlank()) params.addValue("roleCode", roleCode.trim().toUpperCase(Locale.ROOT));
        if (enabled != null) params.addValue("enabled", enabled);
        if (emailVerified != null) params.addValue("emailVerified", emailVerified);
        return params;
    }

    private static String filterSql(String username, String email, String roleCode, Boolean enabled, Boolean emailVerified) {
        StringBuilder sql = new StringBuilder();
        if (username != null && !username.isBlank()) sql.append(" and lower(a.username) like :username");
        if (email != null && !email.isBlank()) sql.append(" and lower(a.email) like :email");
        if (roleCode != null && !roleCode.isBlank()) sql.append(" and r.code = :roleCode");
        if (enabled != null) sql.append(" and a.enabled = :enabled");
        if (emailVerified != null) sql.append(" and a.email_verified = :emailVerified");
        return sql.toString();
    }

    private static Sort parseSort(String sort) {
        String[] parts = sort == null || sort.isBlank() ? new String[]{"createdAt", "desc"} : sort.split(",", -1);
        if (parts.length > 2) throw searchInvalid();
        String column = SORT_COLUMNS.get(parts[0].trim());
        String direction = parts.length == 2 ? parts[1].trim().toUpperCase() : "ASC";
        if (column == null || !("ASC".equals(direction) || "DESC".equals(direction))) throw searchInvalid();
        return new Sort(column, direction);
    }

    private static boolean tooLong(String value) { return value != null && value.length() > 100; }
    private static BusinessException searchInvalid() {
        return new BusinessException(HttpStatus.BAD_REQUEST, "ADMIN_ACCOUNT_SEARCH_INVALID", "Bộ lọc, phân trang hoặc sắp xếp tài khoản không hợp lệ");
    }
    private static BusinessException accountNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "ADMIN_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản quản trị");
    }
    private record Sort(String column, String direction) { }
}
