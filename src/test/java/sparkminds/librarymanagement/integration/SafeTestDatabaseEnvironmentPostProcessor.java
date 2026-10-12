package sparkminds.librarymanagement.integration;

import java.net.URI;
import java.util.regex.Pattern;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Chặn khởi tạo Spring context (và Liquibase) nếu test trỏ vào DB không dành riêng.
 * Chỉ có trong test classpath, không ảnh hưởng datasource production.
 */
public final class SafeTestDatabaseEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final Pattern ALLOWED_TEST_DATABASE =
            Pattern.compile("library_management(?:_[A-Za-z0-9]+)*_test");

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String jdbcUrl = environment.getProperty("spring.datasource.url", "");
        String database;
        try {
            if (!jdbcUrl.startsWith("jdbc:mysql://")) {
                throw new IllegalArgumentException("MySQL JDBC URL bắt buộc");
            }
            URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
            String path = uri.getPath();
            if (path == null || !path.matches("/[A-Za-z0-9_]+")) {
                throw new IllegalArgumentException("Tên database không hợp lệ");
            }
            database = path.substring(1);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Từ chối chạy integration tests: JDBC URL test không hợp lệ", exception);
        }
        String applicationDatabase = environment.getProperty("MYSQL_DATABASE");
        if (database.equals(applicationDatabase)) {
            throw new IllegalStateException(
                    "Từ chối chạy integration tests: MYSQL_TEST_DATABASE phải khác MYSQL_DATABASE: " + database);
        }
        if (!ALLOWED_TEST_DATABASE.matcher(database).matches()) {
            throw new IllegalStateException(
                    "Từ chối chạy integration tests/Liquibase trên database ngoài mẫu "
                            + "library_management[_<worktree>]_test: " + database);
        }
    }
}
