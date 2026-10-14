package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import sparkminds.librarymanagement.auth.entity.Role;

import java.util.Optional;

public interface RoleRepositoy extends JpaRepository<Role, Short> {
    Optional<Role> findByCode(String code);

    boolean existsByCodeIgnoreCase(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select role from Role role where role.code = :code")
    Optional<Role> findByCodeForUpdate(@Param("code") String code);
}
