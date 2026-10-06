package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.Role;

public interface RoleRepository extends JpaRepository<Role, Short> {
}
