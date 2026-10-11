package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.auth.entity.Permission;

import java.util.Optional;
import java.util.List;

public interface PermissionRepository extends JpaRepository<Permission, Short> {
    Optional<Permission> findByCode(String code);

    List<Permission> findAllByOrderByCodeAsc();
}
