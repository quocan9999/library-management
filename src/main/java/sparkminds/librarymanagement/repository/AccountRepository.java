package sparkminds.librarymanagement.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.Account;

public interface AccountRepository extends JpaRepository<Account, Integer> {

    @EntityGraph(attributePaths = {"role", "role.permissions"})
    Optional<Account> findByUsername(String username);
}
