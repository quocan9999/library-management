package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.auth.entity.Role;

import java.util.Optional;

public interface RoleRepositoy extends JpaRepository<Role, Short> {
    Optional<Role> findByCode(String code);
}