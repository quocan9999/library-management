package sparkminds.librarymanagement.integration.member;

import jakarta.persistence.Version;
import org.junit.jupiter.api.Test;
import sparkminds.librarymanagement.member.entity.Member;

import java.lang.reflect.Field;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class MemberSchemaContractTests {

    @Test
    void memberUsesLongJpaVersionForOptimisticLocking() {
        Field version = Arrays.stream(Member.class.getDeclaredFields())
                .filter(field -> field.getName().equals("version"))
                .findFirst()
                .orElse(null);

        assertThat(version)
                .as("the Member row version protects edits from stale detail forms")
                .isNotNull();
        assertThat(version.getType()).isEqualTo(Long.class);
        assertThat(version.getAnnotation(Version.class)).isNotNull();
    }
}
