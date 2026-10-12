package sparkminds.librarymanagement.integration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SafeTestDatabaseEnvironmentPostProcessorTests {

    private final SafeTestDatabaseEnvironmentPostProcessor guard =
            new SafeTestDatabaseEnvironmentPostProcessor();

    @Test
    void rejectsOriginalDatabaseBeforeContextCanMigrateIt() {
        assertThatThrownBy(() -> check("library_management"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Từ chối chạy integration tests");
    }

    @Test
    void rejectsFeatureDatabaseBeforeContextCanMigrateIt() {
        assertThatThrownBy(() -> check("library_management_register_verify"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsTestSuffixedDatabaseOutsideLibraryManagementNamespace() {
        assertThatThrownBy(() -> check("payments_test"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Từ chối chạy integration tests");
    }

    @Test
    void rejectsNonTestDatabaseEvenWhenNoSpringProfileWasActivated() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("spring.datasource.url", "jdbc:mysql://localhost:3307/library_management");

        assertThatThrownBy(() -> guard.postProcessEnvironment(
                environment, new SpringApplication(SafeTestDatabaseEnvironmentPostProcessorTests.class)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Từ chối chạy integration tests");
    }

    @Test
    void acceptsIsolatedTestDatabase() {
        assertThatCode(() -> check("library_management_test"))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsWorktreeSpecificTestDatabase() {
        assertThatCode(() -> check("library_management_member_management_test"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsTestDatabaseWhenItMatchesTheConfiguredApplicationDatabase() {
        String database = "library_management_member_management_test";
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        environment.setProperty("MYSQL_DATABASE", database);
        environment.setProperty("spring.datasource.url", "jdbc:mysql://localhost:3308/" + database);

        assertThatThrownBy(() -> guard.postProcessEnvironment(
                environment, new SpringApplication(SafeTestDatabaseEnvironmentPostProcessorTests.class)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("phải khác MYSQL_DATABASE");
    }

    @Test
    void rejectsMalformedJdbcUrl() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        environment.setProperty("spring.datasource.url", "jdbc:h2:mem:test");
        assertThatThrownBy(() -> guard.postProcessEnvironment(
                environment, new SpringApplication(SafeTestDatabaseEnvironmentPostProcessorTests.class)))
                .isInstanceOf(IllegalStateException.class);
    }

    private void check(String database) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        environment.setProperty("spring.datasource.url", "jdbc:mysql://localhost:3307/" + database);
        guard.postProcessEnvironment(
                environment, new SpringApplication(SafeTestDatabaseEnvironmentPostProcessorTests.class));
    }
}
