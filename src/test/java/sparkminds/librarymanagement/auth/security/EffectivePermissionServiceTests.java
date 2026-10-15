package sparkminds.librarymanagement.auth.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EffectivePermissionServiceTests {

    @Mock
    private PermissionRepository permissionRepository;

    @Mock
    private RoleRepositoy roleRepository;

    @InjectMocks
    private EffectivePermissionService effectivePermissionService;

    @Test
    void adminGetsTheWholeCurrentCatalogWithoutRolePermissionAssignments() {
        Role admin = new Role();
        admin.setCode("ADMIN");
        when(roleRepository.findByCode("ADMIN")).thenReturn(Optional.of(admin));
        when(permissionRepository.findAllByOrderByCodeAsc()).thenReturn(List.of(
                permission("book:read"),
                permission("member:read"),
                permission("role:read")
        ));

        assertThat(effectivePermissionService.resolveCurrentRoleCode("ADMIN"))
                .containsExactly("book:read", "member:read", "role:read");
    }

    @Test
    void inactiveRoleHasNoEffectivePermissionsEvenWhenItHasAssignments() {
        Role role = new Role();
        role.setCode("LIBRARIAN");
        role.setEnabled(false);
        role.getPermissions().add(permission("member:read"));

        assertThat(effectivePermissionService.resolve(role)).isEmpty();
    }

    private static Permission permission(String code) {
        Permission permission = new Permission();
        permission.setCode(code);
        return permission;
    }
}
