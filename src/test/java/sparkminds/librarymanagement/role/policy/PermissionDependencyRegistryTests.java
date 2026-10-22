package sparkminds.librarymanagement.role.policy;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PermissionDependencyRegistryTests {

    @Test
    void handoverRequiresReadAndFeeConfirmationWithoutChangingCreateContract() {
        PermissionDependencyRegistry registry = new PermissionDependencyRegistry();

        assertThat(registry.requiredPermissionsFor(List.of("borrow:handover")))
                .containsExactly("borrow:fee-confirm", "borrow:read");
        assertThat(registry.missingDependencies(List.of("borrow:handover", "borrow:read")))
                .containsEntry("borrow:handover", Set.of("borrow:fee-confirm"));
        assertThat(registry.requiredPermissionsFor(List.of("borrow:create"))).isEmpty();
    }

    @Test
    void ownActionsAndStaffActionsUseSeparateReadScopes() {
        PermissionDependencyRegistry registry = new PermissionDependencyRegistry();

        assertThat(registry.requiredPermissionsFor(List.of("borrow:cancel-own", "borrow:renew")))
                .containsExactly("borrow:read-own");
        assertThat(registry.requiredPermissionsFor(List.of(
                "borrow:prepare", "borrow:cancel", "borrow:fee-confirm")))
                .containsExactly("borrow:read");
    }

    @Test
    void usesOnlyTheExplicitBusinessDependencies() {
        PermissionDependencyRegistry registry = new PermissionDependencyRegistry();

        for (String code : List.of("member:create", "member:update", "member:delete")) {
            assertThat(registry.directDependencies(code)).containsExactly("member:read");
        }
        assertThat(registry.directDependencies("member:status:update")).containsExactly("member:read");
        for (String code : List.of("book:create", "book:update", "book:delete", "book:import")) {
            assertThat(registry.directDependencies(code)).containsExactly("book:read");
        }
        assertThat(registry.directDependencies("role:update")).containsExactly("role:read");
        assertThat(registry.directDependencies("borrow:create")).isEmpty();
        assertThat(registry.directDependencies("account:change-email")).isEmpty();
    }

    @Test
    void resolvesDependenciesAcrossMultipleLevels() {
        PermissionDependencyRegistry registry = new PermissionDependencyRegistry(Map.of(
                "report:publish", Set.of("report:write"),
                "report:write", Set.of("report:read")
        ));

        assertThat(registry.requiredPermissionsFor(List.of("report:publish")))
                .containsExactly("report:read", "report:write");
        assertThat(registry.missingDependencies(List.of("report:publish")))
                .containsEntry("report:publish", Set.of("report:write"));
    }

    @Test
    void rejectsCyclesAndInvalidDependencyConfiguration() {
        assertThatThrownBy(() -> new PermissionDependencyRegistry(Map.of(
                "report:publish", Set.of("report:write"),
                "report:write", Set.of("report:publish")
        ))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("cycle");

        assertThatThrownBy(() -> new PermissionDependencyRegistry(Map.of(
                "report:publish", Set.of("report:publish")
        ))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("depend on itself");

        PermissionDependencyRegistry invalidCatalog = new PermissionDependencyRegistry(
                Map.of("report:publish", Set.of("report:read")));
        assertThatThrownBy(() -> invalidCatalog.validateCatalog(List.of("report:publish")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("report:read");
    }
}
