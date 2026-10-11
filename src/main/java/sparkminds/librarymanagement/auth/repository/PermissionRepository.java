package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sparkminds.librarymanagement.auth.entity.Permission;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PermissionRepository extends JpaRepository<Permission, Short> {
    Optional<Permission> findByCode(String code);

    List<Permission> findAllByOrderByCodeAsc();

    List<Permission> findAllByCodeIn(Collection<String> codes);

    @Query("select permission.code from Role role join role.permissions permission "
            + "where role.code = :roleCode order by permission.code")
    List<String> findPermissionCodesByRoleCode(@Param("roleCode") String roleCode);
}
