package sparkminds.librarymanagement.integration.role;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Properties;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SuperAdminSeedContextTests {

    private static final String PUBLIC_SEED_HASH = "$2a$12$vJDoN7He1X6/9Y7zAMQuQOrrCk7WxfB6eTOhcwCSU9CaTM2FKQa3W";

    @Test
    void defaultAndProductionContextsDoNotCreateTheTrainingPasswordAccount() throws Exception {
        Properties application = new Properties();
        try (InputStream input = getClass().getResourceAsStream("/application.properties")) {
            assertThat(input).isNotNull();
            application.load(input);
        }

        String defaultContexts = application.getProperty("spring.liquibase.contexts", "production");
        assertThat(seedAccountCount(defaultContexts)).isZero();
        assertThat(seedAccountCount(null)).isZero();
        assertThat(seedAccountCount("local")).isEqualTo(1);
        assertThat(seedAccountCount("test")).isEqualTo(1);
        assertThat(seedAccountCount("training")).isEqualTo(1);
        assertThat(defaultContexts).isEqualTo("production");
    }

    @Test
    void productionUpgradeDisablesAnAccountCreatedByTheEarlierUnscopedSeed() throws Exception {
        String url = "jdbc:h2:mem:role_seed_upgrade_" + UUID.randomUUID().toString().replace("-", "")
                + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE roles (id SMALLINT PRIMARY KEY, code VARCHAR(50) NOT NULL)");
            statement.execute("CREATE TABLE accounts (id INTEGER AUTO_INCREMENT PRIMARY KEY, "
                    + "username VARCHAR(20) NOT NULL, password_hash VARCHAR(255) NOT NULL, "
                    + "role_id SMALLINT NOT NULL, email_verified BOOLEAN NOT NULL, enabled BOOLEAN NOT NULL)");
            statement.execute("INSERT INTO roles (id, code) VALUES (1, 'ROLE_SUPER_ADMIN')");
            statement.execute("INSERT INTO accounts (id, username, password_hash, role_id, email_verified, enabled) "
                    + "VALUES (1, 'superadmin', '" + PUBLIC_SEED_HASH + "', 1, TRUE, TRUE)");
        }

        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try {
                Liquibase liquibase = new Liquibase(
                        "db/changelog/changes/025-disable-public-super-admin-seed.yaml",
                        new ClassLoaderResourceAccessor(), database);
                liquibase.update(new Contexts("production"), new LabelExpression());
            } finally {
                database.close();
            }
        }

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT enabled FROM accounts WHERE username = 'superadmin'")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getBoolean("enabled")).isFalse();
        }
    }

    private int seedAccountCount(String contexts) throws Exception {
        String url = "jdbc:h2:mem:role_seed_" + UUID.randomUUID().toString().replace("-", "")
                + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE roles (id SMALLINT PRIMARY KEY, code VARCHAR(50) NOT NULL)");
            statement.execute("CREATE TABLE accounts (id INTEGER AUTO_INCREMENT PRIMARY KEY, "
                    + "username VARCHAR(20) NOT NULL, password_hash VARCHAR(255) NOT NULL, "
                    + "role_id SMALLINT NOT NULL, email_verified BOOLEAN NOT NULL, enabled BOOLEAN NOT NULL)");
            statement.execute("INSERT INTO roles (id, code) VALUES (1, 'ROLE_SUPER_ADMIN')");
        }

        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try {
                Liquibase liquibase = new Liquibase(
                        "db/changelog/changes/024-seed-super-admin-account.yaml",
                        new ClassLoaderResourceAccessor(), database);
                liquibase.update(contexts == null ? new Contexts() : new Contexts(contexts), new LabelExpression());
            } finally {
                database.close();
            }
        }

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM accounts WHERE username = 'superadmin'")) {
            result.next();
            return result.getInt(1);
        }
    }
}
