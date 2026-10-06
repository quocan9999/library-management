package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.Permission;

public interface PermissionRepository extends JpaRepository<Permission, Short> {
}
