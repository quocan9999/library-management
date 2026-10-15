package sparkminds.librarymanagement.role.policy;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class RoleAccessPolicyDynamicRolesTests {

    private final RoleAccessPolicy policy = new RoleAccessPolicy();
    private final Set<String> adminPermissions = Set.of("role:read", "role:update", "book:read", "book:create",
            "member:read", "member:status:update", "account:change-email", "account:manage-users");

    @Test
    void adminCanManageActiveUserAndCustomGroupsButNeverSystemAdmin() {
        assertThat(policy.canEditTarget("ADMIN", "USER", adminPermissions)).isTrue();
        assertThat(policy.canEditTarget("ADMIN", "LIBRARIAN", adminPermissions)).isTrue();
        assertThat(policy.canEditTarget("ADMIN", "ADMIN", adminPermissions)).isFalse();
        assertThat(policy.canEditTarget("LIBRARIAN", "USER", adminPermissions)).isFalse();
        assertThat(policy.canEditTarget("USER", "LIBRARIAN", adminPermissions)).isFalse();
    }

    @Test
    void customRolesCanUseBusinessCatalogButCannotReceiveRoleOrAccountManagementPermissions() {
        List<String> editable = policy.editablePermissions("ADMIN", "LIBRARIAN", adminPermissions,
                List.of("account:change-email", "account:manage-users", "book:create", "book:read",
                        "member:read", "member:status:update", "role:read", "role:update"));

        assertThat(editable).contains("book:create", "member:status:update", "account:change-email");
        assertThat(editable).doesNotContain("account:manage-users", "role:read", "role:update");
    }

    @Test
    void userKeepsItsExistingNarrowPermissionAssignmentScope() {
        List<String> editable = policy.editablePermissions("ADMIN", "USER", adminPermissions,
                List.of("account:change-email", "account:manage-users", "book:create", "member:status:update"));

        assertThat(editable).containsExactly("account:change-email", "book:create");
    }
}
