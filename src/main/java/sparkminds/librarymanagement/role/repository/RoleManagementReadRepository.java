package sparkminds.librarymanagement.role.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Repository
@RequiredArgsConstructor
public class RoleManagementReadRepository {

    private static final String ROLE_COUNTS = "(SELECT COUNT(*) FROM accounts a WHERE a.role_id = r.id) "
            + "AS account_count, CASE WHEN r.code = 'ADMIN' THEN (SELECT COUNT(*) FROM permissions) "
            + "ELSE (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) END AS permission_count ";

    private static final RowMapper<RoleReadRow> ROW_MAPPER = RoleManagementReadRepository::map;

    private final JdbcTemplate jdbcTemplate;

    public List<RoleReadRow> search(String query, Boolean enabled, int page, int size, String sort, String direction) {
        QueryFilter filter = filter(query, enabled);
        String sortExpression = switch (sort) {
            case "code" -> "r.code";
            case "displayName" -> "r.display_name";
            case "createdAt" -> "r.created_at";
            case "accountCount" -> "account_count";
            case "permissionCount" -> "permission_count";
            case "enabled" -> "r.enabled";
            default -> throw new IllegalArgumentException("Unsupported role sort field");
        };
        String sql = "SELECT r.id, r.code, r.display_name, r.description, r.enabled, r.version, r.created_at, "
                + ROLE_COUNTS + "FROM roles r " + filter.where()
                + " ORDER BY " + sortExpression + " " + direction + ", r.code ASC LIMIT ? OFFSET ?";
        List<Object> arguments = new ArrayList<>(filter.arguments());
        arguments.add(size);
        arguments.add((long) page * size);
        return jdbcTemplate.query(sql, ROW_MAPPER, arguments.toArray());
    }

    public long count(String query, Boolean enabled) {
        QueryFilter filter = filter(query, enabled);
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM roles r " + filter.where(),
                Long.class, filter.arguments().toArray());
        return count == null ? 0 : count;
    }

    public RoleReadRow findByCode(String code) {
        List<RoleReadRow> rows = jdbcTemplate.query(
                "SELECT r.id, r.code, r.display_name, r.description, r.enabled, r.version, r.created_at, "
                        + ROLE_COUNTS + "FROM roles r WHERE r.code = ?",
                ROW_MAPPER, code);
        return rows.stream().findFirst().orElse(null);
    }

    private static QueryFilter filter(String query, Boolean enabled) {
        StringBuilder where = new StringBuilder("WHERE 1 = 1");
        List<Object> arguments = new ArrayList<>();
        if (query != null && !query.isBlank()) {
            where.append(" AND (LOWER(r.code) LIKE ? OR LOWER(r.display_name) LIKE ?)");
            String pattern = "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
            arguments.add(pattern);
            arguments.add(pattern);
        }
        if (enabled != null) {
            where.append(" AND r.enabled = ?");
            arguments.add(enabled);
        }
        return new QueryFilter(where.toString(), arguments);
    }

    private static RoleReadRow map(ResultSet resultSet, int rowNumber) throws SQLException {
        return new RoleReadRow(
                resultSet.getShort("id"),
                resultSet.getString("code"),
                resultSet.getString("display_name"),
                resultSet.getString("description"),
                resultSet.getBoolean("enabled"),
                resultSet.getLong("version"),
                resultSet.getLong("account_count"),
                resultSet.getLong("permission_count"),
                resultSet.getTimestamp("created_at").toLocalDateTime()
        );
    }

    private record QueryFilter(String where, List<Object> arguments) {
    }

    public record RoleReadRow(
            short id,
            String code,
            String displayName,
            String description,
            boolean enabled,
            long version,
            long accountCount,
            long permissionCount,
            LocalDateTime createdAt
    ) {
    }
}
